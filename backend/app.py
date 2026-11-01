import ctypes
import sys
from pathlib import Path

if sys.platform.startswith("linux"):
       _gomp = Path(__file__).parent / "native_libs" / "libgomp.so.1"
       if _gomp.exists():
           ctypes.CDLL(str(_gomp), mode=ctypes.RTLD_GLOBAL)

import lightgbm as lgb  # keep first, like in your eval file

import os
import re
import unicodedata

from pathlib import Path
from dotenv import load_dotenv

import httpx
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient, models
from supabase import create_client
import random

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]  # server only
COLLECTION = os.environ["QDRANT_COLLECTION"]
GLOBAL_AVG = float(os.environ["GLOBAL_AVG"])  # the global_avg from your build_history
RANK_BY = os.environ.get("RANK_BY", "class")  # "class" or "expected"

MODEL_PATH = Path(__file__).parent / "lightgbm_book_classifier_v2_3M.txt"
CLASS_VALUES = np.array([3.0, 4.0, 5.0])
MIN_HISTORY_RATING = 3  # see point 2 above
N_CANDIDATES = 100
OVERFETCH = 3  # fetch 300 neighbours so duplicate editions can be dropped
BEST_MIN_RATINGS = int(os.environ.get("BEST_RATED_MIN_RATINGS", "100"))  # 0 = no minimum
BEST_POOL = 300

model = lgb.Booster(model_file=MODEL_PATH)
assert model.num_feature() == 389, "unexpected model"
qdrant = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"], timeout=60)
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

