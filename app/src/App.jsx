import { useState, useEffect } from "react";
import "./App.css";

const IMG = "https://image.tmdb.org/t/p/w185";
const N = 5000; // films
const D = 384; // dimensions

export default function App() {
  const [films, setFilms] = useState([]); // films
  const [vecs, setVecs] = useState(null); // vector numbers of all films
  const [ratings, setRatings] = useState({}); // { index: "up" | "down" }
  const [saved, setSaved] = useState({}); // { index: true }
  // which films are on screen, by index (index is how to find a film's vector)
  const [shown, setShown] = useState([]);

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

  // Refresh
  function rerank() {}

  useEffect(() => {
    fetch("/vectors.bin")
      .then((res) => res.arrayBuffer())
      .then((buf) => setVecs(new Float32Array(buf)));
  }, []);

  useEffect(() => {
    fetch("/films.json")
      .then((res) => res.json())
      .then((data) => setFilms(data.films))
      .catch((err) => console.log(err));
  }, []);

  useEffect(() => {
    if (films.length) setShown([...Array(50).keys()]);
  }, [films]);

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
