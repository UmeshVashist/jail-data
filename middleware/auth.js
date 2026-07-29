/**
 * middleware/auth.js - Authentication & Authorization middleware using Google Sheets API
 */

const { getUserByUsername } = require('../config/googleSheets');

/**
 * Middleware to require an active user session.
 */
async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized session. Please log in.' });
  }

  try {
    // Refresh latest permissions from Google Sheet
    const freshUser = await getUserByUsername(req.session.user.username);
    if (!freshUser || freshUser.status !== 'Active') {
      req.session.destroy();
      return res.status(401).json({ success: false, message: 'Account is deactivated or invalid.' });
    }

    req.user = freshUser;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Auth middleware error: ' + err.message });
  }
}

/**
 * Middleware to require Admin privileges.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
  next();
}

/**
 * Middleware to require Import permission.
 */
function requireImportPermission(req, res, next) {
  if (!req.user || req.user.status !== 'Active') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  if (req.user.role === 'Admin') return next();
  if (req.user.role === 'Add' && (req.user.importPermission || req.user.fullAccess)) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Import permission denied. Contact your Admin.' });
}

/**
 * Helper to check 24-hour edit/delete permission window.
 * @param {Object} user - Session user
 * @param {Object} record - Target record
 * @return {boolean}
 */
function canModifyRecord(user, record) {
  if (!user || user.status !== 'Active') return false;

  // Admin and Full Access Add Users can edit/delete any record anytime
  if (user.role === 'Admin' || (user.role === 'Add' && user.fullAccess)) {
    return true;
  }

  // View users cannot edit or delete
  if (user.role === 'View') return false;

  // Standard Add User: Can edit/delete ONLY records created by himself AND created within 24 hours
  if (user.role === 'Add') {
    const isOwnRecord = String(user.username).toLowerCase() === String(record.createdBy || '').toLowerCase();
    
    let createdTimestamp = new Date((record.createdDate || '') + 'T' + (record.createdTime || '00:00:00')).getTime();
    if (isNaN(createdTimestamp)) {
      createdTimestamp = new Date(record.createdDate).getTime();
    }
    
    if (isNaN(createdTimestamp)) return false;

    const currentTimestamp = Date.now();
    const diffInHours = (currentTimestamp - createdTimestamp) / (1000 * 60 * 60);

    return isOwnRecord && diffInHours >= 0 && diffInHours <= 24;
  }

  return false;
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireImportPermission,
  canModifyRecord
};
