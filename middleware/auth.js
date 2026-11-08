/**
 * middleware/auth.js - Authentication & Authorization middleware using Cloudflare R2 Database Service
 */

const { getUserByUsername } = require('../config/cloudflareStorage');

/**
 * Middleware to require an active user session.
 */
async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।' });
  }

  try {
    // Refresh latest permissions from Google Sheet
    const freshUser = await getUserByUsername(req.session.user.username);
    if (!freshUser || freshUser.status !== 'Active') {
      req.session = null;
      return res.status(401).json({ success: false, message: 'खाता निष्क्रिय या अमान्य है। कृपया एडमिन से संपर्क करें।' });
    }

    req.user = freshUser;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'प्रमाणीकरण त्रुटि: ' + err.message });
  }
}

/**
 * Middleware to require Admin privileges.
 */
function requireAdmin(req, res, next) {
  if (!req.user || String(req.user.role || '').trim().toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'पहुँच अस्वीकृत। इसके लिए एडमिन अनुमति आवश्यक है।' });
  }
  next();
}

/**
 * Middleware to require Import permission.
 */
function requireImportPermission(req, res, next) {
  if (!req.user || req.user.status !== 'Active') {
    return res.status(403).json({ success: false, message: 'पहुँच अस्वीकृत।' });
  }

  if (req.user.role === 'Admin') return next();
  if (req.user.role === 'Add' && (req.user.importPermission || req.user.fullAccess)) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'इम्पोर्ट की अनुमति अस्वीकृत। कृपया अपने एडमिन से संपर्क करें।' });
}

/**
 * Helper to check 12-hour edit/delete permission window.
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

  // Standard Add User: Can edit/delete ONLY records created by himself AND created within 12 hours
  if (user.role === 'Add') {
    const isOwnRecord = String(user.username || '').toLowerCase() === String(record.createdBy || '').toLowerCase();
    if (!isOwnRecord) return false;
    
    const dateStr = (record.createdDate || record.date || '').trim();
    if (!dateStr) return false;

    const timeStr = (record.createdTime || '00:00:00').trim();
    let createdTimestamp = new Date(`${dateStr} ${timeStr}`).getTime();
    if (isNaN(createdTimestamp)) {
      createdTimestamp = new Date(`${dateStr}T${timeStr}`).getTime();
    }
    if (isNaN(createdTimestamp)) {
      createdTimestamp = new Date(dateStr).getTime();
    }
    
    if (isNaN(createdTimestamp)) return false;

    const currentTimestamp = Date.now();
    const diffInHours = (currentTimestamp - createdTimestamp) / (1000 * 60 * 60);

    return diffInHours >= -0.5 && diffInHours <= 12;
  }

  return false;
}

/**
 * Middleware to require Delete Request page access permission (Admin or granted Add users).
 */
function requireDeleteRequestPermission(req, res, next) {
  if (!req.user || req.user.status !== 'Active') {
    return res.status(403).json({ success: false, message: 'पहुँच अस्वीकृत।' });
  }

  if (req.user.role === 'Admin' || req.user.deleteRequestPermission) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'डिलीट रिक्वेस्ट प्रबंधन की अनुमति अस्वीकृत।' });
}

/**
 * Middleware to require PS List permission (Admin or users with psListPermission).
 */
function requirePSListPermission(req, res, next) {
  if (!req.user || req.user.status !== 'Active') {
    return res.status(403).json({ success: false, message: 'पहुँच अस्वीकृत।' });
  }

  const role = String(req.user.role || '').trim().toLowerCase();
  if (role === 'admin' || req.user.psListPermission) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'थाना सूची (PS List) की अनुमति अस्वीकृत। कृपया अपने एडमिन से संपर्क करें।' });
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireImportPermission,
  requireDeleteRequestPermission,
  requirePSListPermission,
  canModifyRecord
};