app = FastAPI()
ORIGINS = [o.strip() for o in os.environ.get("FRONTEND_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)

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


def work_key(payload: dict) -> str:
    """Same idea as your build_work_ids: normalised title + author = same book."""
    title = unicodedata.normalize("NFKC", str(payload.get("title", ""))).casefold()
    title = re.sub(r"\s+", " ", re.sub(r"[^\w]+", " ", title)).strip()
    author = unicodedata.normalize("NFKC", str(payload.get("author", ""))).casefold()
    author = re.sub(r"\s+", " ", author.replace(".", " ").replace(",", " ")).strip()
    return f"{title}|{author}" if title else f"id:{payload.get('book_id')}"


def book_stats(payload: dict, site_row: dict | None) -> tuple[float, float]:
    """Dataset stats (from the Qdrant payload) + this site's ratings."""
    base_n = float(payload.get("b_cnt", 0))
    base_avg = float(payload.get("b_avg", GLOBAL_AVG))
    site_n = float(site_row["rating_count"]) if site_row else 0.0
    site_avg = float(site_row["avg_rating"]) if site_row else 0.0
    n = base_n + site_n
    if n == 0:
        return 0.0, GLOBAL_AVG
    return n, (base_n * base_avg + site_n * site_avg) / n


@app.get("/recommend")
def recommend(limit: int = 100, authorization: str | None = Header(default=None)):
    uid = get_user_id(authorization)

    # 1. The user's ratings: everything rated is excluded, rated >= 3 builds the profile
    rows = sb.table("rating").select("book_id, rating").eq("user_id", uid).execute().data
    rated_ids = [str(r["book_id"]) for r in rows]
    history = {
        str(r["book_id"]): float(r["rating"])
        for r in rows
        if r["rating"] >= MIN_HISTORY_RATING
    }
    if not history:
        return cold_start(rated_ids, limit)

    # 2. Their vectors -> rating-weighted profile (as in compute_chunk_features)
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
        return cold_start(rated_ids, limit)
    V = np.asarray(vecs, dtype=np.float32)
    W = np.asarray(weights, dtype=np.float32)
    profile = (W[:, None] * V).sum(axis=0) / W.sum()

    # User stats over the same rows (counts books even if they have no vector)
    user_total = float(len(history))
    user_avg = float(np.mean(list(history.values())))

    # 3. Nearest books the user hasn't rated, then drop duplicate editions
    hits = qdrant.query_points(
        COLLECTION,
        query=profile.tolist(),  # add using="<vector name>" if your collection has named vectors
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

    # 4. Features: same 389 columns, same order as training
    ids = [str(h.payload["book_id"]) for h in cands]
    site_rows = (
        sb.table("book_stats").select("book_id, avg_rating, rating_count")
        .in_("book_id", ids).execute().data
    )
    site = {str(r["book_id"]): r for r in site_rows}

    cos = np.array([h.score for h in cands], dtype=np.float32)  # = cosine for a Cosine collection
    X = np.zeros((len(cands), 389), dtype=np.float32)
    for i, h in enumerate(cands):
        X[i, 0], X[i, 1] = book_stats(h.payload, site.get(ids[i]))
    X[:, 2] = user_total
    X[:, 3] = user_avg
    X[:, 4] = cos
    X[:, 5:] = profile

    probs = model.predict(X)  # shape (n, 3)
    pred_class = probs.argmax(axis=1)
    expected = probs @ CLASS_VALUES

    # 5. Sort by predicted rating, then cosine (np.lexsort: last key is the main one)
    primary = pred_class if RANK_BY == "class" else expected
    order = np.lexsort((-cos, -primary))

    # 6. Send back
    keys = ("book_id", "title", "author", "description", "author_id")
    top = order[:limit]
    covers = fetch_covers([ids[i] for i in top])
    books = [
        {
            **{k: cands[i].payload.get(k) for k in keys},
            "cover_link": covers.get(ids[i]),
            "predicted_rating": int(CLASS_VALUES[pred_class[i]]),
            "expected_rating": round(float(expected[i]), 3),
            "cosine": round(float(cos[i]), 4),
        }
        for i in top
    ]
    return {"books": books}

def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", str(s)).casefold()
    return re.sub(r"\s+", " ", re.sub(r"[^\w]+", " ", s)).strip()


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
    popularity = float(payload.get("b_cnt", 0))  # the rating count you uploaded
    return (-score, -popularity)

def fetch_covers(book_ids: list[str]) -> dict[str, str]:
    """book_id -> cover url, one query for the whole list."""
    if not book_ids:
        return {}
    rows = (
        sb.table("book_cover")
        .select("book_id, cover_url")
        .in_("book_id", book_ids)
        .execute()
        .data
    )
    return {str(r["book_id"]): r["cover_url"] for r in rows if r.get("cover_url")}

def fetch_books(ids: list[str]) -> dict[str, dict]:
    """book_id -> payload, for a list of ids."""
    if not ids:
        return {}
    points, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=models.Filter(must=[
            models.FieldCondition(key="book_id", match=models.MatchAny(any=ids))
        ]),
        limit=len(ids),
        with_payload=BOOK_KEYS + ["b_cnt", "b_avg"],
        with_vectors=False,
    )
    return {str(p.payload["book_id"]): p.payload for p in points}


def site_stats(ids: list[str]) -> dict[str, dict]:
    """Ratings made on the site (from the book_stats view), in chunks to keep URLs short."""
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


@app.get("/popular")
def popular(limit: int = 50, days: int = 30, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    limit = max(1, min(limit, 100))

    rows = sb.rpc("popular_books_lately", {"p_days": days, "p_limit": limit}).execute().data or []
    ids = [str(r["book_id"]) for r in rows]
    found = fetch_books(ids)
    covers = fetch_covers(ids)

    books = []
    for r in rows:  # keeps the order from the database
        bid = str(r["book_id"])
        pl = found.get(bid)
        if not pl:
            continue  # rated book that isn't in the catalog
        books.append({
            **{k: pl.get(k) for k in BOOK_KEYS},
            "cover_link": covers.get(bid),
            "rating_count": r["rating_count"],
            "avg_rating": float(r["avg_rating"]),
        })
    return {"books": books}


@app.get("/best-rated")
def best_rated(limit: int = 50, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    limit = max(1, min(limit, 100))

    # A. Books with the best Qdrant (dataset) averages that have enough ratings
    flt = None
    if BEST_MIN_RATINGS > 0:
        flt = models.Filter(must=[
            models.FieldCondition(key="b_cnt", range=models.Range(gte=BEST_MIN_RATINGS))
        ])
    pool, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=flt,
        order_by=models.OrderBy(key="b_avg", direction=models.Direction.DESC),
        limit=BEST_POOL,
        with_payload=BOOK_KEYS + ["b_cnt", "b_avg"],
        with_vectors=False,
    )
    cands = {str(p.payload["book_id"]): p.payload for p in pool}

    # B. Also consider books rated on the site, in case their ratings lift them up
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
    cands.update(fetch_books([b for b in site if b not in cands]))
    site.update(site_stats([b for b in cands if b not in site]))

    # C. (qdrant avg x qdrant total + site sum) / (qdrant total + site total)
    scored = []
    for bid, pl in cands.items():
        n = float(pl.get("b_cnt", 0))
        avg = float(pl.get("b_avg", 0))
        s = site.get(bid)
        sn = float(s["rating_count"]) if s else 0.0
        sa = float(s["avg_rating"]) if s else 0.0
        total = n + sn
        if total == 0 or total < BEST_MIN_RATINGS:
            continue
        scored.append(((avg * n + sa * sn) / total, total, bid))

    scored.sort(key=lambda t: (-t[0], -t[1]))  # best average, then more ratings
    top = scored[:limit]
    covers = fetch_covers([b for _, _, b in top])
    books = [
        {
            **{k: cands[b].get(k) for k in BOOK_KEYS},
            "cover_link": covers.get(b),
            "avg_rating": round(c, 2),
            "rating_count": int(t),
        }
        for c, t, b in top
    ]
    return {"books": books}

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
        with_payload=["book_id", "title", "author", "author_id", "b_cnt"],
        with_vectors=False,
    )

    # Best match first, popular books before obscure ones, one entry per book (editions merged)
    ranked = sorted((p.payload for p in points), key=lambda pl: search_score(pl, words, qn))
    seen, results = set(), []
    for pl in ranked:
        k = work_key(pl)
        if k in seen:
            continue
        seen.add(k)
        results.append({key: pl.get(key) for key in ("book_id", "title", "author", "author_id", "cover_link")})
        if len(results) == limit:
            break

    covers = fetch_covers([str(r["book_id"]) for r in results])
    for r in results:
        r["cover_link"] = covers.get(str(r["book_id"]))

    return {"books": results}


BOOK_KEYS = ["book_id", "title", "author", "description", "author_id"]

@app.get("/books/{book_id}")
def get_book(book_id: str, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    points, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=models.Filter(must=[
            models.FieldCondition(key="book_id", match=models.MatchValue(value=book_id))
        ]),
        limit=1,
        with_payload=BOOK_KEYS + ["b_cnt", "b_avg"],
        with_vectors=False,
    )
    if not points:
        raise HTTPException(404, "Book not found")
    return points[0].payload


@app.get("/books")
def get_books(ids: str, authorization: str | None = Header(default=None)):
    get_user_id(authorization)
    id_list = [i for i in ids.split(",") if i][:200]
    if not id_list:
        return {"books": []}
    points, _ = qdrant.scroll(
        COLLECTION,
        scroll_filter=models.Filter(must=[
            models.FieldCondition(key="book_id", match=models.MatchAny(any=id_list))
        ]),
        limit=len(id_list),
        with_payload=BOOK_KEYS,
        with_vectors=False,
    )
    by_id = {str(p.payload["book_id"]): p.payload for p in points}
    return {"books": [by_id[i] for i in id_list if i in by_id]}  

COLD_START_COUNT = 50      # how many books to show
COLD_START_POOL = 1000      # random books to choose the spread-out set from
COLD_START_MIN_RATINGS = int(os.environ.get("COLD_START_MIN_RATINGS", "0"))  # 0 = no popularity filter

def diverse_books(exclude_ids: list[str], count: int) -> list[dict]:
    must = []
    if COLD_START_MIN_RATINGS > 0:
        must.append(models.FieldCondition(key="b_cnt", range=models.Range(gte=COLD_START_MIN_RATINGS)))
    must_not = []
    if exclude_ids:
        must_not.append(models.FieldCondition(key="book_id", match=models.MatchAny(any=exclude_ids)))

    points = qdrant.query_points(
        COLLECTION,
        query=models.SampleQuery(sample=models.Sample.RANDOM),
        query_filter=models.Filter(must=must or None, must_not=must_not or None),
        limit=COLD_START_POOL,
        with_payload=["book_id", "title", "author", "description", "author_id"],
        with_vectors=True,
    ).points

    # one entry per book (editions merged), and only points that have a vector
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
    keys = ("book_id", "title", "author", "description", "author_id")
    return [{k: uniq[i].payload.get(k) for k in keys} for i in chosen]


def cold_start(rated_ids: list[str], limit: int) -> dict:
    books = diverse_books(rated_ids, min(limit, COLD_START_COUNT))
    covers = fetch_covers([str(b["book_id"]) for b in books])
    for b in books:
        b["cover_link"] = covers.get(str(b["book_id"]))
    return {"books": books, "reason": "cold_start"}