import { useState, useEffect } from "react";
import "./App.css";

const IMG = "https://image.tmdb.org/t/p/w185";

export default function App() {
  const [films, setFilms] = useState([]);
  const [vecs, setVecs] = useState(null);

  useEffect(() => {
    fetch("/vectors.bin")
      .then((res) => res.arrayBuffer())
      .then((buf) => setVecs(new Float32Array(buf)));
  }, []);

  useEffect(() => {
    fetch("/films.json")
      .then((res) => res.json())
      .then((data) => setFilms(data.films))
      .catch((err) => console.log(err));
  }, []);

  useEffect(() => {
    if (!vecs || !films.length) return;
    console.log("numbers:", vecs.length, "expected:", 5000 * 7 * 384);
    console.log("first 4 of overview:", vecs.slice(0, 4));
  }, [vecs, films]);

  return (
    <div className="grid">
      {films.slice(0, 50).map((f) => (
        <div className="card" key={f.id}>
          <img src={IMG + f.p} alt={f.t} />
          <div className="title">{f.t}</div>
          <div className="year">{f.y}</div>
        </div>
      ))}
    </div>
  );
}
