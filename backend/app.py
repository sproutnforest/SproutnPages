import ctypes
import sys
from pathlib import Path

# Vercel's Linux runtime has no OpenMP library, so load our bundled copy first
if sys.platform.startswith("linux"):
    _gomp = Path(__file__).parent / "native_libs" / "libgomp.so.1"
    if _gomp.exists():
        ctypes.CDLL(str(_gomp), mode=ctypes.RTLD_GLOBAL)

import lightgbm as lgb  # keep this right after the block above

import os
import random
import re
import unicodedata

import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient, models
from supabase import create_client

load_dotenv()  # reads backend/.env when running locally

# ---------------------------------------------------------------- settings
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]  # server only
COLLECTION = os.environ["QDRANT_COLLECTION"]
GLOBAL_AVG = float(os.environ["GLOBAL_AVG"])  # the global_avg from your training history
RANK_BY = os.environ.get("RANK_BY", "class")  # "class" or "expected"
BEST_MIN_RATINGS = int(os.environ.get("BEST_RATED_MIN_RATINGS", "100"))  # 0 = no minimum
ORIGINS = [o.strip() for o in os.environ.get("FRONTEND_ORIGINS", "http://localhost:5173").split(",")]

MODEL_PATH = Path(__file__).parent / "lightgbm_book_classifier_v2_3M.txt"
CLASS_VALUES = np.array([3.0, 4.0, 5.0])
MIN_HISTORY_RATING = 3
N_CANDIDATES = 100  # how many nearest books the model scores
N_RESULTS = 50      # how many of them /recommend sends back (the best 50)
N_SIMILAR_CANDIDATES = 50  # nearest books the model scores for "similar books"
N_SIMILAR_RESULTS = 25     # how many of them /similar sends back
OVERFETCH = 3  # fetch 300 neighbours so duplicate editions can be dropped
COLD_START_COUNT = 50
COLD_START_POOL = 300
BEST_POOL = 300
BOOK_KEYS = ["book_id", "title", "author", "description", "author_id"]

# ---------------------------------------------------------------- clients
model = lgb.Booster(model_file=str(MODEL_PATH))
assert model.num_feature() == 389, "unexpected model"
qdrant = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"], timeout=30)
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)


# ---------------------------------------------------------------- helpers
def get_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    r = httpx.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": authorization, "apikey": SUPABASE_ANON_KEY},
    )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid token")
    return r.json()["id"]


def first_vector(v):
    return next(iter(v.values())) if isinstance(v, dict) else v  # named-vector collections


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", str(s)).casefold()
    return re.sub(r"\s+", " ", re.sub(r"[^\w]+", " ", s)).strip()


def work_key(payload: dict) -> str:
    """Same title + author = same book (editions merged)."""
    title = norm(payload.get("title", ""))
    author = unicodedata.normalize("NFKC", str(payload.get("author", ""))).casefold()
    author = re.sub(r"\s+", " ", author.replace(".", " ").replace(",", " ")).strip()
    return f"{title}|{author}" if title else f"id:{payload.get('book_id')}"


def book_extras(ids: list[str]) -> dict[str, dict]:
    """book_id -> {cover_url, b_cnt, b_avg}, read from the Supabase book_cover table."""
    out: dict[str, dict] = {}
    for i in range(0, len(ids), 150):  # chunks keep the request URL short
        rows = (
            sb.table("book_cover")
            .select("book_id, cover_url, b_cnt, b_avg")
            .in_("book_id", ids[i : i + 150])
            .execute()
            .data
            or []
        )
        for r in rows:
            out[str(r["book_id"])] = r
    return out


def cover_of(extras: dict[str, dict], book_id: str) -> str | None:
    return (extras.get(book_id) or {}).get("cover_url")


def fetch_books(ids: list[str]) -> dict[str, dict]:
    """book_id -> Qdrant payload (title, author, ...), for a list of ids."""
    if not ids:
        return {}
    points, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=models.Filter(must=[
            models.FieldCondition(key="book_id", match=models.MatchAny(any=ids))
        ]),
        limit=len(ids),
        with_payload=BOOK_KEYS,
        with_vectors=False,
    )
    return {str(p.payload["book_id"]): p.payload for p in points}


