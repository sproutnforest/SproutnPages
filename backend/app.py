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
        return {"books": [], "reason": "no_history"}  # cold start: handle later

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
        return {"books": [], "reason": "no_vectors"}
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
        with_payload=BOOK_KEYS,
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
    return {"books": [by_id[i] for i in id_list if i in by_id]}  # keeps shelf order