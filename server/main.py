"""
Turn a query into a vector, using the same model that made the film vectors.

Run:
    uv run uvicorn server.main:app --reload --port 8000
"""
import json
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL = "all-MiniLM-L6-v2"
DATA = Path(__file__).parent.parent / "data"

model = SentenceTransformer(MODEL) # loads once, when the server starts

# The same transform the films went through. If these ever differ, every score
# still looks like a plausible number and none of them mean anything.
pca = json.loads((DATA / "pca.json").read_text())
matrix = np.array(pca["matrix"], dtype=np.float32).T   # 384 x 192
print(f"pca matrix {matrix.shape}, {pca['dims']} dims")

app = FastAPI()

# The app runs on port 5137 and this runs on 8000, so the browser 
# treats them as different sites and blocks the call without this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["POST"],
    allow_headers=["*"],
)



class Query(BaseModel):
    q: str

@app.post("/embed")
def embed(query: Query):
    v = model.encode([query.q], normalize_embeddings=True)[0]
    v = v @ matrix
    v = v / np.linalg.norm(v)
    return {"v": v.tolist()}
