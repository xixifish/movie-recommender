import os
os.environ.setdefault("HF_HOME", "/tmp/hf")

from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

MODEL = "sentence-transformers/all-MiniLM-L6-v2"
HERE = Path(__file__).parent

tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModel.from_pretrained(MODEL)
model.eval()

pca = json.loads((HERE / "pca.json").read_text())
matrix = np.array(pca["matrix"], dtype=np.float32).T   # 384 x 192

def embed(text):
    """The same thing sentence-transformers does: mean pool, then normalise."""
    batch = tokenizer([text], padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        out = model(**batch).last_hidden_state

    mask = batch["attention_mask"].unsqueeze(-1).float()
    pooled = (out * mask).sum(1) / mask.sum(1)
    v = pooled[0].numpy()
    v = v / np.linalg.norm(v)

    v = v @ matrix
    return v / np.linalg.norm(v)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        body = json.loads(self.rfile.read(length) or "{}")

        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"you_sent": body.get("q")}).encode())