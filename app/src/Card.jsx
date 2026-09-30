import { THUMB_UP, THUMB_DOWN, ICON_DOTS, ICON_SAVE, ICON_CLOSE } from "./icons.jsx";

import { runtime } from "./format.js";

import "./Card.css";

const IMG = "https://image.tmdb.org/t/p/w342";

export default function Card({
  film,
  index,
  order,
  rating,
  saved,
  menuOpen,
  onRate,
  onSave,
  onOpenMenu,
  onOpenDetails,
}) {
  return (
    <div
      className="card"
      style={{ animationDelay: `${order * 9}ms` }}
      data-rating={rating}
      data-saved={saved || undefined}
    >
      <div className={menuOpen ? "poster open" : "poster"}>
        <img
          src={IMG + film.p}
          alt={film.t}
          loading="lazy"
          decoding="async"
          onClick={() => onOpenDetails(index)}
        />
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
        <div className="menu">
          <button
            className={saved ? "on" : undefined}
            onClick={() => onSave(index)}
            title="Save"
            aria-label="Save"
          >
            {ICON_SAVE}
          </button>
        </div>
      </div>
      <div className="card-foot">
        <div className="text">
          <div className="title" title={film.t}>
            {film.t}
          </div>
          <div className="year">
            {film.y} · {runtime(film.r)}
          </div>
        </div>
        <button
          className="more"
          onClick={() => onOpenMenu(menuOpen ? null : index)}
          title={menuOpen ? "Close" : "More"}
          aria-label={menuOpen ? "Close" : "More"}
        >
          {menuOpen ? ICON_CLOSE : ICON_DOTS}
        </button>
      </div>
    </div>
  );
}
