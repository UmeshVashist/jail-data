/**
 * server.js - Express Application Server Entry Point (Cloudflare R2 Database Service)
 */

const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Initialize Cloudflare R2 Database Service
const { initCloudflareStorage, getIsConnected } = require('./config/cloudflareStorage');

// Import routes
const authRoutes = require('./routes/authRoutes');
const recordRoutes = require('./routes/recordRoutes');
const importRoutes = require('./routes/importRoutes');
const userRoutes = require('./routes/userRoutes');
const exportRoutes = require('./routes/exportRoutes');
const deleteRequestRoutes = require('./routes/deleteRequestRoutes');
const editRequestRoutes = require('./routes/editRequestRoutes');
const listAddRequestRoutes = require('./routes/listAddRequestRoutes');
const psRoutes = require('./routes/psRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());

// High-Performance HTTP Compression (Gzip / Deflate for all API responses and static assets)
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie-Session Configuration
app.use(
  cookieSession({
    name: 'informaction_session',
    keys: [process.env.SESSION_SECRET || 'informaction-secret-key-cloudflare-2026'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  })
);

// Non-blocking auto-reconnect for Cloudflare R2 if disconnected (never stalls HTTP requests)
let lastReconnectAttempt = 0;
app.use((req, res, next) => {
  const now = Date.now();
  if (!getIsConnected() && (now - lastReconnectAttempt > 30000)) {
    lastReconnectAttempt = now;
    initCloudflareStorage().catch(err => console.warn('[R2 Background Init Warning]:', err.message));
  }
  next();
});

// Serve Static Frontend Assets with Smart Browser Caching & ETags
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '1h',
  etag: true,
  lastModified: true
}));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/import', importRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/delete-requests', deleteRequestRoutes);
app.use('/api/edit-requests', editRequestRoutes);
app.use('/api/list-add-requests', listAddRequestRoutes);
app.use('/api/ps', psRoutes);

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
    await initCloudflareStorage();
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
