import { useEffect } from "react";
import { ICON_CLOSE } from "./icons";
import { runtime } from "./format";
import "./Details.css";

const IMG = "https://image.tmdb.org/t/p/w780";

export default function Details({ film, details, index, onClose }) {
  const overview = details?.overview[index] ?? "";
  const director = details?.director[index] ?? "";
  const cast = details?.cast[index] ?? "";
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="details">
        <button className="close" onClick={onClose} aria-label="Close">
          {ICON_CLOSE}
        </button>
        <img className="media" src={IMG + (film.b || film.p)} alt="" />
        <div className="info">
          <h2>{film.t}</h2>
          <p className="meta">
            {film.y} · {runtime(film.r)}
            {film.c && ` · ${film.c}`}
          </p>
          <p>
            <span className="label">Directors: </span>
            {director}
          </p>
          <p>
            <span className="label">Cast: </span>
            {cast}
          </p>
          <p className="overview">
            <span className="label">Overview: </span>
            {overview}
          </p>
        </div>
      </div>
    </div>
  );
}
