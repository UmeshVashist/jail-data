/**
 * routes/authRoutes.js - Authentication endpoints using Google Sheets API
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getUserByUsername } = require('../config/googleSheets');
const { requireAuth } = require('../middleware/auth');

/**
 * Helper to check password match against both Bcrypt hash AND Plaintext
 * (Allows passwords entered directly in Google Sheets to work seamlessly)
 */
function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) return false;
  
  const cleanInput = String(inputPassword).trim();
  const cleanStored = String(storedPassword).trim();

  // 1. Direct plaintext match (Primary check for readable Google Sheets passwords)
  if (cleanInput === cleanStored) {
    return true;
  }

  // 2. If stored password is a bcrypt hash ($2a$, $2b$, $2y$)
  if (cleanStored.startsWith('$2a$') || cleanStored.startsWith('$2b$') || cleanStored.startsWith('$2y$')) {
    try {
      if (bcrypt.compareSync(cleanInput, cleanStored)) {
        return true;
      }
    } catch (e) {
      console.error('Bcrypt comparison warning:', e.message);
    }
  }

  return false;
}

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and Password are required.' });
    }

    const user = await getUserByUsername(username.trim());
    if (!user) {
      console.warn(`[LOGIN FAIL] User "${username.trim()}" not found in sheet.`);
      return res.status(401).json({ success: false, message: 'Invalid Username or Password.' });
    }

    const passwordMatch = verifyPassword(password, user.password);
    if (!passwordMatch) {
      console.warn(`[LOGIN FAIL] Password mismatch for user "${username.trim()}". Stored in sheet: "${user.password}"`);
      return res.status(401).json({ success: false, message: 'Invalid Username or Password.' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Admin.' });
    }

    // Set Session
    req.session.user = {
      username: user.username,
      role: user.role,
      importPermission: user.importPermission,
      fullAccess: user.fullAccess,
      status: user.status
    };

    return res.json({
      success: true,
      message: 'Login successful!',
      data: req.session.user
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Login server error: ' + err.message });
  }
});

// Check Session Status
router.get('/session', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      username: req.user.username,
      role: req.user.role,
      importPermission: req.user.importPermission,
      fullAccess: req.user.fullAccess,
      status: req.user.status
    }
  });
});

// Logout user
router.post('/logout', (req, res) => {
  req.session = null;
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
