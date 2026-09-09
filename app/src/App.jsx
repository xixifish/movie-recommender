import { useState, useEffect } from "react";
import "./App.css";

const IMG = "https://image.tmdb.org/t/p/w185";
const N = 5000; // films
const N_SHOWN = 30;
const D = 384; // dimensions
const W_LIKED = 0.75;
const W_DISLIKED = -0.15;
const W_SAVED = 0.6;
const W_QUALITY = 0.5;
const TEMPERATURE = 0.1;
const BLEND = 0.8;
const W_FALLBACK = [0.38, 0.24, 0.14, 0.09, 0.05, 0.05, 0.05];
const W_MAX = 0.35; // autoWeights cap

export default function App() {
  const [films, setFilms] = useState([]); // films
  const [vecs, setVecs] = useState(null); // vector numbers of all films
  const [ratings, setRatings] = useState({}); // { index: "up" | "down" }
  const [saved, setSaved] = useState({}); // { index: true }
  // which films are on screen, by index (index is how to find a film's vector)
  const [shown, setShown] = useState([]);
  const [seen, setSeen] = useState({}); // Filter out all the films has been recommended
  const [masks, setMasks] = useState(null);

  // Up or down a film
  function rate(i, kind) {
    setRatings((r) => ({ ...r, [i]: r[i] === kind ? undefined : kind }));
  }

  // Save a film
  function toggleSave(i) {
    setSaved((s) => ({ ...s, [i]: s[i] ? undefined : true }));
  }

  // Get a film's one field vector
  function vecFor(iField, iFilm) {
    const start = (iField * N + iFilm) * D;
    return vecs.subarray(start, start + D);
  }

  // Add vector
  function addInto(target, source) {
    for (let d = 0; d < D; d++) target[d] += source[d];
  }

  // Check if the film has the field text
  function has(iField, iFilm) {
    return masks[iField][iFilm] === "1";
  }

  // Calculate taste vector for one field
  function tasteFor(iField) {
    const taste = new Float32Array(D);

    let nUp = 0,
      nDown = 0,
      nSaved = 0;

    const liked = new Float32Array(D),
      disliked = new Float32Array(D),
      saveds = new Float32Array(D);

    for (const key in ratings) {
      const i = Number(key);

      if (!has(iField, i)) continue; // this film has no text in this field

      if (ratings[key] === "up") {
        // Record the number of liked film to calculate the average vector later
        nUp++;
        // Add all the vectors of the `iField` of liked films
        addInto(liked, vecFor(iField, i));
      }
      if (ratings[key] === "down") {
        nDown++;
        addInto(disliked, vecFor(iField, i));
      }
    }

    for (const key in saved) {
      if (!saved[key]) continue;

      const i = Number(key);
      if (!has(iField, i)) continue;

      nSaved++;
      addInto(saveds, vecFor(iField, i));
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
  function scoreField(iField, query) {
    const scores = new Float32Array(N);
    for (let i = 0; i < N; i++) scores[i] = dot(vecFor(iField, i), query);
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
  function confidence(iField, scores, k = 10) {
    const valid = [];
    for (let i = 0; i < N; i++) {
      if (has(iField, i)) valid.push(scores[i]);
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

  // Combine the seven field scores into one score per film
  function combine(scoresByField, weights) {
    const scores = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      let total = 0;
      let weightUsed = 0;

      for (let f = 0; f < weights.length; f++) {
        if (!has(f, i)) continue;
        total += weights[f] * scoresByField[f][i];
        weightUsed += weights[f];
      }

      scores[i] = total / Math.max(weightUsed, 1e-9);
    }

    return scores;
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

  // Refresh
  function rerank() {
    // The loop in the Task 1 reads `masks.length`, so it needs to be guarded
    if (!vecs || !masks) return;

    // Task 1: Score all films based on the taste vector on the same field
    const scoresByField = []; // 5000 scores x 7 (scores 5000 films on each field)

    const t0 = tasteFor(0);
    // If user didn't mark any films, display next 30 films from films.json
    // And this function stops and returns
    if (t0 === null) {
      const next = [];
      for (let i = 0; i < N && next.length < N_SHOWN; i++) {
        if (!seen[i]) next.push(i);
      }
      setShown(next);
      setSeen((s) => ({ ...s, ...Object.fromEntries(next.map((i) => [i, true])) }));
      return;
    }

    for (let f = 0; f < masks.length; f++) {
      const t = tasteFor(f);
      if (t === null) {
        scoresByField.push(new Float32Array(N)); // zero array
        continue;
      }
      normalise(t);
      scoresByField.push(scoreField(f, t));
    }

    // Task 2: Score all 5,000 films
    // 1. Compute the confidence of each field
    const confs = scoresByField.map((s, f) => confidence(f, s));
    // 2. Calculate each field's weight
    const weights = capWeights(autoWeights(confs));
    console.log(weights.map((w) => w.toFixed(3)));
    // 3. Score by all the fields
    const scores = combine(scoresByField, weights);
    for (let i = 0; i < N; i++) scores[i] *= 1 + W_QUALITY * films[i].q;

    // Task 3: Sort, filter out seen, take 30
    const order = [...Array(N).keys()]
      .filter((i) => !seen[i])
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, N_SHOWN);

    // Task 4: Show the new top 30 films
    setShown(order);
    setSeen((s) => ({ ...s, ...Object.fromEntries(order.map((i) => [i, true])) }));
  }

  // Load all the vectors of 5,000 films
  useEffect(() => {
    fetch("/vectors.bin")
      .then((res) => res.arrayBuffer())
      .then((buf) => setVecs(new Float32Array(buf)));
  }, []);

  // Load all the films with their field content
  // Set the shown batch of films
  // Add the shown films to `seen`
  useEffect(() => {
    fetch("/films.json")
      .then((res) => res.json())
      .then((data) => {
        const first = [...Array(N_SHOWN).keys()];
        setFilms(data.films);
        setMasks(data.fields.map((f) => data.masks[f]));
        setShown(first);
        setSeen(Object.fromEntries(first.map((i) => [i, true])));
      })
      .catch((err) => console.log(err));
  }, []);

  // If the data is not there, render something else and stop
  if (!films.length || !vecs) return <p>Loading...</p>;

  return (
    <>
      {shown.length === 0 ? (
        <p>You have been through everything.</p>
      ) : (
        <div className="grid">
          {shown.map((i) => {
            const f = films[i];
            return (
              <div
                className="card"
                key={f.id}
                data-rating={ratings[i]}
                data-saved={saved[i] || undefined}
              >
                <img src={IMG + f.p} alt={f.t} />
                <div className="title">{f.t}</div>
                <div className="year">{f.y}</div>
                <div className="marks">
                  <button
                    className={ratings[i] === "up" ? "on" : undefined}
                    onClick={() => rate(i, "up")}
                  >
                    like
                  </button>
                  <button
                    className={ratings[i] === "down" ? "on" : undefined}
                    onClick={() => rate(i, "down")}
                  >
                    no
                  </button>
                  <button
                    className={saved[i] === true ? "on" : undefined}
                    onClick={() => toggleSave(i)}
                  >
                    save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button className="refresh" onClick={rerank}>
        Refresh
      </button>
    </>
  );
}
