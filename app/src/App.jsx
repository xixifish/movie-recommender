import { useState, useEffect } from "react";
import "./App.css";

import { N, scoreAll } from "./rank.js";

const IMG = "https://image.tmdb.org/t/p/w185";
const N_SHOWN = 30;

const THUMB_UP = (
  <svg viewBox="0 0 16 16">
    <path d="M9.99992 3.91992L9.33325 6.66658H13.2199C13.4269 6.66658 13.6311 6.71478 13.8162 6.80735C14.0013 6.89992 14.1624 7.03432 14.2866 7.19992C14.4108 7.36551 14.4947 7.55775 14.5317 7.7614C14.5688 7.96506 14.5579 8.17454 14.4999 8.37325L12.9466 13.7066C12.8658 13.9835 12.6974 14.2268 12.4666 14.3999C12.2358 14.573 11.9551 14.6666 11.6666 14.6666H2.66659C2.31296 14.6666 1.97382 14.5261 1.72378 14.2761C1.47373 14.026 1.33325 13.6869 1.33325 13.3333V7.99992C1.33325 7.6463 1.47373 7.30716 1.72378 7.05711C1.97382 6.80706 2.31296 6.66658 2.66659 6.66658H4.50659C4.75464 6.66645 4.99774 6.59713 5.20856 6.4664C5.41937 6.33567 5.58953 6.14873 5.69992 5.92659L7.99992 1.33325C8.3143 1.33715 8.62374 1.41203 8.90512 1.55232C9.1865 1.6926 9.43254 1.89466 9.62485 2.14339C9.81717 2.39212 9.9508 2.68109 10.0157 2.98872C10.0807 3.29635 10.0753 3.61468 9.99992 3.91992Z" />
  </svg>
);
const THUMB_DOWN = (
  <svg viewBox="0 0 16 16">
    <path d="M6.00011 12.0799L6.66678 9.33325H2.78011C2.57312 9.33325 2.36897 9.28506 2.18383 9.19249C1.99869 9.09992 1.83764 8.96551 1.71344 8.79992C1.58925 8.63432 1.50531 8.44209 1.46828 8.23843C1.43126 8.03478 1.44215 7.8253 1.50011 7.62658L3.05344 2.29325C3.13422 2.0163 3.30265 1.77301 3.53344 1.59992C3.76424 1.42682 4.04495 1.33325 4.33344 1.33325H13.3334C13.6871 1.33325 14.0262 1.47373 14.2763 1.72378C14.5263 1.97382 14.6668 2.31296 14.6668 2.66659V7.99992C14.6668 8.35354 14.5263 8.69268 14.2763 8.94273C14.0262 9.19278 13.6871 9.33325 13.3334 9.33325H11.4934C11.2454 9.33338 11.0023 9.40271 10.7915 9.53344C10.5807 9.66417 10.4105 9.85111 10.3001 10.0733L8.00011 14.6666C7.68573 14.6627 7.37628 14.5878 7.09491 14.4475C6.81353 14.3072 6.56749 14.1052 6.37517 13.8564C6.18286 13.6077 6.04923 13.3187 5.98429 13.0111C5.91934 12.7035 5.92475 12.3852 6.00011 12.0799Z" />
  </svg>
);

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
                  <div className="rating">
                    {ratings[i] !== "down" && (
                      <button
                        className={ratings[i] === "up" ? "on" : undefined}
                        onClick={() => rate(i, "up")}
                      >
                        {THUMB_UP}
                      </button>
                    )}
                    {ratings[i] !== "up" && (
                      <button
                        className={ratings[i] === "down" ? "on" : undefined}
                        onClick={() => rate(i, "down")}
                      >
                        {THUMB_DOWN}
                      </button>
                    )}
                  </div>
                </div>
                <div className="title">{f.t}</div>
                <div className="year">{f.y}</div>
                <div className="marks">
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
