// React import not needed for functional components
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";


import yoga1 from "../../utils/images/yoga1.png";
import yoga2 from "../../utils/images/yoga2.png";
import yoga3 from "../../utils/images/yoga3.png";
import yoga4 from "../../utils/images/yoga4.png";
import yoga5 from "../../utils/images/yoga5.png";
import yoga6 from "../../utils/images/yoga6.png";

import "./Home.css";

export default function Home() {
  const { user, logout, apiStatus, currentApiUrl, checkApiHealth } = useAuth();
  const photos = [yoga1, yoga2, yoga3, yoga4, yoga5, yoga6];

  const getApiStatusInfo = () => {
    switch (apiStatus) {
      case 'production':
        return { text: '🌐 Production', color: '#4CAF50', title: 'Connected to Render server' };
      case 'local':
        return { text: '🏠 Local', color: '#FF9800', title: 'Connected to local server' };
      case 'offline':
        return { text: '❌ Offline', color: '#F44336', title: 'No server connection' };
      default:
        return { text: '🔄 Checking', color: '#2196F3', title: 'Checking server status' };
    }
  };

  const statusInfo = getApiStatusInfo();

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
        <div className="header-buttons">
          <span className="welcome-text">Welcome, {user?.username || user?.profile?.firstName || 'Yogi'}!</span>
          <div 
            className="api-status" 
            style={{ 
              background: statusInfo.color, 
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            title={statusInfo.title}
            onClick={checkApiHealth}
          >
            {statusInfo.text}
          </div>
          <Link to="/about">
            <button className="btn btn-secondary">About</button>
          </Link>
          <Link to="/settings">
            <button className="btn btn-secondary">⚙️</button>
          </Link>
          <button onClick={logout} className="btn btn-secondary logout-btn">
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="home-main">
        <h1 className="description">Posture Detection</h1>

        <div className="btn-section">
          <Link to="/yoga">
            <button className="btn start-btn">🧘‍♀️ Quick Practice</button>
          </Link>
          <Link to="/flows">
            <button className="btn start-btn">🔄 Yoga Flows</button>
          </Link>
          <Link to="/progress">
            <button className="btn start-btn">📊 My Progress</button>
          </Link>
          <Link to="/tutorials">
            <button className="btn start-btn">📚 Tutorials</button>
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
