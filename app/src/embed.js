// Plain JavaScript, no React, just turning a query into a vector
import { D } from "./rank.js";

const FULL = 384; // what the model gives, before the PCA

const MODEL = "Xenova/all-MiniLM-L6-v2";

let modelPromise = null; // set on the first call, shared by every caller after

async function loadPca() {
  const res = await fetch("/pca.bin");
  return new Float32Array(await res.arrayBuffer());
}

export async function load() {
  const { pipeline } = await import("@huggingface/transformers");
  // q8 is the 23MB file measured in compare_model.py: 163 of 170 same films
  const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
  const pca = await loadPca();
  return { extractor, pca };
}

export function loadModel() {
  if (!modelPromise) modelPromise = load();
  return modelPromise;
}

export async function embed(text) {
  const { extractor, pca } = await loadModel();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const v = output.data; // 384 numbers, a Float32Array

  // Shrink: each output number is one row of the matrix dotted with v
  const q = new Float32Array(D);
  for (let i = 0; i < D; i++) {
    const row = pca.subarray(i * FULL, (i + 1) * FULL);
    let sum = 0;
    for (let j = 0; j < FULL; j++) sum += row[j] * v[j];
    q[i] = sum;
  }

  // Normalise again, the shrink changed the length
  let length = 0;
  for (let i = 0; i < D; i++) length += q[i] * q[i];
  length = Math.sqrt(length);
  for (let i = 0; i < D; i++) q[i] /= length;

  return q;
}
