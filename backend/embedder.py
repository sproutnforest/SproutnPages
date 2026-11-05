"""
Turns a short text into a vector in the SAME space as the books stored in Qdrant.

Runs the embedding model with onnxruntime (no PyTorch), so it fits on Vercel.
Needs backend/embedder_model/model.onnx and backend/embedder_model/tokenizer.json
(created once by the export command, see the instructions).

The three settings below must match how the book vectors were made.
verify_embedder.py tells you which values are right.
"""

from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

# ---------------------------------------------------------------- must match your book vectors
POOLING = "mean"     # "mean" for MiniLM / gte / e5 models, "cls" for bge models
QUERY_PREFIX = ""    # e5 models want "query: ", leave empty for MiniLM
MAX_LEN = 256        # the model's max_seq_length (256 for all-MiniLM-L6-v2)
# ----------------------------------------------------------------------------------------------

_DIR = Path(__file__).parent / "embedder_model"
_tok = Tokenizer.from_file(str(_DIR / "tokenizer.json"))
_tok.enable_truncation(max_length=MAX_LEN)
_sess = ort.InferenceSession(str(_DIR / "model.onnx"), providers=["CPUExecutionProvider"])
_input_names = {i.name for i in _sess.get_inputs()}


def embed(text: str) -> np.ndarray:
    """Returns a unit-length float32 vector (384 numbers for the MiniLM family)."""
    enc = _tok.encode(QUERY_PREFIX + text)
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)

    feed = {"input_ids": ids, "attention_mask": mask}
    if "token_type_ids" in _input_names:
        feed["token_type_ids"] = np.zeros_like(ids)

    tokens = _sess.run(None, feed)[0]  # (1, length, dim): one vector per token
    if POOLING == "cls":
        vec = tokens[0, 0]
    else:  # mean of the token vectors, ignoring padding
        m = mask[0][:, None].astype(np.float32)
        vec = (tokens[0] * m).sum(axis=0) / max(float(m.sum()), 1e-9)

    return (vec / max(float(np.linalg.norm(vec)), 1e-12)).astype(np.float32)
