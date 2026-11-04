import { useEffect, useState } from "react";
import { ICON_CLOSE } from "./icons";
import "./Details.css";
import "./Share.css";

const TMDB = "https://www.themoviedb.org/movie/";

// Phones, and some desktop browsers, can open the system share menu
const CAN_SHARE = typeof navigator.share === "function";

export default function Share({ films, saved, onClose }) {
  // Content in textarea
  const [text, setText] = useState(() => {
    const savedIndexes = Object.keys(saved)
      .filter((k) => saved[k])
      .map(Number);
    const defaultText = savedIndexes
      .map((index) => {
        const film = films[index];
        return `${film.t} (${film.y}): ${TMDB}${film.id}`;
      })
      .join("\n");
    return defaultText;
  });

  // Counts the copies, 0 = not showing "Copied"
  // A new number on each copy restarts the 2 second timer below
  const [copied, setCopied] = useState(0);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Show "Copied" for 2 secs. The cleanup stops the old timer when the
  // user copies again, or when the dialog closes first.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(0), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied((n) => n + 1);
    } catch {
      // Copying was blocked. The user can still select the text by hand.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Saved films", text });
    } catch (err) {
      // Closing the share menu is not an error
      if (err.name !== "AbortError") console.error(err);
    }
  }

  function email() {
    const subject = encodeURIComponent("Saved films");
    const body = encodeURIComponent(text);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div
      className="backdrop share-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel share"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <button className="close" onClick={onClose} aria-label="Close">
          {ICON_CLOSE}
        </button>
        <h2 id="share-title">Saved films</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Saved films list"
          spellCheck={false}
        />
        <div className="row">
          {!CAN_SHARE && (
            <p className="hint">
              Email opens your mail app. If nothing happens, use Copy.
            </p>
          )}
          {CAN_SHARE ? (
            <button className="secondary" onClick={share}>
              Share
            </button>
          ) : (
            <button className="secondary" onClick={email}>
              Email
            </button>
          )}
          <button className="primary" onClick={copy}>
            {copied ? (
              <>
                <span aria-hidden="true">✓</span> Copied
              </>
            ) : (
              "Copy"
            )}
          </button>
        </div>
        {/* Tells screen readers the copy worked */}
        <p className="visually-hidden" aria-live="polite">
          {copied ? "Copied" : ""}
        </p>
      </div>
    </div>
  );
}
