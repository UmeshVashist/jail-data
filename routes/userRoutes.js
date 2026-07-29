/**
 * routes/userRoutes.js - Admin User Management Endpoints via Google Sheets API
 */

const express = require('express');
const router = express.Router();
const { getUsers, getUserByUsername, createUser, updateUser, deleteUser } = require('../config/googleSheets');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireAdmin);

// GET /api/users - Get list of users
router.get('/', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch users error: ' + err.message });
  }
});

// POST /api/users - Create User
router.post('/', async (req, res) => {
  try {
    const { newUsername, password, role, importPermission, fullAccess, status } = req.body;
    const cleanUsername = (newUsername || '').trim();

    if (!cleanUsername) return res.status(400).json({ success: false, message: 'Username is required.' });
    if (!password) return res.status(400).json({ success: false, message: 'Password is required.' });

    const existingUser = await getUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }

    await createUser({
      username: cleanUsername,
      password: password,
      role: role || 'View',
      importPermission: !!importPermission,
      fullAccess: !!fullAccess,
      status: status || 'Active'
    });

    res.json({ success: true, message: `User "${cleanUsername}" created successfully in Google Sheet!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Create user error: ' + err.message });
  }
});

// PUT /api/users/:id - Update User
router.put('/:id', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const users = await getUsers();
    const targetUser = users.find(u => u.rowIndex === rowIndex);

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const { role, importPermission, fullAccess, status } = req.body;

    await updateUser(rowIndex, {
      role: role || targetUser.role,
      importPermission: importPermission !== undefined ? !!importPermission : targetUser.importPermission,
      fullAccess: fullAccess !== undefined ? !!fullAccess : targetUser.fullAccess,
      status: status || targetUser.status
    });

    res.json({ success: true, message: `User "${targetUser.username}" updated successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update user error: ' + err.message });
  }
});

// PUT /api/users/:id/password - Reset Password
router.put('/:id/password', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim() === '') {
      return res.status(400).json({ success: false, message: 'New password cannot be empty.' });
    }

    await updateUser(rowIndex, { password: newPassword });

    res.json({ success: true, message: 'User password reset successfully in Google Sheet.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Reset password error: ' + err.message });
  }
});

// PATCH /api/users/:id/import-permission - Toggle Import Permission
router.patch('/:id/import-permission', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { enabled } = req.body;

    await updateUser(rowIndex, { importPermission: !!enabled });
    res.json({ success: true, message: 'Import permission updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Toggle import permission error: ' + err.message });
  }
});

// PATCH /api/users/:id/full-access - Toggle Full Access
router.patch('/:id/full-access', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { enabled } = req.body;

    await updateUser(rowIndex, { fullAccess: !!enabled });
    res.json({ success: true, message: 'Full access updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Toggle full access error: ' + err.message });
  }
});

// PATCH /api/users/:id/status - Toggle User Status
router.patch('/:id/status', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const { status } = req.body;

    await updateUser(rowIndex, { status: status || 'Active' });
    res.json({ success: true, message: 'User status updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Toggle status error: ' + err.message });
  }
});

// DELETE /api/users/:id - Delete User
router.delete('/:id', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const users = await getUsers();
    const targetUser = users.find(u => u.rowIndex === rowIndex);

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    if (targetUser.username.toLowerCase() === req.user.username.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account while logged in.' });
    }

    await deleteUser(rowIndex, targetUser.username);
    res.json({ success: true, message: `User "${targetUser.username}" deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete user error: ' + err.message });
  }
});

module.exports = router;
