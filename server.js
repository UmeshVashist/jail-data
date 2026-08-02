/**
 * server.js - Express Application Server Entry Point (Vercel Serverless Ready)
 */

const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Initialize Google Sheets API database service
const { initGoogleSheets, getIsConnected } = require('./config/googleSheets');

// Import routes
const authRoutes = require('./routes/authRoutes');
const recordRoutes = require('./routes/recordRoutes');
const importRoutes = require('./routes/importRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');
const deleteRequestRoutes = require('./routes/deleteRequestRoutes');
const editRequestRoutes = require('./routes/editRequestRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie-Session Configuration (Works 100% on Vercel Serverless)
app.use(
  cookieSession({
    name: 'informaction_session',
    keys: [process.env.SESSION_SECRET || 'informaction-secret-key-gsheet-2026'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  })
);

// Middleware to ensure Google Sheets connection on every request (Cold-start resilient)
app.use(async (req, res, next) => {
  try {
    if (!getIsConnected()) {
      await initGoogleSheets();
    }
  } catch (err) {
    console.error('Connection middleware warning:', err.message);
  }
  next();
});

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/import', importRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/delete-requests', deleteRequestRoutes);
app.use('/api/edit-requests', editRequestRoutes);

// Fallback Route to serve Single Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Boot Server for Local Development
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const server = app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(`  Data Management Portal Server running on:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`=======================================================`);
    await initGoogleSheets();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[ERROR] Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Export Express App for Vercel Serverless Function
module.exports = app;