def site_stats(ids: list[str]) -> dict[str, dict]:
    """Ratings made on this site (the book_stats view), in chunks."""
    out: dict[str, dict] = {}
    for i in range(0, len(ids), 150):
        rows = (
            sb.table("book_stats")
            .select("book_id, avg_rating, rating_count")
            .in_("book_id", ids[i : i + 150])
            .execute()
            .data
            or []
        )
        for r in rows:
            out[str(r["book_id"])] = r
    return out


def book_stats(base: dict | None, site_row: dict | None) -> tuple[float, float]:
    """Dataset stats (Supabase book_cover) blended with this site's ratings."""
    base_n = float(base["b_cnt"]) if base and base.get("b_cnt") is not None else 0.0
    base_avg = float(base["b_avg"]) if base and base.get("b_avg") is not None else GLOBAL_AVG
    site_n = float(site_row["rating_count"]) if site_row else 0.0
    site_avg = float(site_row["avg_rating"]) if site_row else 0.0
    n = base_n + site_n
    if n == 0:
        return 0.0, GLOBAL_AVG
    return n, (base_n * base_avg + site_n * site_avg) / n


def search_score(payload: dict, words: list[str], qn: str) -> tuple:
    title = norm(payload.get("title", ""))
    author = norm(payload.get("author", ""))
    t_words, a_words = title.split(), author.split()
    score = 0.0
    if title == qn:
        score += 100
    elif title.startswith(qn):
        score += 50
    for w in words:
        if w in t_words:
            score += 5          # whole word in the title
        elif any(t.startswith(w) for t in t_words):
            score += 2          # partial word in the title
        if w in a_words:
            score += 3
        elif any(a.startswith(w) for a in a_words):
            score += 1
    popularity = float(payload.get("b_cnt") or 0)
    return (-score, -popularity)


def diverse_books(exclude_ids: list[str], count: int) -> list[dict]:
    """Random books that are far apart from each other in the vector space."""
    must_not = []
    if exclude_ids:
        must_not.append(models.FieldCondition(key="book_id", match=models.MatchAny(any=exclude_ids)))

    points = qdrant.query_points(
        COLLECTION,
        query=models.SampleQuery(sample=models.Sample.RANDOM),
        query_filter=models.Filter(must_not=must_not) if must_not else None,
        limit=COLD_START_POOL,
        with_payload=BOOK_KEYS,
        with_vectors=True,
    ).points

    seen, uniq = set(), []
    for p in points:
        if p.vector is None:
            continue
        k = work_key(p.payload)
        if k in seen:
            continue
        seen.add(k)
        uniq.append(p)
    if not uniq:
        return []

    V = np.asarray([first_vector(p.vector) for p in uniq], dtype=np.float32)
    V /= np.maximum(np.linalg.norm(V, axis=1, keepdims=True), 1e-8)

    # farthest-point selection: each new pick is the book farthest from all picks so far
    n = min(count, len(uniq))
    chosen = [random.randrange(len(uniq))]
    min_dist = 1.0 - V @ V[chosen[0]]
    while len(chosen) < n:
        min_dist[chosen] = -1.0
        nxt = int(np.argmax(min_dist))
        chosen.append(nxt)
        min_dist = np.minimum(min_dist, 1.0 - V @ V[nxt])

    random.shuffle(chosen)
    return [{k: uniq[i].payload.get(k) for k in BOOK_KEYS} for i in chosen]


def cold_start(rated_ids: list[str], limit: int) -> dict:
    books = diverse_books(rated_ids, min(limit, COLD_START_COUNT))
    extras = book_extras([str(b["book_id"]) for b in books])
    for b in books:
        b["cover_link"] = cover_of(extras, str(b["book_id"]))
    return {"books": books, "reason": "cold_start"}


