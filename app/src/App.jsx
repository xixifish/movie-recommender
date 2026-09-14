import {
  THUMB_UP,
  THUMB_DOWN,
  ICON_CLOSE,
  ICON_DOTS,
  ICON_INFO,
  ICON_SAVE,
  ICON_REFRESH,
  ICON_SEND,
} from "./icons.jsx";
import Search from "./Search.jsx";

import { useState, useEffect, useRef } from "react";
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

  const [menuOpen, setMenuOpen] = useState(null); // index of the open card, or null

  const [overviews, setOverviews] = useState(null); // loaded on first open
  const [overviewOpen, setOverviewOpen] = useState(null); // index or null

  const [text, setText] = useState(""); // what is typed
  const [query, setQuery] = useState(null); // the vector it became

  // Hint bars
  const [dismissed, setDismissed] = useState(() => ({
    films: localStorage.getItem("hint.films") === "1",
    saved: localStorage.getItem("hint.saved") === "1",
  }));

  function dismiss(which) {
    setDismissed((d) => ({ ...d, [which]: true }));
    localStorage.setItem(`hint.${which}`, "1");
  }

  const [tab, setTab] = useState("films");
  const [savedList, setSavedList] = useState([]);

  const list = tab === "saved" ? savedList : shown;

  function openSaved() {
    setSavedList(
      Object.keys(saved)
        .filter((k) => saved[k])
        .map(Number),
    );
    setTab("saved");
  }

  async function runSearch(q) {
    if (!q.trim()) return;

    const res = await fetch("http://localhost:8000/embed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q }),
    });

    const data = await res.json();
    const v = new Float32Array(data.v);

    setQuery(v);
    setSeen({}); // a new query starts a fresh round
    rerank(v, {});
  }

  function onSubmit(e) {
    e.preventDefault();
    runSearch(text);
  }

  function onChip(q) {
    setText(q);
    runSearch(q);
  }

  // Up or down a film
  function rate(i, kind) {
    setRatings((r) => ({ ...r, [i]: r[i] === kind ? undefined : kind }));
  }

  // Save a film
  function toggleSave(i) {
    setSaved((s) => ({ ...s, [i]: s[i] ? undefined : true }));
  }

  // The button group in the top right corner of a card
  function corner(i) {
    const open = menuOpen === i;

    let first;
    if (overviewOpen === i)
      first = (
        <button className="on" onClick={() => setOverviewOpen(null)}>
          {ICON_INFO}
        </button>
      );
    else if (open)
      first = (
        <button className="on" onClick={() => setMenuOpen(null)}>
          {ICON_CLOSE}
        </button>
      );
    else if (saved[i])
      first = (
        <button className="on" onClick={() => toggleSave(i)}>
          {ICON_SAVE}
        </button>
      );
    else first = <button onClick={() => setMenuOpen(i)}>{ICON_DOTS}</button>;

    return (
      <>
        {first}
        <button className={open ? undefined : "gone"} onClick={() => openOverview(i)}>
          {ICON_INFO}
        </button>
        <button
          className={!open ? "gone" : saved[i] ? "on" : undefined}
          onClick={() => {
            toggleSave(i);
            setMenuOpen(null);
          }}
        >
          {ICON_SAVE}
        </button>
      </>
    );
  }

  // Refresh
  function rerank(q = query, s = seen) {
    if (!vecs || !masks) return;

    const scores = scoreAll({ vecs, masks, ratings, saved, films, query: q });
    if (scores === null) {
      const next = [];
      for (let i = 0; i < N && next.length < N_SHOWN; i++) {
        if (!s[i]) next.push(i);
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

  // Open one overview
  function openOverview(i) {
    if (overviews === null) {
      fetch("/overviews.json")
        .then((res) => res.json())
        .then(setOverviews);
    }
    setOverviewOpen(i);
    setMenuOpen(null);
  }

  // Send the saved list to an email address. Not built yet.
  function sendEmail() {}

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

  // Refresh and jump to the list top
  const listTop = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    listTop.current?.scrollIntoView({ block: "start" });
  }, [shown]);

  // If the data is not there, render something else and stop
  if (!films.length || !vecs) return <p>Loading...</p>;

  return (
    <>
      <Search text={text} setText={setText} onSubmit={onSubmit} onChip={onChip} />
      <div className="section">
        <h2>{tab === "films" ? "Recommendations" : "Saved"}</h2>
        <div className="tabs">
          <button
            className={tab === "films" ? "on" : undefined}
            onClick={() => setTab("films")}
          >
            Films
          </button>
          <button className={tab === "saved" ? "on" : undefined} onClick={openSaved}>
            Saved
          </button>
        </div>
      </div>
      {!dismissed[tab] && (
        <div className="hint">
          {tab === "films" ? (
            <>
              <span>{THUMB_UP} Liked</span>
              <span>{THUMB_DOWN} Disliked</span>
              <span>{ICON_SAVE} Save</span>
              <p>The more you mark, the closer the next films get.</p>
            </>
          ) : (
            <p className="plain">
              No sign in needed. Send your saved list to your email.
            </p>
          )}
          <button onClick={() => dismiss(tab)}>Got it</button>
        </div>
      )}
      {list.length === 0 ? (
        <p className="empty">
          {tab === "saved"
            ? "Nothing saved yet. Use the bookmark button on a film you want to keep."
            : "You have been through everything."}
        </p>
      ) : (
        <div className="grid" ref={listTop}>
          {list.map((i, n) => {
            const f = films[i];
            return (
              <div
                className="card"
                key={f.id}
                style={{ animationDelay: `${n * 9}ms` }}
                data-rating={ratings[i]}
                data-saved={saved[i] || undefined}
              >
                <div
                  className={
                    menuOpen === i || overviewOpen === i ? "poster open" : "poster"
                  }
                >
                  <img src={IMG + f.p} alt={f.t} />
                  <div className="rating">
                    <button
                      className={
                        ratings[i] === "up"
                          ? "on"
                          : ratings[i] === "down"
                            ? "gone"
                            : undefined
                      }
                      onClick={() => rate(i, "up")}
                    >
                      {THUMB_UP}
                    </button>
                    <button
                      className={
                        ratings[i] === "down"
                          ? "on"
                          : ratings[i] === "up"
                            ? "gone"
                            : undefined
                      }
                      onClick={() => rate(i, "down")}
                    >
                      {THUMB_DOWN}
                    </button>
                  </div>
                  <div className="menu">{corner(i)}</div>
                  <div className={overviewOpen === i ? "overview" : "overview gone"}>
                    <p>{overviews ? overviews[i] : ""}</p>
                  </div>
                </div>
                <div className="title">{f.t}</div>
                <div className="year">{f.y}</div>
              </div>
            );
          })}
        </div>
      )}
      <button
        className="refresh"
        onClick={tab === "films" ? () => rerank() : sendEmail}
        aria-label={tab === "films" ? "Refresh" : "Send to email"}
      >
        {tab === "films" ? ICON_REFRESH : ICON_SEND}
      </button>
    </>
  );
}
