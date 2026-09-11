// All the ranking maths. No React in here.

export const N = 5000; // films
const D = 384; // dimensions
const W_LIKED = 0.75;
const W_DISLIKED = -0.15;
const W_SAVED = 0.6;
const W_QUALITY = 0.5;
const TEMPERATURE = 0.1;
const BLEND = 0.8;
const W_FALLBACK = [0.38, 0.24, 0.14, 0.09, 0.05, 0.05, 0.05];
const W_MAX = 0.35; // autoWeights cap

// Get a film's one field vector
function vecFor(ctx, iField, iFilm) {
  const start = (iField * N + iFilm) * D;
  return ctx.vecs.subarray(start, start + D);
}

// Add vector
function addInto(target, source) {
  for (let d = 0; d < D; d++) target[d] += source[d];
}

// Check if the film has the field text
function has(ctx, iField, iFilm) {
  return ctx.masks[iField][iFilm] === "1";
}

// Calculate taste vector for one field
function tasteFor(ctx, iField) {
  const taste = new Float32Array(D);

  let nUp = 0,
    nDown = 0,
    nSaved = 0;

  const liked = new Float32Array(D),
    disliked = new Float32Array(D),
    saveds = new Float32Array(D);

  for (const key in ctx.ratings) {
    const i = Number(key);

    if (!has(ctx, iField, i)) continue; // this film has no text in this field

    if (ctx.ratings[key] === "up") {
      // Record the number of liked film to calculate the average vector later
      nUp++;
      // Add all the vectors of the `iField` of liked films
      addInto(liked, vecFor(ctx, iField, i));
    }
    if (ctx.ratings[key] === "down") {
      nDown++;
      addInto(disliked, vecFor(ctx, iField, i));
    }
  }

  for (const key in ctx.saved) {
    if (!ctx.saved[key]) continue;

    const i = Number(key);
    if (!has(ctx, iField, i)) continue;

    nSaved++;
    addInto(saveds, vecFor(ctx, iField, i));
  }

  if (nUp + nDown + nSaved === 0) return null;

  for (let d = 0; d < D; d++) {
    taste[d] =
      (nUp ? (W_LIKED * liked[d]) / nUp : 0) +
      (nDown ? (W_DISLIKED * disliked[d]) / nDown : 0) +
      (nSaved ? (W_SAVED * saveds[d]) / nSaved : 0);
  }

  return taste;
}

// Calculate product of two vectors
function dot(a, b) {
  let s = 0;
  for (let d = 0; d < D; d++) s += a[d] * b[d];
  return s;
}

// Normalise the taste vector
function normalise(taste) {
  if (!taste) return;

  const vecLength = Math.sqrt(dot(taste, taste));
  for (let d = 0; d < D; d++) {
    taste[d] /= vecLength;
  }
}

// Score all the 5,000 films over one field
// work for any query vector, from marks or from search
function scoreField(ctx, iField, query) {
  const scores = new Float32Array(N);
  for (let i = 0; i < N; i++) scores[i] = dot(vecFor(ctx, iField, i), query);
  return scores;
}

// Calculate median value of an array
function median(arr) {
  if (!arr || arr.length === 0) return undefined;

  const sorted = arr.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// (Confidence) How far this field's best results sit above its own middle
function confidence(ctx, iField, scores, k = 10) {
  const valid = [];
  for (let i = 0; i < N; i++) {
    if (has(ctx, iField, i)) valid.push(scores[i]);
  }
  const top = valid.toSorted((a, b) => b - a).slice(0, k);
  const topMean = top.reduce((sum, val) => sum + val, 0) / top.length;
  return topMean - median(valid);
}

// Turn the seven confidences into seven weights that add up to 1
function autoWeights(confs) {
  const largest = Math.max(...confs);

  // exponentiate the gaps, scaled by temperature
  const e = confs.map((c) => Math.exp((c - largest) / TEMPERATURE));
  const total = e.reduce((sum, v) => sum + v, 0);

  // share of the total, then blended with the fallback
  return e.map((v, f) => BLEND * (v / total) + (1 - BLEND) * W_FALLBACK[f]);
}

// No single field may take more than W_MAX. Give the excess to the others.
function capWeights(weights) {
  const w = [...weights];

  for (let pass = 0; pass < w.length; pass++) {
    let spare = 0; // how much was cut off the greedy fields
    let rest = 0; // total weight of the fields still under the cap

    for (let f = 0; f < w.length; f++) {
      if (w[f] > W_MAX) {
        spare += w[f] - W_MAX;
        w[f] = W_MAX;
      } else if (w[f] < W_MAX) {
        rest += w[f];
      }
    }

    if (spare === 0 || rest === 0) break;

    // Share the spare out, in the ratio the others already have
    for (let f = 0; f < w.length; f++) {
      if (w[f] < W_MAX) w[f] += spare * (w[f] / rest);
    }
  }

  return w;
}

// Combine the seven field scores into one score per film
function combine(ctx, scoresByField, weights) {
  const scores = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    let total = 0;
    let weightUsed = 0;

    for (let f = 0; f < weights.length; f++) {
      if (!has(ctx, f, i)) continue;
      total += weights[f] * scoresByField[f][i];
      weightUsed += weights[f];
    }

    scores[i] = total / Math.max(weightUsed, 1e-9);
  }

  return scores;
}

// Score all 5,000 films from what the user has marked.
// Returns a Float32Array of N scores, or null if nothing is marked.
export function scoreAll(ctx) {
  if (tasteFor(ctx, 0) === null) return null;

  // One taste vector per field, then one score per film per field
  // 7 scores x 5000 films
  const scoresByField = [];
  for (let f = 0; f < ctx.masks.length; f++) {
    const t = tasteFor(ctx, f);
    if (t === null) {
      scoresByField.push(new Float32Array(N)); // zero array
      continue;
    }
    normalise(t);
    scoresByField.push(scoreField(ctx, f, t));
  }

  const confs = scoresByField.map((s, f) => confidence(ctx, f, s));
  const weights = capWeights(autoWeights(confs));
  console.log(weights.map((w) => w.toFixed(3))); // temporary

  const scores = combine(ctx, scoresByField, weights);
  for (let i = 0; i < N; i++) scores[i] *= 1 + W_QUALITY * ctx.films[i].q;

  return scores;
}