def score_candidates(cands, vector, user_total: float, user_avg: float, cos=None, tiebreak=None):
    """Shared by /recommend, /similar and /explore.
    Builds the 389 features (same columns, same order as training) and ranks the candidates.
    `vector` fills the last 384 columns: the user's profile for /recommend and /explore,
    or the book's own vector for /similar.
    `cos` is the cosine feature (default: the Qdrant score); `tiebreak` orders equal predictions
    (default: the cosine)."""
    ids = [str(h.payload["book_id"]) for h in cands]
    extras = book_extras(ids)   # dataset stats + covers (Supabase book_cover)
    site = site_stats(ids)      # ratings made on this site

    if cos is None:
        cos = np.array([h.score for h in cands], dtype=np.float32)
    if tiebreak is None:
        tiebreak = cos
    X = np.zeros((len(cands), 389), dtype=np.float32)
    for i in range(len(cands)):
        X[i, 0], X[i, 1] = book_stats(extras.get(ids[i]), site.get(ids[i]))
    X[:, 2] = user_total
    X[:, 3] = user_avg
    X[:, 4] = cos
    X[:, 5:] = vector

    probs = model.predict(X)  # shape (n, 3)
    pred_class = probs.argmax(axis=1)
    expected = probs @ CLASS_VALUES

    # sort by predicted rating, then cosine (np.lexsort: the last key is the main one)
    primary = pred_class if RANK_BY == "class" else expected
    order = np.lexsort((-tiebreak, -primary))
    return ids, extras, cos, pred_class, expected, order


def build_books(cands, ids, extras, cos, pred_class, expected, order, limit: int) -> list[dict]:
    keys = ("book_id", "title", "author", "description", "author_id")
    return [
        {
            **{k: cands[i].payload.get(k) for k in keys},
            "cover_link": cover_of(extras, ids[i]),
            "predicted_rating": int(CLASS_VALUES[pred_class[i]]),
            "expected_rating": round(float(expected[i]), 3),
            "cosine": round(float(cos[i]), 4),
        }
        for i in order[:limit]
    ]


def nearest_books(cands, limit: int) -> list[dict]:
    """The closest candidates as they are (no model), for when there is no taste profile."""
    top = cands[:limit]
    ids = [str(h.payload["book_id"]) for h in top]
    extras = book_extras(ids)
    keys = ("book_id", "title", "author", "description", "author_id")
    return [
        {
            **{k: h.payload.get(k) for k in keys},
            "cover_link": cover_of(extras, ids[i]),
            "cosine": round(float(h.score), 4),
        }
        for i, h in enumerate(top)
    ]


STOPWORDS = set("""
a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having
he her here hers him his how i if in into is it its just like me more most my no nor not now of off on once
only or other our out over own same she should so some such than that the their them then there these they
this those through to too under until up very was we were what when where which while who whom why will with
would you your yours
""".split())
FILLER = set("""
want wanna read reading book books novel novels looking look find recommend recommendation recommendations
suggest something anything someone give please need enjoy kind type sort thing things lot really maybe bit
turn turns turned seem seems actually basically kinda sorta
""".split())


def extract_keywords(text: str, max_words: int = 30) -> list[str]:
    """Keeps the meaningful words of a description ("magical", "circus", "dark"), in order."""
    words, seen = [], set()
    for w in re.findall(r"[a-z0-9']+", str(text).lower()):
        w = re.sub(r"'s$", "", w).replace("'", "")
        if len(w) < 3 or w in STOPWORDS or w in FILLER or w in seen:
            continue
        seen.add(w)
        words.append(w)
    return words[:max_words]


def load_user_profile(uid: str):
    """The user's ratings turned into a taste profile.
    Returns (rated_ids, rated_points, profile, user_total, user_avg).
    profile is None when the user has no liked books (rated >= 3) or none of them has a vector;
    user_total / user_avg are then the training defaults."""
    rows = sb.table("rating").select("book_id, rating").eq("user_id", uid).execute().data or []
    rated_ids = [str(r["book_id"]) for r in rows]
    history = {
        str(r["book_id"]): float(r["rating"])
        for r in rows
        if r["rating"] >= MIN_HISTORY_RATING
    }
    if not rated_ids:
        return rated_ids, [], None, 0.0, GLOBAL_AVG

    rated_points, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=models.Filter(must=[
            models.FieldCondition(key="book_id", match=models.MatchAny(any=rated_ids))
        ]),
        limit=len(rated_ids),
        with_vectors=True,
        with_payload=["book_id", "title", "author"],
    )
    vecs, weights = [], []
    for p in rated_points:
        w = history.get(str(p.payload["book_id"]))
        if w is not None and p.vector is not None:
            vecs.append(first_vector(p.vector))
            weights.append(w)
    if not vecs:
        return rated_ids, rated_points, None, 0.0, GLOBAL_AVG

    V = np.asarray(vecs, dtype=np.float32)
    W = np.asarray(weights, dtype=np.float32)
    profile = (W[:, None] * V).sum(axis=0) / W.sum()
    return rated_ids, rated_points, profile, float(len(history)), float(np.mean(list(history.values())))


