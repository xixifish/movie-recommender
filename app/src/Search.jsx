import { LOGO, ICON_SEARCH } from "./icons.jsx";
import "./Search.css";

const EXAMPLES = [
  "makes me cry",
  "time travel",
  "a road trip",
  "Tom Hanks",
  "something funny",
  "vampire",
  "witches and wizards",
];

export default function Search({
  text,
  setText,
  runSearch,
  reset,
  searching,
  compact,
  progress,
  loading,
}) {
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
            <span>
              POP<span className="corn">CORN</span>
            </span>
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
          <input
            id="q"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What do you feel like watching?"
          />
          <button
            type="submit"
            className={loading ? "loading" : undefined}
            disabled={searching}
            aria-label="Search"
            style={{ "--progress": progress }}
          >
            {ICON_SEARCH}
          </button>
        </form>
        <div className="chips">
          {EXAMPLES.map((q) => (
            <button key={q} onClick={() => onChip(q)}>
              {q}
            </button>
          ))}
        </div>
        {!compact && (
          <picture className="art">
            <source
              srcSet="/landing-still.webp"
              media="(prefers-reduced-motion: reduce)"
            />
            <img src="/landing.webp" alt="" width={450} height={343} />
          </picture>
        )}
      </div>
    </div>
  );
}
