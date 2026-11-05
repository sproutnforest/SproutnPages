"""
Finds out which embedding model (and which text recipe) produced the vectors in Qdrant,
and later checks that the ONNX copy used by the backend gives the same vectors.

Run on your own computer (not on Vercel):
    pip install sentence-transformers qdrant-client

Step 1 - which model made my vectors?
    python verify_embedder.py

Step 2 - after exporting the model to ONNX and putting it in backend/embedder/
    python verify_embedder.py --onnx sentence-transformers/all-MiniLM-L6-v2
"""

import sys

import numpy as np
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------- fill in
URL = "https://YOUR-CLUSTER.cloud.qdrant.io"
API_KEY = "YOUR_QDRANT_KEY"
COLLECTION = "book_recommendation"
# --------------------------------------------------------------------------

N_BOOKS = 8

# every popular 384-dimension model; add yours if it is not here
CANDIDATES = [
    "sentence-transformers/all-MiniLM-L6-v2",
    "sentence-transformers/all-MiniLM-L12-v2",
    "sentence-transformers/paraphrase-MiniLM-L6-v2",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "BAAI/bge-small-en-v1.5",
    "intfloat/e5-small-v2",
    "thenlper/gte-small",
]

# how the text of a book could have been built before embedding it
RECIPES = {
    "description": lambda p: p["description"],
    "title + description": lambda p: f"{p['title']} {p['description']}",
    "title. description": lambda p: f"{p['title']}. {p['description']}",
    "title by author. description": lambda p: f"{p['title']} by {p['author']}. {p['description']}",
    "title": lambda p: p["title"],
}
PREFIXES = ["", "passage: "]  # e5 models were trained with a "passage: " prefix on documents


def first_vector(v):
    return next(iter(v.values())) if isinstance(v, dict) else v


def load_books():
    client = QdrantClient(url=URL, api_key=API_KEY, timeout=60)
    points, _ = client.scroll(COLLECTION, limit=60, with_vectors=True, with_payload=True)
    good = [
        p for p in points
        if p.payload.get("description") and len(p.payload["description"]) > 150 and p.vector is not None
    ][:N_BOOKS]
    if len(good) < 3:
        raise SystemExit("Could not find enough books with a description in Qdrant.")
    stored = np.array([first_vector(p.vector) for p in good], dtype=np.float32)
    stored /= np.linalg.norm(stored, axis=1, keepdims=True)
    return [p.payload for p in good], stored


def find_model():
    payloads, stored = load_books()
    print(f"Comparing {len(payloads)} books against {len(CANDIDATES)} models...\n")
    results = []
    for name in CANDIDATES:
        try:
            model = SentenceTransformer(name)
        except Exception as e:  # noqa: BLE001
            print(f"  skip {name}: {e}")
            continue
        if model.get_sentence_embedding_dimension() != stored.shape[1]:
            print(f"  skip {name}: {model.get_sentence_embedding_dimension()} dimensions, vectors have {stored.shape[1]}")
            continue
        for rname, recipe in RECIPES.items():
            for prefix in PREFIXES:
                texts = [prefix + recipe(p) for p in payloads]
                emb = model.encode(texts, normalize_embeddings=True)
                score = float(np.mean(np.sum(emb * stored, axis=1)))
                results.append((score, name, rname, prefix))
        print(f"  done {name}")

    results.sort(reverse=True)
    print("\nBest matches (1.000 = identical):")
    for score, name, rname, prefix in results[:8]:
        print(f"  {score:.4f}  {name}  |  text = {rname}" + (f"  |  prefix = {prefix!r}" if prefix else ""))

    best = results[0]
    print()
    if best[0] >= 0.98:
        print(f"MATCH: {best[1]}  (text recipe: {best[2]})")
    elif best[0] >= 0.85:
        print("CLOSE but not exact: the model is probably right but the text recipe differs. Send me this printout.")
    else:
        print("NO MATCH: none of these models made your vectors. Send me this printout.")


def check_onnx(model_name):
    sys.path.insert(0, "backend")
    from embedder import embed  # the backend's ONNX version

    st = SentenceTransformer(model_name)
    phrases = [
        "magical circus game dark",
        "detective solving murders victorian london sidekick",
        "space station survival alien crew",
        "cozy small town bakery romance",
    ]
    print("similarity between the ONNX vector and the original (should be above 0.999):")
    ok = True
    for t in phrases:
        a = st.encode(t, normalize_embeddings=True)
        b = embed(t)
        s = float(np.dot(a, b))
        ok = ok and s > 0.999
        print(f"  {s:.5f}  {t}")
    print("PASS" if ok else "FAIL: check POOLING / QUERY_PREFIX / MAX_LEN at the top of backend/embedder.py")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--onnx":
        check_onnx(sys.argv[2])
    else:
        find_model()
