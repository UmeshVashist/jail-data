/**
 * config/database.js - SQLite database initialization, table creation & default user seeding
 */

let sqlite3 = null;
let db = null;

try {
  sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to SQLite database:', err.message);
    } else {
      console.log('Connected to SQLite database at:', dbPath);
    }
  });
} catch (err) {
  // sqlite3 module not installed/available; operations will gracefully fallback
}

// Promisified database helpers
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return resolve({ changes: 0, lastID: 0 });
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) return resolve([]);
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize database schema and default records
async function initDatabase() {
  if (!db) {
    return;
  }
  try {
    // Create Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'View',
        import_permission INTEGER DEFAULT 0,
        full_access INTEGER DEFAULT 0,
        delete_request_permission INTEGER DEFAULT 0,
        ps_list_permission INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure delete_request_permission and ps_list_permission columns exist in existing DB
    try {
      await dbRun(`ALTER TABLE users ADD COLUMN delete_request_permission INTEGER DEFAULT 0`);
    } catch (e) {}
    try {
      await dbRun(`ALTER TABLE users ADD COLUMN ps_list_permission INTEGER DEFAULT 0`);
    } catch (e) {}

    // Create Delete Requests table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS delete_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        pid TEXT NOT NULL,
        name TEXT NOT NULL,
        father TEXT,
        ut_no TEXT,
        aadhar_no TEXT,
        requested_by TEXT NOT NULL,
        requested_date TEXT NOT NULL,
        requested_time TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'Pending',
        action_by TEXT,
        action_date TEXT
      )
    `);

    try {
      await dbRun(`ALTER TABLE delete_requests ADD COLUMN reason TEXT`);
    } catch (e) {}

    // Create Edit Requests table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS edit_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        pid TEXT NOT NULL,
        name TEXT NOT NULL,
        father TEXT,
        ut_no TEXT,
        aadhar_no TEXT,
        date TEXT,
        remark TEXT,
        proposed_data TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        requested_date TEXT NOT NULL,
        requested_time TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'Pending',
        action_by TEXT,
        action_date TEXT
      )
    `);

    // Create List Add Requests table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS list_add_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        option_value TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        requested_date TEXT NOT NULL,
        requested_time TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'Pending',
        action_by TEXT,
        action_date TEXT,
        created_at INTEGER,
        disable_aadhar INTEGER DEFAULT 0
      )
    `);

    try {
      await dbRun(`ALTER TABLE list_add_requests ADD COLUMN created_at INTEGER`);
    } catch (e) {}
    try {
      await dbRun(`ALTER TABLE list_add_requests ADD COLUMN disable_aadhar INTEGER DEFAULT 0`);
    } catch (e) {}


    // Create Remark Options table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS remark_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        option_value TEXT UNIQUE NOT NULL,
        disable_aadhar INTEGER DEFAULT 0
      )
    `);

    try {
      await dbRun(`ALTER TABLE remark_options ADD COLUMN disable_aadhar INTEGER DEFAULT 0`);
    } catch (e) {}

    const remarkCount = await dbGet('SELECT COUNT(*) as count FROM remark_options');
    if (remarkCount.count === 0) {
      const defaults = [
        { val: 'Aadhar Not Made', disable: 1 },
        { val: 'Not Available', disable: 1 },
        { val: 'Foreigner', disable: 1 },
        { val: 'Already Linked but other Prisoner', disable: 0 },
        { val: 'Biometric Block', disable: 0 },
        { val: 'Biometric data not match', disable: 0 },
        { val: 'Aadhar Suspended', disable: 0 },
        { val: 'Other', disable: 0 }
      ];
      for (const opt of defaults) {
        await dbRun('INSERT OR IGNORE INTO remark_options (option_value, disable_aadhar) VALUES (?, ?)', [opt.val, opt.disable]);
      }
    } else {
      try {
        await dbRun(`UPDATE remark_options SET disable_aadhar = 1 WHERE LOWER(option_value) IN ('aadhar not made', 'not available', 'foreigner') AND (disable_aadhar IS NULL OR disable_aadhar = 0)`);
      } catch (e) {}
    }

    // Create System Settings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL
      )
    `);

    await dbRun(`INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)`, ['aadhar_mandatory', 'false']);

    // Create Records table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        father TEXT,
        ut_no TEXT,
        aadhar_no TEXT,
        date TEXT,
        remark TEXT,
        created_by TEXT NOT NULL,
        created_date TEXT NOT NULL,
        created_time TEXT NOT NULL,
        updated_date TEXT,
        updated_time TEXT
      )
    `);

    // Create Police Stations table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS police_stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ps_name TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        created_by TEXT NOT NULL DEFAULT 'Admin',
        created_date TEXT NOT NULL,
        updated_date TEXT
      )
    `);

    // Seed default users if empty
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
      console.log('Seeding default users...');
      
      const adminPass = bcrypt.hashSync('Admin@123', 10);
      const addPass = bcrypt.hashSync('Add@123', 10);
      const viewPass = bcrypt.hashSync('View@123', 10);

      await dbRun(
        `INSERT INTO users (username, password, role, import_permission, full_access, status) VALUES (?, ?, ?, ?, ?, ?)`,
        ['Admin', adminPass, 'Admin', 1, 1, 'Active']
      );
      await dbRun(
        `INSERT INTO users (username, password, role, import_permission, full_access, status) VALUES (?, ?, ?, ?, ?, ?)`,
        ['Add', addPass, 'Add', 0, 0, 'Active']
      );
      await dbRun(
        `INSERT INTO users (username, password, role, import_permission, full_access, status) VALUES (?, ?, ?, ?, ?, ?)`,
        ['View', viewPass, 'View', 0, 0, 'Active']
      );

      console.log('Default users seeded successfully (Admin/Admin@123, Add/Add@123, View/View@123).');
    }
  } catch (err) {
    console.error('Error initializing database schema:', err);
  }
}

initDatabase();

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll
};
