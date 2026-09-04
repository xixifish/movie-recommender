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

export default function App() {
  const [films, setFilms] = useState([]); // films
  const [vecs, setVecs] = useState(null); // vector numbers of all films
  const [ratings, setRatings] = useState({}); // { index: "up" | "down" }
  const [saved, setSaved] = useState({}); // { index: true }
  // which films are on screen, by index (index is how to find a film's vector)
  const [shown, setShown] = useState([]);
  const [seen, setSeen] = useState({});

  // Up or down a film
  function rate(i, kind) {
    setRatings((r) => ({ ...r, [i]: r[i] === kind ? undefined : kind }));
  }

  // Save a film
  function toggleSave(i) {
    setSaved((s) => ({ ...s, [i]: s[i] ? undefined : true }));
  }

  // Get a film's vector
  function vecFor(iField, iFilm) {
    const start = (iField * N + iFilm) * D;
    return vecs.subarray(start, start + D);
  }

  // Add vector
  function addInto(target, source) {
    for (let d = 0; d < D; d++) target[d] += source[d];
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
      if (ratings[key] === "up") {
        nUp++;
        addInto(liked, vecFor(iField, Number(key)));
      }
      if (ratings[key] === "down") {
        nDown++;
        addInto(disliked, vecFor(iField, Number(key)));
      }
    }

    for (const key in saved) {
      if (saved[key]) {
        nSaved++;
        addInto(saveds, vecFor(iField, Number(key)));
      }
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

  // Normalise the taste vector
  function normalise(taste) {
    if (!taste) return;

    let sumSquare = 0;
    for (let d = 0; d < D; d++) {
      sumSquare += taste[d] * taste[d];
    }
    let vecLength = Math.sqrt(sumSquare);
    for (let d = 0; d < D; d++) {
      taste[d] /= vecLength;
    }
  }

  // Score all the 5,000 films over one field
  // work for any query vector, from marks or from search
  function scoreField(iField, query) {
    const scores = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = vecFor(iField, i);
      let s = 0;
      for (let d = 0; d < D; d++) s += query[d] * v[d];
      scores[i] = s;
    }
    return scores;
  }

  // Refresh
  function rerank() {
    if (!vecs) return;

    // Task 1: Calculate the taste vector based on the marked films
    const taste = tasteFor(0);

    // If user didn't mark any films, display next 30 films from films.json
    if (taste === null) {
      const next = [];
      for (let i = 0; i < N && next.length < N_SHOWN; i++) {
        if (!seen[i]) next.push(i);
      }
      setShown(next);
      setSeen((s) => ({ ...s, ...Object.fromEntries(next.map((i) => [i, true])) }));
      return;
    }

    // Task 2: Normalise the taste vector
    normalise(taste);

    // Task 3: Score all 5,000 films
    const scores = scoreField(0, taste);
    for (let i = 0; i < N; i++) scores[i] *= 1 + W_QUALITY * films[i].q;

    // Task 4: Sort, filter out seen, take 30
    const order = [...Array(N).keys()]
      .filter((i) => !seen[i])
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, N_SHOWN);

    // Task 5: Show the new top 30 films
    setShown(order);
    setSeen((s) => ({ ...s, ...Object.fromEntries(order.map((i) => [i, true])) }));
  }

  useEffect(() => {
    fetch("/vectors.bin")
      .then((res) => res.arrayBuffer())
      .then((buf) => setVecs(new Float32Array(buf)));
  }, []);

  useEffect(() => {
    fetch("/films.json")
      .then((res) => res.json())
      .then((data) => {
        const first = [...Array(N_SHOWN).keys()];
        setFilms(data.films);
        setShown(first);
        setSeen(Object.fromEntries(first.map((i) => [i, true])));
      })
      .catch((err) => console.log(err));
  }, []);

  // If the data is not there, render something else and stop
  if (!films.length || !vecs) return <p>Loading...</p>;

  return (
    <>
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
      <button className="refresh" onClick={rerank}>
        Refresh
      </button>
    </>
  );
}
