import { useEffect, useState } from "react";
import { ICON_CLOSE, ICON_SAVE, THUMB_DOWN, THUMB_UP, ICON_PLAY } from "./icons";
import { runtime } from "./format";
import "./Details.css";

const IMG = "https://image.tmdb.org/t/p/w780";
const YOUTUBE = "https://www.youtube-nocookie.com/embed/";

export default function Details({
  film,
  details,
  index,
  rating,
  saved,
  onRate,
  onSave,
  onClose,
}) {
  const overview = details?.overview[index] ?? "";
  const director = details?.director[index] ?? "";
  const cast = details?.cast[index] ?? "";
  const src = `${YOUTUBE}${film.tr}?autoplay=1`;

  const [playing, setPlaying] = useState(false);

  // touch devices block autoplay, so the facade costs an extra tap there
  const touch = window.matchMedia("(hover: none)").matches;
  const showPlayer = film.tr && (playing || touch);

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
      <div className="panel">
        <button className="close" onClick={onClose} aria-label="Close">
          {ICON_CLOSE}
        </button>
        <div className="details">
          <div className="stage">
            {showPlayer ? (
              <iframe
                className="media"
                src={src}
                title={`${film.t} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                <img className="media" src={IMG + (film.b || film.p)} alt="" />
                {film.tr && (
                  <button
                    className="play"
                    onClick={() => setPlaying(true)}
                    aria-label="Play trailer"
                  >
                    {ICON_PLAY}
                  </button>
                )}
              </>
            )}
          </div>
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
            <div className="actions">
              <div className="group">
                <p className="label">Save it for later</p>
                <button
                  className={saved ? "on" : undefined}
                  onClick={() => onSave(index)}
                  title="Save"
                  aria-label="Save"
                >
                  {ICON_SAVE}
                </button>
              </div>
              <div className="group">
                <p className="label">Watched? How do you feel?</p>
                <div className="row">
                  <button
                    className={
                      rating === "up" ? "on" : rating === "down" ? "gone" : undefined
                    }
                    onClick={() => onRate(index, "up")}
                    title="Like"
                    aria-label="Like"
                  >
                    {THUMB_UP}
                  </button>
                  <button
                    className={
                      rating === "down" ? "on" : rating === "up" ? "gone" : undefined
                    }
                    onClick={() => onRate(index, "down")}
                    title="Dislike"
                    aria-label="Dislike"
                  >
                    {THUMB_DOWN}
                  </button>
                </div>
              </div>
            </div>
            <p className="overview">
              <span className="label">Overview: </span>
              {overview}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
