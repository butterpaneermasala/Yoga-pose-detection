const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  pose: {
    type: String,
    required: true,
    enum: ['Tree', 'Chair', 'Cobra', 'Warrior', 'Dog', 'Shoulderstand', 'Triangle']
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in seconds
    required: true
  },
  bestHold: {
    type: Number, // in seconds
    default: 0
  },
  averageAccuracy: {
    type: Number, // percentage
    default: 0
  },
  perfectHolds: {
    type: Number,
    default: 0
  },
  attempts: {
    type: Number,
    default: 1
  },
  accuracyReadings: [{
    timestamp: Date,
    accuracy: Number
  }],
  detectionMode: {
    type: String,
    enum: ['local', 'server'],
    default: 'local'
  }
});

const achievementSchema = new mongoose.Schema({
  achievementId: {
    type: String,
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  title: String,
  description: String
});

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Overall Statistics
  totalSessions: {
    type: Number,
    default: 0
  },
  totalTime: {
    type: Number, // in seconds
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastSessionDate: {
    type: Date,
    default: null
  },
  
  // Pose-specific Statistics
  poseStats: {
    Tree: {
      attempts: { type: Number, default: 0 },
      bestHold: { type: Number, default: 0 },
      perfectHolds: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 }
    },
    Chair: {
      attempts: { type: Number, default: 0 },
      bestHold: { type: Number, default: 0 },
      perfectHolds: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 }
    },
    Cobra: {
      attempts: { type: Number, default: 0 },
      bestHold: { type: Number, default: 0 },
      perfectHolds: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 }
    },
    Warrior: {
      attempts: { type: Number, default: 0 },
      bestHold: { type: Number, default: 0 },
      perfectHolds: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 }
    },
    Dog: {
      attempts: { type: Number, default: 0 },
      bestHold: { type: Number, default: 0 },
      perfectHolds: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 }
    },
    Shoulderstand: {
      attempts: { type: Number, default: 0 },
      bestHold: { type: Number, default: 0 },
      perfectHolds: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 }
    },
    Triangle: {
      attempts: { type: Number, default: 0 },
      bestHold: { type: Number, default: 0 },
      perfectHolds: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 }
    }
  },
  
  // Achievements
  achievements: [achievementSchema],
  
  // Session History
  sessions: [sessionSchema],
  
  // Weekly/Monthly Stats
  weeklyStats: [{
    weekStart: Date,
    sessions: Number,
    totalTime: Number,
    averageAccuracy: Number
  }],
  
  monthlyStats: [{
    month: String, // YYYY-MM format
    sessions: Number,
    totalTime: Number,
    averageAccuracy: Number,
    newAchievements: Number
  }],
  
  // Calculated Fields
  averageAccuracy: {
    type: Number,
    default: 0
  },
  totalPerfectPoses: {
    type: Number,
    default: 0
  },
  longestHold: {
    type: Number,
    default: 0
  },
  favoritePoses: [{
    pose: String,
    count: Number
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
progressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate derived statistics
progressSchema.methods.calculateStats = function() {
  // Calculate total perfect poses
  this.totalPerfectPoses = Object.values(this.poseStats).reduce((total, pose) => {
    return total + pose.perfectHolds;
  }, 0);
  
  // Calculate longest hold (ensure it's in seconds)
  this.longestHold = Object.values(this.poseStats).reduce((max, pose) => {
    let bestHold = pose.bestHold || 0;
    // Be more aggressive with millisecond detection
    // If the value is > 300 (5 minutes), it's likely in milliseconds
    if (bestHold > 300) {
      bestHold = bestHold / 1000;
    }
    // Cap at reasonable maximum (10 minutes for a single pose hold)
    if (bestHold > 600) {
      bestHold = 600;
    }
    return Math.max(max, bestHold);
  }, 0);
  
  // Calculate average accuracy
  const totalAccuracy = Object.values(this.poseStats).reduce((total, pose) => {
    return total + (pose.averageAccuracy * pose.attempts);
  }, 0);
  const totalAttempts = Object.values(this.poseStats).reduce((total, pose) => {
    return total + pose.attempts;
  }, 0);
  this.averageAccuracy = totalAttempts > 0 ? totalAccuracy / totalAttempts : 0;
  
  // Calculate favorite poses
  this.favoritePoses = Object.entries(this.poseStats)
    .map(([pose, stats]) => ({ pose, count: stats.attempts }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
};

// Add session method
progressSchema.methods.addSession = function(sessionData) {
  const session = {
    ...sessionData,
    duration: (new Date(sessionData.endTime) - new Date(sessionData.startTime)) / 1000
  };
  
  this.sessions.push(session);
  this.totalSessions += 1;
  this.totalTime += session.duration;
  
  // Update pose-specific stats
  const poseStats = this.poseStats[session.pose];
  poseStats.attempts += 1;
  
  // Ensure bestHold is in seconds (be more aggressive with conversion)
  let bestHold = session.bestHold;
  if (bestHold > 300) { // If > 5 minutes, likely milliseconds
    bestHold = bestHold / 1000;
  }
  // Cap at reasonable maximum (10 minutes for a single pose hold)
  if (bestHold > 600) {
    bestHold = 600;
  }
  
  poseStats.bestHold = Math.max(poseStats.bestHold, bestHold);
  poseStats.perfectHolds += session.perfectHolds;
  poseStats.totalTime += session.duration;
  
  // Update pose average accuracy
  const currentTotal = poseStats.averageAccuracy * (poseStats.attempts - 1);
  poseStats.averageAccuracy = (currentTotal + session.averageAccuracy) / poseStats.attempts;
  
  // Update streak
  this.updateStreak();
  
  // Recalculate derived stats
  this.calculateStats();
  
  return this.save();
};

// Update streak method
progressSchema.methods.updateStreak = function() {
  const today = new Date().toDateString();
  const lastSession = this.lastSessionDate;
  
  if (!lastSession) {
    this.currentStreak = 1;
  } else {
    const lastSessionDate = new Date(lastSession).toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    if (lastSessionDate === today) {
      // Same day, don't change streak
    } else if (lastSessionDate === yesterday) {
      // Consecutive day
      this.currentStreak += 1;
    } else {
      // Streak broken
      this.currentStreak = 1;
    }
  }
  
  this.longestStreak = Math.max(this.longestStreak, this.currentStreak);
  this.lastSessionDate = new Date();
};

// Add achievement method
progressSchema.methods.addAchievement = function(achievementData) {
  const existingAchievement = this.achievements.find(
    a => a.achievementId === achievementData.achievementId
  );
  
  if (!existingAchievement) {
    this.achievements.push(achievementData);
    return true; // New achievement added
  }
  
  return false; // Achievement already exists
};

module.exports = mongoose.model('Progress', progressSchema);