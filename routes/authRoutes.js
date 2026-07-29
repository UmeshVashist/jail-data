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
  
  const cleanInput = inputPassword.trim();
  const cleanStored = storedPassword.trim();

  // If stored password is a bcrypt hash
  if (cleanStored.startsWith('$2a$') || cleanStored.startsWith('$2b$')) {
    try {
      if (bcrypt.compareSync(cleanInput, cleanStored)) return true;
    } catch (e) {
      // Fallback if bcrypt parsing fails
    }
  }

  // Direct plaintext match (for passwords typed directly into Google Sheet)
  return cleanInput === cleanStored;
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
      return res.status(401).json({ success: false, message: 'Invalid Username or Password.' });
    }

    const passwordMatch = verifyPassword(password, user.password);
    if (!passwordMatch) {
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
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to destroy session.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

module.exports = router;
