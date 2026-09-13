"""
Turn a query into a vector, using the same model that made the film vectors.

Run:
    uv run uvicorn server.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL = "all-MiniLM-L6-v2"

app = FastAPI()

# The app runs on port 5137 and this runs on 8000, so the browser 
# treats them as different sites and blocks the call without this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

model = SentenceTransformer(MODEL) # loads once, when the server starts

class Query(BaseModel):
    q: str

@app.post("/embed")
def embed(query: Query):
    v = model.encode([query.q], normalize_embeddings=True)[0]
    return {"v": v.tolist()}
