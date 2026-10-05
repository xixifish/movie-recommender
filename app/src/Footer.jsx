import "./Footer.css";
import { TMDB_LOGO } from "./icons";

export default function Footer() {
  return (
    <footer className="credit">
      <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
        {TMDB_LOGO}
      </a>
      <p>
        This website uses TMDB and the TMDB APIs but is not endorsed, certified, or
        otherwise approved by TMDB.
      </p>
    </footer>
  );
}
