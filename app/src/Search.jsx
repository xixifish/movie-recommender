import { LOGO, ICON_SEARCH } from "./icons.jsx";
import "./Search.css";

const EXAMPLES = [
  "makes me cry",
  "time travel",
  "a road trip",
  "something funny",
  "vampire",
  "witches and wizards",
  "Tom Hanks",
];

export default function Search({ text, setText, runSearch, reset, searching, compact }) {
  const chips = compact ? EXAMPLES.slice(0, 3) : EXAMPLES;

  function onSubmit(e) {
    e.preventDefault();
    runSearch(text);
  }

  function onChip(q) {
    setText(q);
    runSearch(q);
  }

  return (
    <div className={compact ? "search-bar compact" : "search-bar"}>
      <div className="search-wrap">
        <header className="top">
          <button className="logo" onClick={reset} aria-label="Start again">
            {LOGO}
            <span>POPCORN</span>
          </button>
        </header>
        {!compact && (
          <section className="hero">
            <p className="eyebrow">FIND FILMS TO YOUR TASTE · NO SIGN IN</p>
            <h1>
              <span className="lighter">Start with an idea.</span>
              <br />
              <span className="light">Mark a few. </span>
              <span className="white">Get closer.</span>
            </h1>
          </section>
        )}
        <form className="search" onSubmit={onSubmit}>
          <span className="search-icon">{ICON_SEARCH}</span>
          <input
            id="q"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Anything you feel like watching"
          />
          <button type="submit" disabled={searching}>
            {searching ? "Searching" : "Search"}
          </button>
        </form>
        <div className="chips">
          {chips.map((q) => (
            <button key={q} onClick={() => onChip(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