# ---------------------------------------------------------------- endpoints
@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/recommend")
def recommend(limit: int = N_RESULTS, authorization: str | None = Header(default=None)):
    uid = get_user_id(authorization)
    limit = max(1, min(limit, N_CANDIDATES))

    # 1-2. The user's taste profile (rating-weighted mean of the vectors of the books they liked)
    rated_ids, rated_points, profile, user_total, user_avg = load_user_profile(uid)
    if profile is None:
        return cold_start(rated_ids, limit)

    # 3. Nearest books the user hasn't rated, then drop duplicate editions
    hits = qdrant.query_points(
        COLLECTION,
        query=profile.tolist(),
        query_filter=models.Filter(must_not=[
            models.FieldCondition(key="book_id", match=models.MatchAny(any=rated_ids))
        ]),
        limit=N_CANDIDATES * OVERFETCH,
        with_payload=True,
    ).points

    read_works = {work_key(p.payload) for p in rated_points}
    seen, cands = set(), []
    for h in hits:  # already best score first
        k = work_key(h.payload)
        if k in read_works or k in seen:
            continue
        seen.add(k)
        cands.append(h)
        if len(cands) == N_CANDIDATES:
            break
    if not cands:
        return {"books": [], "reason": "no_candidates"}

    # 4-6. Features, LightGBM prediction, ranking (shared with /similar)
    ids, extras, cos, pred_class, expected, order = score_candidates(cands, profile, user_total, user_avg)
    return {"books": build_books(cands, ids, extras, cos, pred_class, expected, order, limit)}


@app.get("/similar/{book_id}")
def similar(book_id: str, limit: int = N_SIMILAR_RESULTS, authorization: str | None = Header(default=None)):
    """Books similar to one book: the same pipeline as /recommend, with the book's own vector
    in place of the user's profile vector."""
    uid = get_user_id(authorization)
    limit = max(1, min(limit, N_SIMILAR_CANDIDATES))

    # 1. The vector of this book
    pts, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=models.Filter(must=[
            models.FieldCondition(key="book_id", match=models.MatchValue(value=book_id))
        ]),
        limit=1,
        with_vectors=True,
        with_payload=["book_id", "title", "author"],
    )
    if not pts or pts[0].vector is None:
        raise HTTPException(404, "Book not found")
    src = pts[0]
    vec = np.asarray(first_vector(src.vector), dtype=np.float32)

    # 2. Nearest books, without the book itself and without its other editions
    hits = qdrant.query_points(
        COLLECTION,
        query=vec.tolist(),
        query_filter=models.Filter(must_not=[
            models.FieldCondition(key="book_id", match=models.MatchValue(value=book_id))
        ]),
        limit=N_SIMILAR_CANDIDATES * OVERFETCH,
        with_payload=BOOK_KEYS,
    ).points

    seen, cands = {work_key(src.payload)}, []
    for h in hits:  # already best score first
        k = work_key(h.payload)
        if k in seen:
            continue
        seen.add(k)
        cands.append(h)
        if len(cands) == N_SIMILAR_CANDIDATES:
            break
    if not cands:
        return {"books": []}

    # 3. The user's own stats, as in /recommend (training defaults when they have no liked books)
    rows = sb.table("rating").select("rating").eq("user_id", uid).execute().data or []
    liked = [float(r["rating"]) for r in rows if r["rating"] >= MIN_HISTORY_RATING]
    if not liked:
        # no taste to personalise with: simply the closest books, no model
        return {"books": nearest_books(cands, limit)}
    user_total = float(len(liked))
    user_avg = float(np.mean(liked))

    # 4. Same features and ranking as /recommend, with the book's vector as the "profile"
    ids, extras, cos, pred_class, expected, order = score_candidates(cands, vec, user_total, user_avg)
    return {"books": build_books(cands, ids, extras, cos, pred_class, expected, order, limit)}


