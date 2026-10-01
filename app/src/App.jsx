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
import Details from "./Details.jsx";

import { useState, useEffect, useRef } from "react";
import "./App.css";

import { N, scoreAll, D } from "./rank.js";

const N_SHOWN = 48; // 6 film per row on screen

const API = import.meta.env.VITE_API || "http://localhost:8000";

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

  const [details, setDetails] = useState(null); // overview, cast, director
  const [detailsOpen, setDetailsOpen] = useState(null); // index or null

  const [text, setText] = useState(""); // what is typed
  const [query, setQuery] = useState(null); // the vector it became

  const skipScroll = useRef(false);

  const [searching, setSearching] = useState(false);

  const [roundSaves, setRoundSaves] = useState({});

  // Tap logo to reset the page
  function reset() {
    skipScroll.current = true;
    setText("");
    setQuery(null);
    setRatings({});
    setMenuOpen(null);
    setDetailsOpen(null);
    setTab("films");
    setShown([]);
    setSeen({});
    setRoundSaves({});
  }

  // Hint bars
  const [dismissed, setDismissed] = useState(() => ({
    films: localStorage.getItem("hint.films") === "1",
    saved: localStorage.getItem("hint.saved") === "1",
  }));

  // Saved and rated hints
  const [hasSaved, setHasSaved] = useState(
    () => localStorage.getItem("hasSaved") === "1",
  );
  const [hasRated, setHasRated] = useState(
    () => localStorage.getItem("hasRated") === "1",
  );

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

    setSearching(true);
    try {
      const res = await fetch(`${API}/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = await res.json();
      const v = new Float32Array(data.v);

      setQuery(v);
      setRatings({}); // liked and disliked belonged to the old query
      setRoundSaves({});
      setSeen({}); // a new query starts a fresh round
      rerank(v, {}, { ratings: {}, saved: {} });
    } catch (err) {
      console.log(err);
    } finally {
      setSearching(false);
    }
  }

  // Up or down a film
  // Mark rated hint to disappear
  function rate(i, kind) {
    setRatings((r) => ({ ...r, [i]: r[i] === kind ? undefined : kind }));
    if (!hasRated) {
      setHasRated(true);
      localStorage.setItem("hasRated", "1");
    }
  }

  // Save a film
  // Mark saved hint to disappear
  function toggleSave(i) {
    setSaved((s) => ({ ...s, [i]: s[i] ? undefined : true }));
    setRoundSaves((s) => ({ ...s, [i]: s[i] ? undefined : true }));
    if (!hasSaved) {
      setHasSaved(true);
      localStorage.setItem("hasSaved", "1");
    }
  }

  // Refresh
  function rerank(
    q = query,
    alreadyShown = seen,
    marks = { ratings, saved: roundSaves },
  ) {
    if (!vecs || !masks) return;

    const marked = (i) => saved[i];

    const scores = scoreAll({
      vecs,
      masks,
      ratings: marks.ratings,
      saved: marks.saved,
      films,
      query: q,
    });
    if (scores === null) return;

    // Task 3: Sort, filter out seen, take 50
    const order = [...Array(N).keys()]
      .filter((i) => !alreadyShown[i] && !marked(i))
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, N_SHOWN);

    // Task 4: Show the new top 50 films
    setShown(order);
    setSeen((prev) => ({ ...prev, ...Object.fromEntries(order.map((i) => [i, true])) }));
  }

  // cache details.json if it doesn't exist
  function openDetails(i) {
    if (details === null) {
      fetch("/details.json")
        .then((res) => res.json())
        .then(setDetails);
    }
    setDetailsOpen(i);
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
      setFilms(data.films);
      setMasks(data.fields.map((f) => data.masks[f]));

      // Bring back what was saved last time, by film id
      const byId = new Map(data.films.map((f, i) => [f.id, i]));
      const ids = JSON.parse(localStorage.getItem("saved") || "[]");
      setSaved(
        Object.fromEntries(
          ids.map((id) => [byId.get(id), true]).filter(([i]) => i !== undefined),
        ),
      );

      if (data.dims !== D) {
        console.error(`films.json says ${data.dims} dims, rank.js says ${D}`);
      }

      // int8 back to floats, once, so the scoring loop stays unchanged
      const bytes = new Int8Array(await vecRes.arrayBuffer());
      const vals = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) vals[i] = (bytes[i] * data.scale) / 127;
      setVecs(vals);

      // warm the cache so the first open modal has no empty state
      fetch("/details.json")
        .then((res) => res.json())
        .then(setDetails);
    }
    load();
  }, []);

  // remember the saved list between visits, by film id not index
  useEffect(() => {
    if (!films.length) return;
    const ids = Object.keys(saved)
      .filter((k) => saved[k])
      .map((k) => films[k].id);
    localStorage.setItem("saved", JSON.stringify(ids));
  }, [saved, films]);

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
      <Search
        text={text}
        setText={setText}
        runSearch={runSearch}
        reset={reset}
        searching={searching}
      />
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
        <div className={searching ? "grid dim" : "grid"} ref={listTop}>
          {list.map((i, n) => (
            <Card
              key={i}
              film={films[i]}
              index={i}
              order={n}
              rating={ratings[i]}
              saved={!!saved[i]}
              menuOpen={menuOpen === i}
              onRate={rate}
              onSave={toggleSave}
              onOpenMenu={setMenuOpen}
              onOpenDetails={openDetails}
              hasRated={hasRated}
              hasSaved={hasSaved}
            />
          ))}
        </div>
      )}
      {detailsOpen !== null && (
        <Details
          key={detailsOpen}
          film={films[detailsOpen]}
          details={details}
          index={detailsOpen}
          rating={ratings[detailsOpen]} // rating has three values: "up", "down", or undefined
          saved={!!saved[detailsOpen]} // saved has two values: true or undefined
          onRate={rate}
          onSave={toggleSave}
          onClose={() => setDetailsOpen(null)}
        />
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
