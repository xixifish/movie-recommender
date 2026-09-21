"""
Turn a query into a vector, using the same model that made the film vectors.

Run locally:
    uv run uvicorn server.main:app --reload --port 8000
"""
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from tokenizers import Tokenizer

HERE = Path(__file__).parent

tokenizer = Tokenizer.from_file(str(HERE / "tokenizer.json"))
session = ort.InferenceSession(str(HERE / "model.onnx"))

pca = json.loads((HERE / "pca.json").read_text())
matrix = np.array(pca["matrix"], dtype=np.float32).T   # 384 x 192
print(f"pca matrix {matrix.shape}, {pca['dims']} dims")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        # the live site goes here
    ],
    allow_methods=["POST"],
    allow_headers=["*"],
)

class Query(BaseModel):
    q: str

def embed(text):
    """Mean pool over the real tokens, normalise, then shrink with the PCA."""
    enc = tokenizer.encode(text)
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)

    out = session.run(
        None,
        {
            "input_ids": ids,
            "attention_mask": mask,
            "token_type_ids": np.zeros_like(ids),
        },
    )[0]

    m = mask[..., None].astype(np.float32)
    v = (out * m).sum(1) / m.sum(1)
    v = v[0] / np.linalg.norm(v[0])

    v = v @ matrix
    return v / np.linalg.norm(v)

@app.post("/embed")
def embed_route(query: Query):
    return {"v": embed(query.q).tolist()}
