import { LOGO, ICON_SEARCH } from "./icons.jsx";
import "./Search.css";

const EXAMPLES = ["Christopher Nolan", "time travel", "really scary", "funny", "vampire"];

export default function Search({ text, setText, runSearch }) {
  function onSubmit(e) {
    e.preventDefault();
    runSearch(text);
  }

  function onChip(q) {
    setText(q);
    runSearch(q);
  }

  return (
    <>
      <header className="top">
        <div className="logo">
          {LOGO}
          <span>POPCORN</span>
        </div>
      </header>
      <section className="hero">
        <p className="eyebrow">FIND FILMS TO YOUR TASTE</p>
        <h1>
          Start with a thought.
          <br />
          Mark a few. Get closer.
        </h1>
      </section>
      <form className="search" onSubmit={onSubmit}>
        <span className="search-icon">{ICON_SEARCH}</span>
        <input
          id="q"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anything you feel like watching"
        />
        <button type="submit">Search</button>
      </form>
      <div className="chips">
        {EXAMPLES.map((q) => (
          <button key={q} onClick={() => onChip(q)}>
            {q}
          </button>
        ))}
      </div>
    </>
  );
}
