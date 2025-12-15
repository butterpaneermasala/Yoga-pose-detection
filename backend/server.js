const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const progressRoutes = require('./routes/progress');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
});
app.use(limiter);

// ====================
// CORS configuration
// ====================
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001',
    ];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (Postman, mobile apps)
        if (!origin) return callback(null, true);

        // Allow in development or if explicitly whitelisted
        if (
            allowedOrigins.includes(origin) ||
            process.env.NODE_ENV === 'development'
        ) {
            return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/progress', progressRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Yoga Pose Detection API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            user: '/api/user',
            progress: '/api/progress',
        },
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Yoga API Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database:
            mongoose.connection.readyState === 1
                ? 'Connected'
                : 'Disconnected',
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error:
            process.env.NODE_ENV === 'development'
                ? err.message
                : 'Internal server error',
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL(s): ${allowedOrigins.join(', ')}`);
    console.log(`🗄️  Database: ${process.env.MONGODB_URI}`);
});