@app.get("/explore")
def explore(q: str, limit: int = N_RESULTS, authorization: str | None = Header(default=None)):
    """Books that match a free-text description, e.g. "a magical circus where the game turns dark"."""
    uid = get_user_id(authorization)
    limit = max(1, min(limit, N_CANDIDATES))

    # 1. Keep only the meaningful words, then turn them into a vector (same space as the books)
    words = extract_keywords(q)
    if len(words) < 2:
        return {"books": [], "keywords": words, "reason": "too_short"}
    from embedder import embed  # loaded on first use, so the other endpoints stay light
    query_vec = embed(" ".join(words))

    # 2. The user's taste profile, if they have liked books
    rated_ids, rated_points, profile, user_total, user_avg = load_user_profile(uid)
    personalized = profile is not None
    want = N_CANDIDATES if personalized else limit   # 100 to rank with the model, or just the closest 50

    # 3. Nearest books to the description (not already rated), one entry per book
    hits = qdrant.query_points(
        COLLECTION,
        query=query_vec.tolist(),
        query_filter=models.Filter(must_not=[
            models.FieldCondition(key="book_id", match=models.MatchAny(any=rated_ids))
        ]) if rated_ids else None,
        limit=want * OVERFETCH,
        with_payload=BOOK_KEYS,
        with_vectors=personalized,
    ).points

    read_works = {work_key(p.payload) for p in rated_points}
    seen, cands = set(), []
    for h in hits:  # already best score first
        k = work_key(h.payload)
        if k in read_works or k in seen:
            continue
        seen.add(k)
        cands.append(h)
        if len(cands) == want:
            break
    if not cands:
        return {"books": [], "keywords": words, "reason": "no_candidates"}

    if not personalized:
        return {"books": nearest_books(cands, limit), "keywords": words, "personalized": False}

    # 4. Personalised: the model predicts what THIS user would rate each book
    #    (cosine = taste profile vs. book, as in training); the description breaks ties.
    V = np.asarray([first_vector(h.vector) for h in cands], dtype=np.float32)
    denom = np.maximum(np.linalg.norm(V, axis=1) * np.linalg.norm(profile), 1e-8)
    cos_user = ((V @ profile) / denom).astype(np.float32)
    desc_sim = np.array([h.score for h in cands], dtype=np.float32)

    ids, extras, cos, pred_class, expected, order = score_candidates(
        cands, profile, user_total, user_avg, cos=cos_user, tiebreak=desc_sim
    )
    return {
        "books": build_books(cands, ids, extras, cos, pred_class, expected, order, limit),
        "keywords": words,
        "personalized": True,
    }


@app.get("/search")
def search(q: str, limit: int = 40, authorization: str | None = Header(default=None)):
    get_user_id(authorization)

    qn = norm(q)
    words = [w for w in qn.split() if len(w) >= 2][:8]
    if not words:
        return {"books": []}

    # Every word must appear in the title OR the author
    flt = models.Filter(must=[
        models.Filter(should=[
            models.FieldCondition(key="title", match=models.MatchText(text=w)),
            models.FieldCondition(key="author", match=models.MatchText(text=w)),
        ])
        for w in words
    ])

    points, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=flt,
        limit=300,
        with_payload=["book_id", "title", "author", "author_id"],
        with_vectors=False,
    )

    # popularity (rating count) and covers come from Supabase
    extras = book_extras([str(p.payload["book_id"]) for p in points])
    for p in points:
        p.payload["b_cnt"] = (extras.get(str(p.payload["book_id"])) or {}).get("b_cnt") or 0

    # Best match first, popular books before obscure ones, one entry per book (editions merged)
    ranked = sorted((p.payload for p in points), key=lambda pl: search_score(pl, words, qn))
    seen, results = set(), []
    for pl in ranked:
        k = work_key(pl)
        if k in seen:
            continue
        seen.add(k)
        item = {key: pl.get(key) for key in ("book_id", "title", "author", "author_id")}
        item["cover_link"] = cover_of(extras, str(pl["book_id"]))
        results.append(item)
        if len(results) == limit:
            break
    return {"books": results}


