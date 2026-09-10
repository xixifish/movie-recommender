import { useState, useEffect } from "react";
import "./App.css";

import { N, scoreAll } from "./rank.js";

const IMG = "https://image.tmdb.org/t/p/w185";
const N_SHOWN = 30;

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

  // Refresh
  function rerank() {
    if (!vecs || !masks) return;

    const scores = scoreAll({ vecs, masks, ratings, saved, films });
    if (scores === null) {
      const next = [];
      for (let i = 0; i < N && next.length < N_SHOWN; i++) {
        if (!seen[i]) next.push(i);
      }
      setShown(next);
      setSeen((s) => ({ ...s, ...Object.fromEntries(next.map((i) => [i, true])) }));
      return;
    }

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
                <div className="poster">
                  <img src={IMG + f.p} alt={f.t} />
                </div>
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
