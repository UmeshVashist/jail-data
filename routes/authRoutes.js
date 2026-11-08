/**
 * routes/authRoutes.js - Authentication endpoints using Cloudflare Database Service
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getUserByUsername, updateUser } = require('../config/cloudflareStorage');
const { requireAuth } = require('../middleware/auth');

/**
 * Helper to check password match against Bcrypt hash (or fallback plaintext)
 */
function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) return false;
  
  const cleanInput = String(inputPassword).trim();
  const cleanStored = String(storedPassword).trim();

  // 1. If stored password is a bcrypt hash ($2a$, $2b$, $2y$)
  if (cleanStored.startsWith('$2a$') || cleanStored.startsWith('$2b$') || cleanStored.startsWith('$2y$')) {
    try {
      if (bcrypt.compareSync(cleanInput, cleanStored)) {
        return true;
      }
    } catch (e) {
      console.error('Bcrypt comparison warning:', e.message);
    }
  }

  // 2. Direct plaintext match (Backward compatibility; auto-upgraded on login)
  if (cleanInput === cleanStored) {
    return true;
  }

  return false;
}

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'यूज़रनेम और पासवर्ड दोनों आवश्यक हैं।' });
    }

    const cleanUser = username.trim();
    const user = await getUserByUsername(cleanUser);
    if (!user) {
      console.warn(`[LOGIN FAIL] User "${cleanUser}" not found.`);
      return res.status(401).json({ success: false, message: 'अमान्य यूज़रनेम या पासवर्ड।' });
    }

    const passwordMatch = verifyPassword(password, user.password);
    if (!passwordMatch) {
      console.warn(`[LOGIN FAIL] Password mismatch for user "${cleanUser}".`);
      return res.status(401).json({ success: false, message: 'अमान्य यूज़रनेम या पासवर्ड।' });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'खाता निष्क्रिय है। कृपया एडमिन से संपर्क करें।' });
    }

    // Auto-upgrade plaintext password to bcrypt hash if needed
    if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
      try {
        const hashed = bcrypt.hashSync(password.trim(), 10);
        await updateUser(user.id || user.rowIndex, { password: hashed });
      } catch (e) {}
    }

    // Set Session
    req.session.user = {
      username: user.username,
      role: user.role,
      importPermission: !!user.importPermission,
      fullAccess: !!user.fullAccess,
      deleteRequestPermission: !!user.deleteRequestPermission,
      psListPermission: !!user.psListPermission,
      status: user.status
    };

    return res.json({
      success: true,
      message: 'लॉगिन सफल रहा!',
      user: req.session.user,
      data: req.session.user
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'लॉगिन सर्वर त्रुटि: ' + err.message });
  }
});

// Check Session Status & Profile (/session and /me aliases)
const handleSessionCheck = async (req, res) => {
  try {
    const freshUser = await getUserByUsername(req.user.username);
    if (freshUser) {
      req.user = freshUser;
      req.session.user = {
        username: freshUser.username,
        role: freshUser.role,
        importPermission: !!freshUser.importPermission,
        fullAccess: !!freshUser.fullAccess,
        deleteRequestPermission: !!freshUser.deleteRequestPermission,
        psListPermission: !!freshUser.psListPermission,
        status: freshUser.status
      };
    }
  } catch (e) {}

  const userData = {
    username: req.user.username,
    role: req.user.role,
    importPermission: !!req.user.importPermission,
    fullAccess: !!req.user.fullAccess,
    deleteRequestPermission: !!req.user.deleteRequestPermission,
    psListPermission: !!req.user.psListPermission,
    status: req.user.status
  };

  res.json({
    success: true,
    user: userData,
    data: userData
  });
};

router.get('/session', requireAuth, handleSessionCheck);
router.get('/me', requireAuth, handleSessionCheck);

// Self Password Change for logged-in user
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'वर्तमान पासवर्ड और नया पासवर्ड दोनों आवश्यक हैं।' });
    }
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' });
    }

    const user = await getUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ success: false, message: 'यूज़र नहीं मिला।' });
    }

    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(400).json({ success: false, message: 'वर्तमान पासवर्ड गलत है।' });
    }

    const hashed = bcrypt.hashSync(newPassword.trim(), 10);
    await updateUser(user.id || user.rowIndex, { password: hashed });

    return res.json({ success: true, message: 'पासवर्ड सफलतापूर्वक अपडेट हो गया!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'पासवर्ड बदलने में त्रुटि: ' + err.message });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  req.session = null;
  return res.json({ success: true, message: 'सफलतापूर्वक साइन आउट हो गए।' });
});

module.exports = router;