@app.get("/books/{book_id}")
def get_book(book_id: str, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    points, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=models.Filter(must=[
            models.FieldCondition(key="book_id", match=models.MatchValue(value=book_id))
        ]),
        limit=1,
        with_payload=BOOK_KEYS,
        with_vectors=False,
    )
    if not points:
        raise HTTPException(404, "Book not found")
    ex = book_extras([book_id]).get(book_id) or {}
    return {**points[0].payload, "b_cnt": ex.get("b_cnt"), "b_avg": ex.get("b_avg")}


@app.get("/books")
def get_books(ids: str, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    id_list = [i for i in ids.split(",") if i][:200]
    if not id_list:
        return {"books": []}
    by_id = fetch_books(id_list)
    return {"books": [by_id[i] for i in id_list if i in by_id]}  # keeps shelf order


@app.get("/popular")
def popular(limit: int = 50, days: int = 30, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    limit = max(1, min(limit, 100))

    rows = sb.rpc("popular_books_lately", {"p_days": days, "p_limit": limit}).execute().data or []
    ids = [str(r["book_id"]) for r in rows]
    found = fetch_books(ids)
    extras = book_extras(ids)

    books = []
    for r in rows:  # keeps the order from the database
        bid = str(r["book_id"])
        pl = found.get(bid)
        if not pl:
            continue  # rated book that isn't in the catalog
        books.append({
            **{k: pl.get(k) for k in BOOK_KEYS},
            "cover_link": cover_of(extras, bid),
            "rating_count": r["rating_count"],
            "avg_rating": float(r["avg_rating"]),
        })
    return {"books": books}


@app.get("/best-rated")
def best_rated(limit: int = 50, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    limit = max(1, min(limit, 100))

    # A. Best dataset averages that have enough ratings (Supabase book_cover)
    pool_rows = (
        sb.table("book_cover")
        .select("book_id, cover_url, b_cnt, b_avg")
        .gte("b_cnt", max(BEST_MIN_RATINGS, 1))
        .order("b_avg", desc=True)
        .limit(BEST_POOL)
        .execute()
        .data
        or []
    )
    base = {str(r["book_id"]): r for r in pool_rows}

    # B. Books rated on this site, in case their ratings lift them up
    top_site = (
        sb.table("book_stats")
        .select("book_id, avg_rating, rating_count")
        .order("rating_count", desc=True)
        .limit(BEST_POOL)
        .execute()
        .data
        or []
    )
    site = {str(r["book_id"]): r for r in top_site}
    base.update(book_extras([b for b in site if b not in base]))
    site.update(site_stats([b for b in base if b not in site]))

    # C. Titles and authors from Qdrant
    cands = fetch_books(list(set(base) | set(site)))

    # D. (dataset avg x dataset total + site sum) / (dataset total + site total)
    scored = []
    for bid in cands:
        b = base.get(bid) or {}
        n = float(b.get("b_cnt") or 0)
        avg = float(b.get("b_avg") or 0)
        s = site.get(bid)
        sn = float(s["rating_count"]) if s else 0.0
        sa = float(s["avg_rating"]) if s else 0.0
        total = n + sn
        if total == 0 or total < BEST_MIN_RATINGS:
            continue
        scored.append(((avg * n + sa * sn) / total, total, bid))

    scored.sort(key=lambda t: (-t[0], -t[1]))  # best average, then more ratings
    top = scored[:limit]
    books = [
        {
            **{k: cands[b].get(k) for k in BOOK_KEYS},
            "cover_link": cover_of(base, b),
            "avg_rating": round(c, 2),
            "rating_count": int(t),
        }
        for c, t, b in top
    ]
    return {"books": books}