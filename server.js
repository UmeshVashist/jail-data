/**
 * server.js - Express Application Server Entry Point (Cloudflare R2 Database Service)
 * Fully equipped with real-time terminal request logging and visual error diagnostics
 */

const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Support .env.local, .env, and root environment configuration
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

// Initialize Cloudflare R2 Database Service
const { initCloudflareStorage, getIsConnected } = require('./config/cloudflareStorage');

// Terminal Request Logger & Visual Error Diagnostics
const {
  terminalRequestLogger,
  terminalErrorHandler,
  setupProcessErrorDiagnostics,
  COLORS
} = require('./middleware/terminalLogger');

// Enable process-level unhandled rejection / exception diagnostics
setupProcessErrorDiagnostics();

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
    if (req.path.startsWith('/api/export') || req.headers['x-no-compression'] || res.getHeader('x-no-compression')) return false;
    const type = String(res.getHeader('Content-Type') || '').toLowerCase();
    if (
      type.includes('spreadsheet') ||
      type.includes('excel') ||
      type.includes('zip') ||
      type.includes('octet-stream') ||
      type.includes('officedocument')
    ) {
      return false;
    }
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

// Real-Time Color-Coded Terminal Logger for all requests & status codes
app.use(terminalRequestLogger);

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

// Disable ETags and Browser Caching for all Dynamic API Routes (Prevents 304 Not Modified stalls)
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Resolve Static Asset Path (Serves compiled React + Vite production bundle)
const clientDistPath = path.join(__dirname, 'client', 'dist');
const staticPath = clientDistPath;

// Serve Static Frontend Assets with Smart Browser Caching & ETags
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '1h',
    etag: true,
    lastModified: true
  }));
}

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
  const indexHtml = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    // Add no-cache for index.html so client updates are immediately reflected
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.sendFile(indexHtml);
  }
  return res.status(503).send('React app is building or client/dist is not found. Please run npm run build:client');
});

// Centralized Terminal Error Handler (Catches all uncaught route errors with full stack trace)
app.use(terminalErrorHandler);

// Boot Server for Local Development
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const server = app.listen(PORT, async () => {
    console.log(`\n=======================================================`);
    console.log(`  🚀 ${COLORS.brightCyan}${COLORS.bold}JAM Portal Server Running${COLORS.reset}`);
    console.log(`  🔗 ${COLORS.bold}Local URL:${COLORS.reset} http://localhost:${PORT}`);
    console.log(`  🔍 ${COLORS.bold}Terminal Diagnostics:${COLORS.reset} ${COLORS.brightGreen}ENABLED (Real-time colored logs & errors)${COLORS.reset}`);
    console.log(`=======================================================\n`);
    await initCloudflareStorage();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n${COLORS.brightRed}[ERROR] Port ${PORT} is already in use.${COLORS.reset}\n`);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Export Express App for Vercel Serverless Function
module.exports = app;
