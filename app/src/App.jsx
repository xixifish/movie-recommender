import { useState, useEffect } from 'react';
import "./App.css";

const IMG = "https://image.tmdb.org/t/p/w185"

export default function App() {
  const [films, setFilms] = useState([]);

  useEffect(() => {
    fetch("/films.json")
      .then((res) => res.json())
      .then((data) => setFilms(data.films));
  }, []);

  return (
    <div className="grid">
      {films.slice(0, 24).map((f) => (
        <div className="card" key={f.id}>
          <img src={IMG + f.p} alt={f.t} />
          <div className='title'>{f.t}</div>
          <div className='year'>{f.y}</div>
        </div>
      ))}
    </div>
  )
}
