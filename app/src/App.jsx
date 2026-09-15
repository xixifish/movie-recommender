import { THUMB_UP, THUMB_DOWN, ICON_SAVE, ICON_REFRESH, ICON_SEND } from "./icons.jsx";
import Search from "./Search.jsx";
import Card from "./Card.jsx";

import { useState, useEffect, useRef } from "react";
import "./App.css";

import { N, scoreAll } from "./rank.js";

const N_SHOWN = 50;

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

  // Up or down a film
  function rate(i, kind) {
    setRatings((r) => ({ ...r, [i]: r[i] === kind ? undefined : kind }));
  }

  // Save a film
  function toggleSave(i) {
    setSaved((s) => ({ ...s, [i]: s[i] ? undefined : true }));
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
      <Search text={text} setText={setText} runSearch={runSearch} />
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
          {list.map((i, n) => (
            <Card
              key={films[i].id}
              film={films[i]}
              index={i}
              order={n}
              rating={ratings[i]}
              saved={!!saved[i]}
              menuOpen={menuOpen === i}
              overviewOpen={overviewOpen === i}
              overview={overviews ? overviews[i] : ""}
              onRate={rate}
              onSave={toggleSave}
              onOpenMenu={setMenuOpen}
              onOpenOverview={openOverview}
              onCloseOverview={() => setOverviewOpen(null)}
            />
          ))}
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
