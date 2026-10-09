// Plain JavaScript, no React, just turning a query into a vector
import { D } from "./rank.js";

const FULL = 384; // what the model gives, before the PCA

const MODEL = "Xenova/all-MiniLM-L6-v2";

let modelPromise = null; // set on the first call, shared by every caller after

async function loadPca() {
  const res = await fetch("/pca.bin");
  if (!res.ok) throw new Error(`pca.bin: ${res.status}`);
  return new Float32Array(await res.arrayBuffer());
}

async function load(onProgress) {
  const { pipeline, env } = await import("@huggingface/transformers");

  // Use our own copy, written into public/ by scrips/fetch-models.js
  env.allowLocalModels = true;
  env.allowRemoteModels = false;

  // q8 is the 23MB file measured in compare_model.py: 163 of 170 same films
  const extractor = await pipeline("feature-extraction", MODEL, {
    dtype: "q8",
    // Call many times during the dowload. Only the total across all files matters here
    progress_callback: (info) => {
      if (info.status === "progress_total" && onProgress) onProgress(info.progress / 100);
    },
  });
  const pca = await loadPca();
  return { extractor, pca };
}

export function loadModel(onProgress) {
  if (!modelPromise) {
    modelPromise = load(onProgress).catch((err) => {
      modelPromise = null; // so the next call starts a fresh download
      throw err;
    });
  }
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
