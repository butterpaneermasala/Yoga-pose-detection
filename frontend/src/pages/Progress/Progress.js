import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import './Progress.css'



export default function Progress() {
  const { getStats, user } = useAuth()
  const [userStats, setUserStats] = useState({
    totalSessions: 0,
    totalTime: 0,
    bestScores: {},
    poseStats: {},
    sessionsThisWeek: 0,
    currentStreak: 0,
    longestStreak: 0,
    averageAccuracy: 0,
    totalPerfectPoses: 0,
    longestHold: 0,
    favoritePoses: [],
    achievements: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const stats = await getStats()
        if (stats) {
          setUserStats(stats)
        }
      } catch (err) {
        setError('Failed to load progress data')
        console.error('Error fetching stats:', err)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchStats()
    }
  }, [user, getStats])

  if (loading) {
    return (
      <div className="progress-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your progress...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="progress-container">
        <div className="error-state">
          <h2>⚠️ {error}</h2>
          <p>Please try refreshing the page or contact support if the issue persists.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="progress-container">
      <h1>Your Yoga Journey</h1>
      <p className="welcome-message">Welcome back, {user?.username || 'Yogi'}! Here's your progress overview.</p>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{userStats.totalSessions || 0}</h3>
          <p>Total Sessions</p>
        </div>
        
        <div className="stat-card">
          <h3>{Math.round((userStats.totalTime || 0) / 60)}m</h3>
          <p>Total Practice Time</p>
        </div>
        
        <div className="stat-card">
          <h3>{userStats.currentStreak || 0}</h3>
          <p>Current Streak</p>
        </div>
        
        <div className="stat-card">
          <h3>{userStats.longestStreak || 0}</h3>
          <p>Longest Streak</p>
        </div>
        
        <div className="stat-card">
          <h3>{Math.round(userStats.averageAccuracy || 0)}%</h3>
          <p>Average Accuracy</p>
        </div>
        
        <div className="stat-card">
          <h3>{userStats.totalPerfectPoses || 0}</h3>
          <p>Perfect Poses</p>
        </div>
        
        <div className="stat-card">
          <h3>{userStats.achievements?.length || 0}</h3>
          <p>Achievements</p>
        </div>
      </div>

      {/* Pose Statistics */}
      {userStats.poseStats && Object.keys(userStats.poseStats).length > 0 && (
        <div className="pose-stats-section">
          <h2>Pose Statistics</h2>
          <div className="pose-stats-grid">
            {Object.entries(userStats.poseStats).map(([pose, stats]) => (
              <div key={pose} className="pose-stat-card">
                <h4>{pose}</h4>
                <div className="pose-details">
                  <span>Attempts: {stats.attempts || 0}</span>
                  <span>Perfect: {stats.perfectHolds || 0}</span>
                  <span>Accuracy: {Math.round(stats.averageAccuracy || 0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* Achievements */}
      {userStats.achievements && userStats.achievements.length > 0 && (
        <div className="achievements-section">
          <h2>Recent Achievements</h2>
          <div className="achievements-list">
            {userStats.achievements.slice(-5).map((achievement, index) => (
              <div key={index} className="achievement-item">
                <span className="achievement-icon">🏆</span>
                <div className="achievement-details">
                  <h4>{achievement.title}</h4>
                  <p>{achievement.description}</p>
                  <small>Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorite Poses */}
      {userStats.favoritePoses && userStats.favoritePoses.length > 0 && (
        <div className="favorites-section">
          <h2>Your Favorite Poses</h2>
          <div className="favorites-list">
            {userStats.favoritePoses.map((favorite, index) => (
              <div key={index} className="favorite-item">
                <span className="pose-name">{favorite.pose}</span>
                <span className="practice-count">{favorite.count} sessions</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}