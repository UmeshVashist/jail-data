/**
 * routes/userRoutes.js - Admin User Management Endpoints via Cloudflare R2
 */

const express = require('express');
const router = express.Router();
const { getUsers, getUserByUsername, createUser, updateUser, deleteUser } = require('../config/cloudflareStorage');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireAdmin);

// GET /api/users - Get list of users (Sanitized: Passwords NEVER exposed)
router.get('/', async (req, res) => {
  try {
    const users = await getUsers();
    const sanitized = users.map(u => ({
      id: u.id,
      rowIndex: u.rowIndex,
      username: u.username,
      role: u.role,
      importPermission: !!u.importPermission,
      fullAccess: !!u.fullAccess,
      deleteRequestPermission: !!u.deleteRequestPermission,
      psListPermission: !!u.psListPermission,
      status: u.status
    }));
    res.json({ success: true, data: sanitized });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch users error: ' + err.message });
  }
});

// POST /api/users - Create User
router.post('/', async (req, res) => {
  try {
    const { username, password, role, importPermission, fullAccess, deleteRequestPermission, psListPermission, status } = req.body;
    const cleanUsername = (username || req.body.newUsername || '').trim();

    if (!cleanUsername) return res.status(400).json({ success: false, message: 'यूज़रनेम आवश्यक है।' });
    if (!password) return res.status(400).json({ success: false, message: 'पासवर्ड आवश्यक है।' });

    const existingUser = await getUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'यह यूज़रनेम पहले से मौजूद है।' });
    }

    await createUser({
      username: cleanUsername,
      password: password,
      role: role || 'View',
      importPermission: !!importPermission,
      fullAccess: !!fullAccess,
      deleteRequestPermission: !!deleteRequestPermission,
      psListPermission: !!psListPermission,
      status: status || 'Active'
    });

    res.json({ success: true, message: `यूज़र "${cleanUsername}" सफलतापूर्वक बनाया गया!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'यूज़र बनाने में त्रुटि: ' + err.message });
  }
});

// PUT /api/users/:id - Update User
router.put('/:id', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const users = await getUsers();
    const targetUser = users.find(u => u.rowIndex === rowIndex);

    if (!targetUser) return res.status(404).json({ success: false, message: 'यूज़र नहीं मिला।' });

    const { role, importPermission, fullAccess, deleteRequestPermission, psListPermission, status } = req.body;

    await updateUser(rowIndex, {
      role: role || targetUser.role,
      importPermission: importPermission !== undefined ? !!importPermission : targetUser.importPermission,
      fullAccess: fullAccess !== undefined ? !!fullAccess : targetUser.fullAccess,
      deleteRequestPermission: deleteRequestPermission !== undefined ? !!deleteRequestPermission : targetUser.deleteRequestPermission,
      psListPermission: psListPermission !== undefined ? !!psListPermission : targetUser.psListPermission,
      status: status || targetUser.status
    });

    res.json({ success: true, message: `यूज़र "${targetUser.username}" की अनुमतियाँ सफलतापूर्वक अपडेट हो गईं!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'यूज़र अपडेट करने में त्रुटि: ' + err.message });
  }
});

// PUT /api/users/:id/password - Reset Password
router.put('/:id/password', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim() === '') {
      return res.status(400).json({ success: false, message: 'नया पासवर्ड खाली नहीं हो सकता।' });
    }

    await updateUser(rowIndex, { password: newPassword });

    res.json({ success: true, message: 'यूज़र पासवर्ड सफलतापूर्वक रीसेट हो गया।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'पासवर्ड रीसेट करने में त्रुटि: ' + err.message });
  }
});

// PATCH /api/users/:id/import-permission - Toggle Import Permission
router.patch('/:id/import-permission', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { enabled } = req.body;

    await updateUser(rowIndex, { importPermission: !!enabled });
    res.json({ success: true, message: 'इम्पोर्ट अनुमति अपडेट हो गई।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'इम्पोर्ट अनुमति अपडेट त्रुटि: ' + err.message });
  }
});

// PATCH /api/users/:id/full-access - Toggle Full Access
router.patch('/:id/full-access', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { enabled } = req.body;

    await updateUser(rowIndex, { fullAccess: !!enabled });
    res.json({ success: true, message: 'पूर्ण अनुमति (Full Access) अपडेट हो गई।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'पूर्ण अनुमति अपडेट त्रुटि: ' + err.message });
  }
});

// PATCH /api/users/:id/delete-request-permission - Toggle Delete Request Permission
router.patch('/:id/delete-request-permission', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { enabled } = req.body;

    await updateUser(rowIndex, { deleteRequestPermission: !!enabled });
    res.json({ success: true, message: 'डिलीट रिक्वेस्ट अनुमति अपडेट हो गई।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'डिलीट रिक्वेस्ट अनुमति अपडेट त्रुटि: ' + err.message });
  }
});

// PATCH /api/users/:id/ps-permission - Toggle PS List Permission
router.patch('/:id/ps-permission', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const isEnabled = req.body.enabled !== undefined ? req.body.enabled : (req.body.psListPermission !== undefined ? req.body.psListPermission : false);

    await updateUser(rowIndex, { psListPermission: !!isEnabled });
    res.json({ success: true, message: 'थाना सूची अनुमति अपडेट हो गई।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'थाना अनुमति अपडेट त्रुटि: ' + err.message });
  }
});

// PATCH /api/users/:id/status - Toggle User Status
router.patch('/:id/status', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { status } = req.body;

    await updateUser(rowIndex, { status: status || 'Active' });
    res.json({ success: true, message: 'यूज़र स्थिति अपडेट हो गई।' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'यूज़र स्थिति अपडेट त्रुटि: ' + err.message });
  }
});

// DELETE /api/users/:id - Delete User
router.delete('/:id', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const users = await getUsers();
    const targetUser = users.find(u => u.rowIndex === rowIndex);

    if (!targetUser) return res.status(404).json({ success: false, message: 'यूज़र नहीं मिला।' });

    if (targetUser.username.toLowerCase() === req.user.username.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'आप लॉग इन रहते हुए अपना खाता डिलीट नहीं कर सकते।' });
    }

    await deleteUser(rowIndex, targetUser.username);
    res.json({ success: true, message: `यूज़र "${targetUser.username}" सफलतापूर्वक डिलीट कर दिया गया।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'यूज़र डिलीट करने में त्रुटि: ' + err.message });
  }
});

module.exports = router;
