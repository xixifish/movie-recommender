import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";

// A fixed version of the Hugging Face repo, so the model cannot change under us.
// compare_model.py measured this exact file: 163 of 170 same films.
const REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";
const REMOTE = `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${REVISION}/`;
const DIR = new URL("../public/models/Xenova/all-MiniLM-L6-v2/", import.meta.url);

const MODEL = "onnx/model_quantized.onnx";
const MODEL_SIZE = 22972370; // bytes
const FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", MODEL];

// A half-downloaded file also exists, so the model is checked by size too
function alreadyExist(name, path) {
  if (!existsSync(path)) return false;
  if (name === MODEL) return statSync(path).size === MODEL_SIZE;
  return true;
}

for (const name of FILES) {
  const path = new URL(name, DIR);
  if (alreadyExist(name, path)) continue;

  const res = await fetch(REMOTE + name);
  if (!res.ok) throw new Error(`${name}: ${res.status} ${res.statusText}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  if (name === MODEL && bytes.length !== MODEL_SIZE) {
    throw new Error(`${name}: got ${bytes.length} bytes, expected ${MODEL_SIZE}`);
  }

  mkdirSync(new URL(".", path), { recursive: true });
  writeFileSync(path, bytes);
  console.log(`downloaded ${name}, ${bytes.length} bytes`);
}
