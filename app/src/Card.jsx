import {
  THUMB_UP,
  THUMB_DOWN,
  ICON_CLOSE,
  ICON_DOTS,
  ICON_INFO,
  ICON_SAVE,
} from "./icons.jsx";

import "./Card.css";

const IMG = "https://image.tmdb.org/t/p/w342";

export default function Card({
  film,
  index,
  order,
  rating,
  saved,
  menuOpen,
  overviewOpen,
  overview,
  onRate,
  onSave,
  onOpenMenu,
  onOpenOverview,
  onCloseOverview,
}) {
  // The button group in the top right corner of a card
  function corner() {
    let first;
    if (overviewOpen)
      first = (
        <button
          className="on"
          onClick={onCloseOverview}
          title="Film Overview"
          aria-label="Film Overview"
        >
          {ICON_INFO}
        </button>
      );
    else if (menuOpen)
      first = (
        <button
          className="on"
          onClick={() => onOpenMenu(null)}
          title="Close"
          aria-label="Close"
        >
          {ICON_CLOSE}
        </button>
      );
    else if (saved)
      first = (
        <button
          className="on"
          onClick={() => onSave(index)}
          title="Save"
          aria-label="Save"
        >
          {ICON_SAVE}
        </button>
      );
    else
      first = (
        <button
          onClick={() => onOpenMenu(index)}
          title="Overview & Save"
          aria-label="Overview & Save"
        >
          {ICON_DOTS}
        </button>
      );

    return (
      <>
        {first}
        <button
          className={menuOpen ? undefined : "gone"}
          onClick={() => onOpenOverview(index)}
          title="Film Overview"
          aria-label="Film Overview"
        >
          {ICON_INFO}
        </button>
        <button
          className={!menuOpen ? "gone" : saved ? "on" : undefined}
          onClick={() => {
            onSave(index);
            onOpenMenu(null);
          }}
          title="Save"
          aria-label="Save"
        >
          {ICON_SAVE}
        </button>
      </>
    );
  }

  return (
    <div
      className="card"
      style={{ animationDelay: `${order * 9}ms` }}
      data-rating={rating}
      data-saved={saved || undefined}
    >
      <div className={menuOpen || overviewOpen ? "poster open" : "poster"}>
        <img src={IMG + film.p} alt={film.t} loading="lazy" decoding="async" />
        <div className="rating">
          <button
            className={rating === "up" ? "on" : rating === "down" ? "gone" : undefined}
            onClick={() => onRate(index, "up")}
            title="Like"
            aria-label="Like"
          >
            {THUMB_UP}
          </button>
          <button
            className={rating === "down" ? "on" : rating === "up" ? "gone" : undefined}
            onClick={() => onRate(index, "down")}
            title="Dislike"
            aria-label="Dislike"
          >
            {THUMB_DOWN}
          </button>
        </div>
        <div className="menu">{corner()}</div>
        <div className={overviewOpen ? "overview" : "overview gone"}>
          <p>{overview}</p>
        </div>
      </div>
      <div className="title" title={film.t}>
        {film.t}
      </div>
      <div className="year">{film.y}</div>
    </div>
  );
}
