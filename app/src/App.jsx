import {
  THUMB_UP,
  THUMB_DOWN,
  ICON_SAVE,
  ICON_REFRESH,
  ICON_SEND,
  TMDB_LOGO,
} from "./icons.jsx";
import Search from "./Search.jsx";
import Card from "./Card.jsx";

import { useState, useEffect, useRef } from "react";
import "./App.css";

import { N, scoreAll, D } from "./rank.js";

const N_SHOWN = 48; // 6 film per row on screen

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

  const [defaultList, setDefaultList] = useState([]);

  const skipScroll = useRef(false);

  // Tap logo to reset the page
  function reset() {
    skipScroll.current = true;
    const first = defaultList.slice(0, N_SHOWN);
    setText("");
    setQuery(null);
    setRatings({});
    setMenuOpen(null);
    setOverviewOpen(null);
    setTab("films");
    setShown(first);
    setSeen(Object.fromEntries(first.map((i) => [i, true])));
  }

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
  function rerank(q = query, alreadyShown = seen) {
    if (!vecs || !masks) return;

    const scores = scoreAll({ vecs, masks, ratings, saved, films, query: q });
    if (scores === null) {
      const next = defaultList.filter((i) => !alreadyShown[i]).slice(0, N_SHOWN);
      // If the films in next are fewer than N_SHOWN, take the film from the catalogue to fill
      for (let i = 0; i < N && next.length < N_SHOWN; i++) {
        if (!alreadyShown[i] && !next.includes(i)) next.push(i);
      }
      setShown(next);
      setSeen((prev) => ({ ...prev, ...Object.fromEntries(next.map((i) => [i, true])) }));
      return;
    }

    // Task 3: Sort, filter out seen, take 50
    const order = [...Array(N).keys()]
      .filter((i) => !alreadyShown[i])
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, N_SHOWN);

    // Task 4: Show the new top 50 films
    setShown(order);
    setSeen((prev) => ({ ...prev, ...Object.fromEntries(order.map((i) => [i, true])) }));
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
    async function load() {
      const [filmsRes, vecRes] = await Promise.all([
        fetch("/films.json"),
        fetch("/vectors.bin"),
      ]);

      const data = await filmsRes.json();
      const first = data.default.slice(0, N_SHOWN);
      setFilms(data.films);
      setMasks(data.fields.map((f) => data.masks[f]));
      setDefaultList(data.default);
      setShown(first);
      setSeen(Object.fromEntries(first.map((i) => [i, true])));

      if (data.dims !== D) {
        console.error(`films.json says ${data.dims} dims, rank.js says ${D}`);
      }

      // int8 back to floats, once, so the scoring loop stays unchanged
      const bytes = new Int8Array(await vecRes.arrayBuffer());
      const vals = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) vals[i] = (bytes[i] * data.scale) / 127;
      setVecs(vals);
    }
    load();
  }, []);

  // Refresh and jump to the list top
  const listTop = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    listTop.current?.scrollIntoView({ block: "start" });
  }, [shown]);

  // If the data is not there, render something else and stop
  if (!films.length || !vecs) return <p>Loading...</p>;

  return (
    <>
      <Search text={text} setText={setText} runSearch={runSearch} reset={reset} />
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
              key={i}
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
      <footer className="credit">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          {TMDB_LOGO}
        </a>
        <p>
          This website uses TMDB and the TMDB APIs but is not endorsed, certified, or
          otherwise approved by TMDB.
        </p>
      </footer>
    </>
  );
}
