/**
 * config/googleSheets.js - Backward Compatibility Proxy to Cloudflare R2 Storage Service
 * All database operations are now handled by Cloudflare R2 via config/cloudflareStorage.js.
 */

const cloudflareStorage = require('./cloudflareStorage');

module.exports = cloudflareStorage;
