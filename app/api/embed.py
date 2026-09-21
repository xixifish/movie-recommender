from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

HERE = Path(__file__).parent

tokenizer = Tokenizer.from_file(str(HERE / "tokenizer.json"))
session = ort.InferenceSession(str(HERE / "model.onnx"))

pca = json.loads((HERE / "pca.json").read_text())
matrix = np.array(pca["matrix"], dtype=np.float32).T   # 384 x 192

def embed(text):
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

    # mean pool over the real tokens, then normalise
    m = mask[..., None].astype(np.float32)
    v = (out * m).sum(1) / m.sum(1)
    v = v[0] / np.linalg.norm(v[0])

    v = v @ matrix
    return v / np.linalg.norm(v)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        body = json.loads(self.rfile.read(length) or "{}")

        v = embed(body.get("q", ""))

        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"you_sent": body.get("q")}).encode())