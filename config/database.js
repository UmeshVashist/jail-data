/**
 * config/database.js - SQLite database initialization, table creation & default user seeding
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Promisified database helpers
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize database schema and default records
async function initDatabase() {
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
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure delete_request_permission column exists in existing DB
    try {
      await dbRun(`ALTER TABLE users ADD COLUMN delete_request_permission INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists
    }

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
        status TEXT DEFAULT 'Pending',
        action_by TEXT,
        action_date TEXT
      )
    `);

    // Create Remark Options table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS remark_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        option_value TEXT UNIQUE NOT NULL
      )
    `);

    const remarkCount = await dbGet('SELECT COUNT(*) as count FROM remark_options');
    if (remarkCount.count === 0) {
      const defaults = ['Completed', 'Pending', 'In Progress', 'Verified', 'Rejected', 'Imported', 'Other'];
      for (const opt of defaults) {
        await dbRun('INSERT OR IGNORE INTO remark_options (option_value) VALUES (?)', [opt]);
      }
    }

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
