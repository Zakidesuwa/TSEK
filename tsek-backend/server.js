require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

// Config & Migrations
const { initMailer } = require('./config/mailer');
const runMigrations = require('./migrations/runMigrations');

// Route modules
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const classesRoutes = require('./routes/classes.routes');
const examsRoutes = require('./routes/exams.routes');
const scanRoutes = require('./routes/scan.routes');

const historyRoutes = require('./routes/history.routes');
const statsRoutes = require('./routes/stats.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    // Allow localhost and any vercel.app domain
    if (origin.includes('localhost') || origin.includes('vercel.app') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all for now
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      status: 'success', 
      message: 'Connected to PostgreSQL successfully!',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// Mount routes
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(classesRoutes);
app.use(examsRoutes);
app.use('/api/scan', scanRoutes);
app.use(historyRoutes);
app.use(statsRoutes);

// Start server
async function start() {
  await runMigrations();
  await initMailer();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

start();
