import React from "react";
import { Link } from "react-router-dom";


import yoga1 from "../../utils/images/yoga1.png";
import yoga2 from "../../utils/images/yoga2.png";
import yoga3 from "../../utils/images/yoga3.png";
import yoga4 from "../../utils/images/yoga4.png";
import yoga5 from "../../utils/images/yoga5.png";
import yoga6 from "../../utils/images/yoga6.png";

import "./Home.css";

export default function Home() {
  const photos = [yoga1, yoga2, yoga3, yoga4, yoga5, yoga6];

  const yogaTexts = [
    "BREATHE DEEPLY", "MEDITATION", "YOGA ASANA", "BALANCE", "INNER PEACE",
    "STRETCH DAILY", "FLEXIBILITY", "MINDFULNESS", "FOCUS", "ENERGY",
    "RELAX BODY", "SPIRITUAL GROWTH", "STRENGTH", "CORE POWER", "HEALTH",
    "PATIENCE", "MIND ✨ BODY", "CALMNESS", "STABILITY", "POSITIVITY"
  ];

  return (
    <div className="home-container">

      {/* Background Ticker */}
      <div className="ticker-background">
        {yogaTexts.map((txt, i) => (
          <div key={i} className={`ticker-row row-${i % 4}`}>
            <span>{txt} • {txt} • {txt} • {txt}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="home-header">
        <h1 className="home-heading">PoseMinds</h1>
        <Link to="/about">
          <button className="btn btn-secondary">About</button>
        </Link>
      </header>

      {/* Main */}
      <main className="home-main">
        <h1 className="description">Posture Detection</h1>

        <div className="btn-section">
          <Link to="/yoga">
            <button className="btn start-btn">Let's Start</button>
          </Link>
          <Link to="/tutorials">
            <button className="btn start-btn">Tutorials</button>
          </Link>
        </div>

        {/* Photo Gallery */}
        <div className="photo-gallery">
          {photos.map((src, idx) => (
            <div className="card" key={idx}>
              <img src={src} alt={`Yoga ${idx + 1}`} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
