const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables before initializing dependencies
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Firebase configuration (validates credentials immediately)
require('./config/firebase');

const influencerRoutes = require('./routes/influencers');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// CORS Configuration
// Supports Chrome extensions, localhost, 127.0.0.1, and standard web clients
// ==========================================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g. cURL, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('moz-extension://') ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    // Allow in development environment for all origins
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger for API calls
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ==========================================
// Static Dashboard Serving
// ==========================================
const dashboardPath = path.resolve(__dirname, '../../dashboard');
app.use('/dashboard', express.static(dashboardPath));

// Redirect root to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// ==========================================
// API Routes
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Influencer Marketing CRM API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Influencer Resource Routes
app.use('/api/influencers', influencerRoutes);

// 404 Handler for unknown API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// ==========================================
// Centralized Error Handling Middleware
// ==========================================
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err.message || err);

  const statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Helpful Firebase message if Cloud Firestore database has not been created yet
  if (message.includes('Cloud Firestore API has not been used') || message.includes('PERMISSION_DENIED')) {
    message = 'Firestore Database has not been initialized in this Firebase project. Please visit https://console.firebase.google.com/project/_/firestore to click "Create Database".';
  }

  const responsePayload = {
    message
  };

  if (err.errors) {
    responsePayload.errors = err.errors;
  }

  if (process.env.NODE_ENV === 'development' && err.stack) {
    responsePayload.stack = err.stack;
  }

  res.status(statusCode).json(responsePayload);
});

// Start Server (only in standalone Node.js environment, not in Vercel serverless)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
============================================================
  🚀 Influencer Marketing CRM Server Running!
  ----------------------------------------------------------
  📡 API Base:      http://localhost:${PORT}/api
  📊 Dashboard:     http://localhost:${PORT}/dashboard
  🩺 Health check:  http://localhost:${PORT}/api/health
============================================================
    `);
  });
}

module.exports = app;
