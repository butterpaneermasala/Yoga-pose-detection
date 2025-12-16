const mongoose = require('mongoose');
const Progress = require('../models/Progress');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected for data migration'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function fixTimeData() {
    try {
        console.log('🔧 Starting time data migration...');
        
        const progressRecords = await Progress.find({});
        let updatedCount = 0;
        
        for (const progress of progressRecords) {
            let needsUpdate = false;
            
            // Fix longestHold if it's in milliseconds (be more aggressive)
            if (progress.longestHold > 300) { // If > 5 minutes, likely milliseconds
                const originalValue = progress.longestHold;
                progress.longestHold = progress.longestHold / 1000;
                // Cap at reasonable maximum (10 minutes)
                if (progress.longestHold > 600) {
                    progress.longestHold = 600;
                }
                needsUpdate = true;
                console.log(`Fixed longestHold for user ${progress.userId}: ${originalValue} -> ${progress.longestHold}`);
            }
            
            // Fix pose stats bestHold values
            for (const [poseName, poseStats] of Object.entries(progress.poseStats)) {
                if (poseStats.bestHold > 300) { // If > 5 minutes, likely milliseconds
                    const originalValue = poseStats.bestHold;
                    poseStats.bestHold = poseStats.bestHold / 1000;
                    // Cap at reasonable maximum (10 minutes)
                    if (poseStats.bestHold > 600) {
                        poseStats.bestHold = 600;
                    }
                    needsUpdate = true;
                    console.log(`Fixed ${poseName} bestHold for user ${progress.userId}: ${originalValue} -> ${poseStats.bestHold}`);
                }
            }
            
            // Fix session bestHold values
            for (const session of progress.sessions) {
                if (session.bestHold > 300) { // If > 5 minutes, likely milliseconds
                    session.bestHold = session.bestHold / 1000;
                    // Cap at reasonable maximum (10 minutes)
                    if (session.bestHold > 600) {
                        session.bestHold = 600;
                    }
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                // Recalculate stats to ensure consistency
                progress.calculateStats();
                await progress.save();
                updatedCount++;
            }
        }
        
        console.log(`✅ Migration completed! Updated ${updatedCount} records.`);
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
fixTimeData();