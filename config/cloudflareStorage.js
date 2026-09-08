/**
 * config/cloudflareStorage.js - Cloudflare R2 S3-Compatible Database Service
 * Replaces Google Sheets API with Cloudflare R2 Object Storage.
 * Stores and manages: Users, Records, DeleteRequests, EditRequests, ListAddRequests, RemarkOptions, SystemSettings.
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ? process.env.CLOUDFLARE_ACCOUNT_ID.replace(/"/g, '').trim() : '';
const ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT ? process.env.CLOUDFLARE_R2_ENDPOINT.replace(/"/g, '').trim() : (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ? process.env.CLOUDFLARE_R2_ACCESS_KEY_ID.replace(/"/g, '').trim() : '';
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ? process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY.replace(/"/g, '').trim() : '';
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME ? process.env.CLOUDFLARE_R2_BUCKET_NAME.replace(/"/g, '').trim() : 'jam-data';

let s3Client = null;
let isConnected = false;
let connectionError = null;

/* Keys for JSON data stored in Cloudflare R2 */
const R2_KEYS = {
  USERS: 'data/users.json',
  RECORDS: 'data/records.json',
  DELETE_REQUESTS: 'data/delete_requests.json',
  EDIT_REQUESTS: 'data/edit_requests.json',
  LIST_ADD_REQUESTS: 'data/list_add_requests.json',
  REMARK_OPTIONS: 'data/remark_options.json',
  SETTINGS: 'data/system_settings.json'
};

/* In-memory Data Store (Auto-seeded with defaults) */
const memoryStore = {
  users: [
    { id: 1, rowIndex: 1, username: 'Admin', password: 'Admin@123', role: 'Admin', importPermission: true, fullAccess: true, deleteRequestPermission: true, status: 'Active' },
    { id: 2, rowIndex: 2, username: 'Add', password: 'Add@123', role: 'Add', importPermission: false, fullAccess: false, deleteRequestPermission: false, status: 'Active' },
    { id: 3, rowIndex: 3, username: 'View', password: 'View@123', role: 'View', importPermission: false, fullAccess: false, deleteRequestPermission: false, status: 'Active' }
  ],
  records: [],
  deleteRequests: [],
  editRequests: [],
  listAddRequests: [],
  remarkOptions: [
    { id: 1, optionValue: 'Aadhar Not Made', disableAadhar: true },
    { id: 2, optionValue: 'Not Available', disableAadhar: true },
    { id: 3, optionValue: 'Foreigner', disableAadhar: true },
    { id: 4, optionValue: 'Already Linked but other Prisoner', disableAadhar: false },
    { id: 5, optionValue: 'Biometric Block', disableAadhar: false },
    { id: 6, optionValue: 'Biometric data not match', disableAadhar: false },
    { id: 7, optionValue: 'Aadhar Suspended', disableAadhar: false },
    { id: 8, optionValue: 'Other', disableAadhar: false }
  ],
  settings: {
    aadhar_mandatory: 'false'
  }
};

/* Helper: Save a collection locally to data/ directory */
function saveLocal(key, data) {
  try {
    const filename = path.basename(key);
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Local Storage Warning] Could not save ${key}:`, err.message);
  }
}

/* Helper: Read a collection from local data/ directory */
function readLocal(key) {
  try {
    const filename = path.basename(key);
    const filepath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filepath)) {
      const raw = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

/* Pre-load collections from local data/ directory */
function loadLocalCollections() {
  const users = readLocal(R2_KEYS.USERS);
  if (users && users.length) memoryStore.users = users;

  const records = readLocal(R2_KEYS.RECORDS);
  if (records && records.length) memoryStore.records = records;

  const del = readLocal(R2_KEYS.DELETE_REQUESTS);
  if (del && del.length) memoryStore.deleteRequests = del;

  const edit = readLocal(R2_KEYS.EDIT_REQUESTS);
  if (edit && edit.length) memoryStore.editRequests = edit;

  const list = readLocal(R2_KEYS.LIST_ADD_REQUESTS);
  if (list && list.length) memoryStore.listAddRequests = list;

  const opts = readLocal(R2_KEYS.REMARK_OPTIONS);
  if (opts && opts.length) memoryStore.remarkOptions = opts;

  const settings = readLocal(R2_KEYS.SETTINGS);
  if (settings) memoryStore.settings = settings;
}

// Initial cold load from disk
loadLocalCollections();

/* Helper: Stream to String */
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

/* Helper: Save a collection to Cloudflare R2 & Local Disk */
async function saveToR2(key, data) {
  saveLocal(key, data);
  if (!s3Client || !isConnected) return;
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: jsonStr,
      ContentType: 'application/json'
    }));
  } catch (err) {
    console.error(`[Cloudflare R2 Write Warning] Could not save ${key}:`, err.message);
  }
}

/* Helper: Read a collection from Cloudflare R2 with local fallback */
async function readFromR2(key) {
  if (s3Client && isConnected) {
    try {
      const res = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      }));
      const content = await streamToString(res.Body);
      const parsed = JSON.parse(content);
      if (parsed) {
        saveLocal(key, parsed);
        return parsed;
      }
    } catch (err) {
      if (err.name !== 'NoSuchKey') {
        console.warn(`[Cloudflare R2 Read Notice] ${key}:`, err.message);
      }
    }
  }
  return readLocal(key);
}

/* Helper: Date-Time formatter */
function getFormattedDateTime(d = new Date()) {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(d);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const time = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${year}-${month}-${day} ${time}`;
}

function formatDateValue(val) {
  if (val === null || val === undefined || val === '') return '';
  const str = val.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const p = str.split('-');
    return `${p[2]}-${p[1]}-${p[0]}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const p = str.split('/');
    return `${p[2]}-${p[1]}-${p[0]}`;
  }
  return str;
}

/**
 * Initialize Cloudflare R2 Connection & Load Data
 */
async function initCloudflareStorage() {
  if (!ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    connectionError = 'Cloudflare R2 credentials missing in .env (CLOUDFLARE_R2_ACCESS_KEY_ID or SECRET).';
    console.warn('\n===============================================================');
    console.warn('  [NOTICE] Cloudflare R2 credentials missing in .env');
    console.warn('  Running in Resilient Local Storage mode.');
    console.warn('===============================================================\n');
    return false;
  }

  try {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: ENDPOINT,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    });

    // Test connection by listing bucket
    await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1
    }));

    isConnected = true;
    connectionError = null;

    console.log(`\n===============================================================`);
    console.log(`  SUCCESS! Connected to Live Cloudflare R2 Storage`);
    console.log(`  Bucket: "${BUCKET_NAME}"`);
    console.log(`  Endpoint: ${ENDPOINT}`);
    console.log(`===============================================================\n`);

    // Synchronize collections from R2 (or seed if new)
    await syncAllCollections();
    return true;
  } catch (err) {
    connectionError = err.message;
    console.error('\n[Cloudflare R2 Connection Notice]', err.message);
    console.warn('Continuing with resilient Local Database...\n');
    return false;
  }
}

/**
 * Sync all data collections with Cloudflare R2
 */
async function syncAllCollections() {
  if (!isConnected) return;

  try {
    // 1. Users
    const r2Users = await readFromR2(R2_KEYS.USERS);
    if (r2Users && Array.isArray(r2Users) && r2Users.length > 0) {
      memoryStore.users = r2Users;
    } else {
      await saveToR2(R2_KEYS.USERS, memoryStore.users);
    }

    // 2. Records
    const r2Records = await readFromR2(R2_KEYS.RECORDS);
    if (r2Records && Array.isArray(r2Records)) {
      memoryStore.records = r2Records;
    } else {
      // If R2 has no records yet, check if local SQLite has existing records to migrate
      try {
        const { dbAll } = require('./database');
        const rows = await dbAll('SELECT * FROM records ORDER BY id DESC');
        if (rows && rows.length > 0) {
          memoryStore.records = rows.map(r => ({
            id: r.id,
            rowIndex: r.id,
            pid: r.pid,
            name: r.name,
            father: r.father,
            utNo: r.ut_no,
            type: (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(r.ut_no) ? 'CT' : (/\bUT\b|UT/i.test(r.ut_no) ? 'UT' : '')),
            recordType: (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(r.ut_no) ? 'CT' : (/\bUT\b|UT/i.test(r.ut_no) ? 'UT' : '')),
            aadharNo: r.aadhar_no,
            date: r.date,
            remark: r.remark,
            createdBy: r.created_by,
            createdDate: r.created_date,
            createdTime: r.created_time,
            updatedDate: r.updated_date,
            updatedTime: r.updated_time
          }));
          await saveToR2(R2_KEYS.RECORDS, memoryStore.records);
        }
      } catch (e) {}
    }

    // 3. Delete Requests
    const r2DelReqs = await readFromR2(R2_KEYS.DELETE_REQUESTS);
    if (r2DelReqs && Array.isArray(r2DelReqs)) {
      memoryStore.deleteRequests = r2DelReqs;
    } else {
      await saveToR2(R2_KEYS.DELETE_REQUESTS, memoryStore.deleteRequests);
    }

    // 4. Edit Requests
    const r2EditReqs = await readFromR2(R2_KEYS.EDIT_REQUESTS);
    if (r2EditReqs && Array.isArray(r2EditReqs)) {
      memoryStore.editRequests = r2EditReqs;
    } else {
      await saveToR2(R2_KEYS.EDIT_REQUESTS, memoryStore.editRequests);
    }

    // 5. List Add Requests
    const r2ListReqs = await readFromR2(R2_KEYS.LIST_ADD_REQUESTS);
    if (r2ListReqs && Array.isArray(r2ListReqs)) {
      memoryStore.listAddRequests = r2ListReqs;
    } else {
      await saveToR2(R2_KEYS.LIST_ADD_REQUESTS, memoryStore.listAddRequests);
    }

    // 6. Remark Options
    const r2Options = await readFromR2(R2_KEYS.REMARK_OPTIONS);
    if (r2Options && Array.isArray(r2Options) && r2Options.length > 0) {
      memoryStore.remarkOptions = r2Options;
    } else {
      await saveToR2(R2_KEYS.REMARK_OPTIONS, memoryStore.remarkOptions);
    }

    // 7. System Settings
    const r2Settings = await readFromR2(R2_KEYS.SETTINGS);
    if (r2Settings && typeof r2Settings === 'object') {
      memoryStore.settings = r2Settings;
    } else {
      await saveToR2(R2_KEYS.SETTINGS, memoryStore.settings);
    }

    console.log(`[Cloudflare R2] Successfully synced all collections with bucket "${BUCKET_NAME}".`);
  } catch (err) {
    console.error('[Cloudflare R2 Sync Warning]', err.message);
  }
}

/* ==========================================================================
   Users Management Methods
   ========================================================================== */

async function getUsers() {
  return memoryStore.users.map(u => ({
    id: u.id || u.rowIndex,
    rowIndex: u.rowIndex || u.id,
    username: (u.username || '').trim(),
    password: (u.password || '').trim(),
    role: (u.role || 'View').trim(),
    importPermission: !!u.importPermission,
    fullAccess: !!u.fullAccess,
    deleteRequestPermission: !!u.deleteRequestPermission,
    status: (u.status || 'Active').trim()
  }));
}

async function getUserByUsername(username) {
  const users = await getUsers();
  const target = (username || '').toLowerCase().trim();
  return users.find(u => u.username.toLowerCase() === target) || null;
}

async function createUser(userObj) {
  const newId = memoryStore.users.length > 0 ? Math.max(...memoryStore.users.map(u => u.id || 0)) + 1 : 1;
  const newUser = {
    id: newId,
    rowIndex: newId,
    username: userObj.username.trim(),
    password: userObj.password,
    role: userObj.role || 'View',
    importPermission: !!userObj.importPermission,
    fullAccess: !!userObj.fullAccess,
    deleteRequestPermission: !!userObj.deleteRequestPermission,
    status: userObj.status || 'Active'
  };

  memoryStore.users.push(newUser);

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    const hashed = bcrypt.hashSync(newUser.password, 10);
    await dbRun(
      `INSERT OR REPLACE INTO users (username, password, role, import_permission, full_access, delete_request_permission, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newUser.username, hashed, newUser.role, newUser.importPermission ? 1 : 0, newUser.fullAccess ? 1 : 0, newUser.deleteRequestPermission ? 1 : 0, newUser.status]
    );
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.USERS, memoryStore.users);
  return newUser;
}

async function updateUser(rowIndex, updateFields) {
  const target = memoryStore.users.find(u => (u.id === parseInt(rowIndex, 10) || u.rowIndex === parseInt(rowIndex, 10)));
  if (!target) return false;

  if (updateFields.password) target.password = updateFields.password;
  if (updateFields.role) target.role = updateFields.role;
  if (updateFields.importPermission !== undefined) target.importPermission = !!updateFields.importPermission;
  if (updateFields.fullAccess !== undefined) target.fullAccess = !!updateFields.fullAccess;
  if (updateFields.deleteRequestPermission !== undefined) target.deleteRequestPermission = !!updateFields.deleteRequestPermission;
  if (updateFields.status) target.status = updateFields.status;

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    let sql = 'UPDATE users SET role = ?, import_permission = ?, full_access = ?, delete_request_permission = ?, status = ?';
    let params = [target.role, target.importPermission ? 1 : 0, target.fullAccess ? 1 : 0, target.deleteRequestPermission ? 1 : 0, target.status];
    if (updateFields.password) {
      sql += ', password = ?';
      params.push(bcrypt.hashSync(updateFields.password, 10));
    }
    sql += ' WHERE username = ?';
    params.push(target.username);
    await dbRun(sql, params);
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.USERS, memoryStore.users);
  return true;
}

async function deleteUser(rowIndex) {
  const target = memoryStore.users.find(u => (u.id === parseInt(rowIndex, 10) || u.rowIndex === parseInt(rowIndex, 10)));
  if (!target) return false;

  memoryStore.users = memoryStore.users.filter(u => u !== target);

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM users WHERE username = ?`, [target.username]);
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.USERS, memoryStore.users);
  return true;
}

/* ==========================================================================
   Records Data Access Methods
   ========================================================================== */

async function getRecords() {
  return memoryStore.records.map(r => ({
    id: r.id || r.rowIndex,
    rowIndex: r.rowIndex || r.id,
    pid: (r.pid || '').toString().trim(),
    name: (r.name || '').toString().trim(),
    father: (r.father || '').toString().trim(),
    utNo: (r.utNo || '').toString().trim(),
    type: r.type || r.recordType || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(r.utNo) ? 'CT' : (/\bUT\b|UT/i.test(r.utNo) ? 'UT' : '')),
    recordType: r.recordType || r.type || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(r.utNo) ? 'CT' : (/\bUT\b|UT/i.test(r.utNo) ? 'UT' : '')),
    aadharNo: (r.aadharNo || '').toString().trim(),
    date: formatDateValue(r.date),
    remark: (r.remark || '').toString().trim(),
    createdBy: (r.createdBy || '').toString().trim(),
    createdDate: formatDateValue(r.createdDate),
    createdTime: (r.createdTime || '').toString().trim(),
    updatedDate: formatDateValue(r.updatedDate),
    updatedTime: (r.updatedTime || '').toString().trim()
  }));
}

async function addRecord(recObj) {
  const newId = memoryStore.records.length > 0 ? Math.max(...memoryStore.records.map(r => r.id || 0)) + 1 : 1;
  const recType = recObj.recordType || recObj.type || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(recObj.utNo) ? 'CT' : (/\bUT\b|UT/i.test(recObj.utNo) ? 'UT' : ''));

  const newRec = {
    id: newId,
    rowIndex: newId,
    pid: (recObj.pid || '').toString().trim(),
    name: (recObj.name || '').toString().trim(),
    father: (recObj.father || '').toString().trim(),
    utNo: (recObj.utNo || '').toString().trim(),
    type: recType,
    recordType: recType,
    aadharNo: (recObj.aadharNo || '').toString().trim(),
    date: formatDateValue(recObj.date),
    remark: (recObj.remark || '').toString().trim(),
    createdBy: recObj.createdBy || 'Admin',
    createdDate: recObj.createdDate || formatDateValue(new Date().toISOString().slice(0, 10)),
    createdTime: recObj.createdTime || new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }),
    updatedDate: '',
    updatedTime: ''
  };

  memoryStore.records.unshift(newRec);

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    await dbRun(
      `INSERT OR REPLACE INTO records (id, pid, name, father, ut_no, aadhar_no, date, remark, created_by, created_date, created_time, updated_date, updated_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newRec.id, newRec.pid, newRec.name, newRec.father, newRec.utNo, newRec.aadharNo, newRec.date, newRec.remark, newRec.createdBy, newRec.createdDate, newRec.createdTime, '', '']
    );
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.RECORDS, memoryStore.records);
  return newRec;
}

async function updateRecord(rowIndex, recObj) {
  const target = memoryStore.records.find(r => (r.id === parseInt(rowIndex, 10) || r.rowIndex === parseInt(rowIndex, 10)));
  if (!target) return false;

  const recType = recObj.recordType || recObj.type || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(recObj.utNo) ? 'CT' : (/\bUT\b|UT/i.test(recObj.utNo) ? 'UT' : ''));

  target.pid = (recObj.pid || target.pid).toString().trim();
  target.name = (recObj.name || target.name).toString().trim();
  target.father = (recObj.father !== undefined ? recObj.father : target.father).toString().trim();
  target.utNo = (recObj.utNo !== undefined ? recObj.utNo : target.utNo).toString().trim();
  target.type = recType;
  target.recordType = recType;
  target.aadharNo = (recObj.aadharNo !== undefined ? recObj.aadharNo : target.aadharNo).toString().trim();
  target.date = formatDateValue(recObj.date !== undefined ? recObj.date : target.date);
  target.remark = (recObj.remark !== undefined ? recObj.remark : target.remark).toString().trim();
  target.updatedDate = recObj.updatedDate || formatDateValue(new Date().toISOString().slice(0, 10));
  target.updatedTime = recObj.updatedTime || new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true });

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    await dbRun(
      `UPDATE records SET pid = ?, name = ?, father = ?, ut_no = ?, aadhar_no = ?, date = ?, remark = ?, updated_date = ?, updated_time = ? WHERE id = ?`,
      [target.pid, target.name, target.father, target.utNo, target.aadharNo, target.date, target.remark, target.updatedDate, target.updatedTime, target.id]
    );
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.RECORDS, memoryStore.records);
  return true;
}

async function deleteRecord(rowIndex) {
  const idNum = parseInt(rowIndex, 10);
  memoryStore.records = memoryStore.records.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM records WHERE id = ?`, [idNum]);
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.RECORDS, memoryStore.records);
  return true;
}

async function batchAddRecords(recordsArr) {
  if (!Array.isArray(recordsArr) || recordsArr.length === 0) return true;

  let maxId = memoryStore.records.length > 0 ? Math.max(...memoryStore.records.map(r => r.id || 0)) : 0;

  for (const rec of recordsArr) {
    maxId++;
    const recType = rec.recordType || rec.type || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(rec.utNo) ? 'CT' : (/\bUT\b|UT/i.test(rec.utNo) ? 'UT' : ''));
    const item = {
      id: maxId,
      rowIndex: maxId,
      pid: (rec.pid || '').toString().trim(),
      name: (rec.name || '').toString().trim(),
      father: (rec.father || '').toString().trim(),
      utNo: (rec.utNo || '').toString().trim(),
      type: recType,
      recordType: recType,
      aadharNo: (rec.aadharNo || '').toString().trim(),
      date: formatDateValue(rec.date),
      remark: (rec.remark || '').toString().trim(),
      createdBy: rec.createdBy || 'Admin',
      createdDate: rec.createdDate || formatDateValue(new Date().toISOString().slice(0, 10)),
      createdTime: rec.createdTime || new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }),
      updatedDate: '',
      updatedTime: ''
    };
    memoryStore.records.unshift(item);

    try {
      const { dbRun } = require('./database');
      await dbRun(
        `INSERT OR REPLACE INTO records (id, pid, name, father, ut_no, aadhar_no, date, remark, created_by, created_date, created_time, updated_date, updated_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.pid, item.name, item.father, item.utNo, item.aadharNo, item.date, item.remark, item.createdBy, item.createdDate, item.createdTime, '', '']
      );
    } catch (e) {}
  }

  // Save batch once to Cloudflare R2
  await saveToR2(R2_KEYS.RECORDS, memoryStore.records);
  return true;
}

/* ==========================================================================
   Delete Requests Methods
   ========================================================================== */

async function getDeleteRequests() {
  return memoryStore.deleteRequests.map(r => ({
    id: r.id || r.rowIndex,
    rowIndex: r.rowIndex || r.id,
    recordId: (r.recordId || r.record_id || r.id).toString(),
    pid: (r.pid || '').toString().trim(),
    name: (r.name || '').toString().trim(),
    father: (r.father || '').toString().trim(),
    utNo: (r.utNo || '').toString().trim(),
    aadharNo: (r.aadharNo || '').toString().trim(),
    requestedBy: (r.requestedBy || '').toString().trim(),
    requestedDate: (r.requestedDate || '').toString().trim(),
    requestedTime: (r.requestedTime || '').toString().trim(),
    reason: (r.reason || r.remark || '').toString().trim(),
    remark: (r.remark || r.reason || '').toString().trim(),
    status: (r.status || 'Pending').toString().trim(),
    actionBy: (r.actionBy || '').toString().trim(),
    actionDate: (r.actionDate || '').toString().trim()
  }));
}

async function createDeleteRequest(reqObj) {
  const remarkVal = (reqObj.remark || reqObj.reason || '').toString().trim();
  const newId = memoryStore.deleteRequests.length > 0 ? Math.max(...memoryStore.deleteRequests.map(r => r.id || 0)) + 1 : 1;

  const item = {
    id: newId,
    rowIndex: newId,
    recordId: reqObj.recordId,
    pid: reqObj.pid,
    name: reqObj.name,
    father: reqObj.father || '',
    utNo: reqObj.utNo || '',
    aadharNo: reqObj.aadharNo || '',
    requestedBy: reqObj.requestedBy,
    requestedDate: reqObj.requestedDate,
    requestedTime: reqObj.requestedTime,
    remark: remarkVal,
    reason: remarkVal,
    status: 'Pending',
    actionBy: '',
    actionDate: ''
  };

  memoryStore.deleteRequests.push(item);

  try {
    const { dbRun } = require('./database');
    await dbRun(
      `INSERT INTO delete_requests (record_id, pid, name, father, ut_no, aadhar_no, requested_by, requested_date, requested_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.recordId, item.pid, item.name, item.father, item.utNo, item.aadharNo, item.requestedBy, item.requestedDate, item.requestedTime, item.remark, 'Pending']
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.DELETE_REQUESTS, memoryStore.deleteRequests);
  return true;
}

async function updateDeleteRequestStatus(requestId, status, actionBy) {
  const actionDate = getFormattedDateTime();
  const target = memoryStore.deleteRequests.find(r => (r.id === parseInt(requestId, 10) || r.rowIndex === parseInt(requestId, 10)));
  if (target) {
    target.status = status;
    target.actionBy = actionBy;
    target.actionDate = actionDate;
  }

  try {
    const { dbRun } = require('./database');
    await dbRun(
      `UPDATE delete_requests SET status = ?, action_by = ?, action_date = ? WHERE id = ?`,
      [status, actionBy, actionDate, requestId]
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.DELETE_REQUESTS, memoryStore.deleteRequests);
  return true;
}

async function deleteDeleteRequest(requestId) {
  const idNum = parseInt(requestId, 10);
  memoryStore.deleteRequests = memoryStore.deleteRequests.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM delete_requests WHERE id = ?`, [idNum]);
  } catch (e) {}

  await saveToR2(R2_KEYS.DELETE_REQUESTS, memoryStore.deleteRequests);
  return true;
}

/* ==========================================================================
   Edit Requests Methods
   ========================================================================== */

async function getEditRequests() {
  return memoryStore.editRequests.map(r => ({
    id: r.id || r.rowIndex,
    rowIndex: r.rowIndex || r.id,
    recordId: (r.recordId || r.record_id || r.id).toString(),
    pid: (r.pid || '').toString().trim(),
    name: (r.name || '').toString().trim(),
    father: (r.father || '').toString().trim(),
    utNo: (r.utNo || '').toString().trim(),
    aadharNo: (r.aadharNo || '').toString().trim(),
    proposedData: typeof r.proposedData === 'string' ? JSON.parse(r.proposedData || '{}') : (r.proposedData || {}),
    requestedBy: (r.requestedBy || '').toString().trim(),
    requestedDate: (r.requestedDate || '').toString().trim(),
    requestedTime: (r.requestedTime || '').toString().trim(),
    reason: (r.reason || '').toString().trim(),
    status: (r.status || 'Pending').toString().trim(),
    actionBy: (r.actionBy || '').toString().trim(),
    actionDate: (r.actionDate || '').toString().trim()
  }));
}

async function createEditRequest(reqObj) {
  const reasonVal = (reqObj.reason || '').toString().trim();
  const newId = memoryStore.editRequests.length > 0 ? Math.max(...memoryStore.editRequests.map(r => r.id || 0)) + 1 : 1;

  const item = {
    id: newId,
    rowIndex: newId,
    recordId: reqObj.recordId,
    pid: reqObj.pid,
    name: reqObj.name,
    father: reqObj.father || '',
    utNo: reqObj.utNo || '',
    aadharNo: reqObj.aadharNo || '',
    proposedData: reqObj.proposedData || {},
    requestedBy: reqObj.requestedBy,
    requestedDate: reqObj.requestedDate,
    requestedTime: reqObj.requestedTime,
    reason: reasonVal,
    status: 'Pending',
    actionBy: '',
    actionDate: ''
  };

  memoryStore.editRequests.push(item);

  try {
    const { dbRun } = require('./database');
    const proposedStr = typeof reqObj.proposedData === 'string' ? reqObj.proposedData : JSON.stringify(reqObj.proposedData || {});
    await dbRun(
      `INSERT INTO edit_requests (record_id, pid, name, father, ut_no, aadhar_no, proposed_data, requested_by, requested_date, requested_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.recordId, item.pid, item.name, item.father, item.utNo, item.aadharNo, proposedStr, item.requestedBy, item.requestedDate, item.requestedTime, reasonVal, 'Pending']
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.EDIT_REQUESTS, memoryStore.editRequests);
  return true;
}

async function updateEditRequestStatus(requestId, status, actionBy) {
  const actionDate = getFormattedDateTime();
  const target = memoryStore.editRequests.find(r => (r.id === parseInt(requestId, 10) || r.rowIndex === parseInt(requestId, 10)));
  if (target) {
    target.status = status;
    target.actionBy = actionBy;
    target.actionDate = actionDate;
  }

  try {
    const { dbRun } = require('./database');
    await dbRun(
      `UPDATE edit_requests SET status = ?, action_by = ?, action_date = ? WHERE id = ?`,
      [status, actionBy, actionDate, requestId]
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.EDIT_REQUESTS, memoryStore.editRequests);
  return true;
}

async function deleteEditRequest(requestId) {
  const idNum = parseInt(requestId, 10);
  memoryStore.editRequests = memoryStore.editRequests.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM edit_requests WHERE id = ?`, [idNum]);
  } catch (e) {}

  await saveToR2(R2_KEYS.EDIT_REQUESTS, memoryStore.editRequests);
  return true;
}

/* ==========================================================================
   List Add Requests Methods
   ========================================================================== */

async function getListAddRequests() {
  return memoryStore.listAddRequests.map(r => ({
    id: r.id || r.rowIndex,
    rowIndex: r.rowIndex || r.id,
    optionValue: r.optionValue || r.option_value,
    requestedBy: r.requestedBy || r.requested_by,
    requestedDate: r.requestedDate || r.requested_date,
    requestedTime: r.requestedTime || r.requested_time,
    reason: r.reason,
    status: r.status || 'Pending',
    actionBy: r.actionBy || r.action_by,
    actionDate: r.actionDate || r.action_date,
    createdAt: r.createdAt || r.created_at || Date.now()
  }));
}

async function createListAddRequest(reqObj) {
  const newId = memoryStore.listAddRequests.length > 0 ? Math.max(...memoryStore.listAddRequests.map(r => r.id || 0)) + 1 : 1;
  const nowMs = Date.now();

  const item = {
    id: newId,
    rowIndex: newId,
    optionValue: (reqObj.optionValue || '').toString().trim(),
    requestedBy: reqObj.requestedBy,
    requestedDate: reqObj.requestedDate,
    requestedTime: reqObj.requestedTime,
    reason: reqObj.reason || '',
    status: 'Pending',
    actionBy: '',
    actionDate: '',
    createdAt: nowMs
  };

  memoryStore.listAddRequests.push(item);

  try {
    const { dbRun } = require('./database');
    await dbRun(
      `INSERT INTO list_add_requests (option_value, requested_by, requested_date, requested_time, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.optionValue, item.requestedBy, item.requestedDate, item.requestedTime, item.reason, 'Pending', nowMs]
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.LIST_ADD_REQUESTS, memoryStore.listAddRequests);
  return true;
}

async function updateListAddRequestStatus(requestId, status, actionBy) {
  const actionDate = getFormattedDateTime();
  const target = memoryStore.listAddRequests.find(r => (r.id === parseInt(requestId, 10) || r.rowIndex === parseInt(requestId, 10)));
  if (target) {
    target.status = status;
    target.actionBy = actionBy;
    target.actionDate = actionDate;
  }

  try {
    const { dbRun } = require('./database');
    await dbRun(
      `UPDATE list_add_requests SET status = ?, action_by = ?, action_date = ? WHERE id = ?`,
      [status, actionBy, actionDate, requestId]
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.LIST_ADD_REQUESTS, memoryStore.listAddRequests);
  return true;
}

async function deleteListAddRequest(requestId) {
  const idNum = parseInt(requestId, 10);
  memoryStore.listAddRequests = memoryStore.listAddRequests.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM list_add_requests WHERE id = ?`, [idNum]);
  } catch (e) {}

  await saveToR2(R2_KEYS.LIST_ADD_REQUESTS, memoryStore.listAddRequests);
  return true;
}

/* ==========================================================================
   Remark Options Methods
   ========================================================================== */

async function getRemarkOptions() {
  return memoryStore.remarkOptions.map(opt => {
    if (typeof opt === 'string') {
      return { optionValue: opt.trim(), disableAadhar: false };
    }
    return {
      optionValue: (opt.optionValue || opt.val || '').toString().trim(),
      disableAadhar: !!opt.disableAadhar
    };
  });
}

async function addRemarkOption(optionValue, disableAadhar = false) {
  const cleanVal = (optionValue || '').toString().trim();
  if (!cleanVal) return false;

  const exists = memoryStore.remarkOptions.some(opt => (opt.optionValue || opt).toLowerCase() === cleanVal.toLowerCase());
  if (!exists) {
    const newId = memoryStore.remarkOptions.length + 1;
    memoryStore.remarkOptions.push({ id: newId, optionValue: cleanVal, disableAadhar: !!disableAadhar });

    try {
      const { dbRun } = require('./database');
      await dbRun('INSERT OR IGNORE INTO remark_options (option_value, disable_aadhar) VALUES (?, ?)', [cleanVal, disableAadhar ? 1 : 0]);
    } catch (e) {}

    await saveToR2(R2_KEYS.REMARK_OPTIONS, memoryStore.remarkOptions);
  }
  return true;
}

async function updateRemarkOption(oldValue, newValue) {
  const cleanOld = (oldValue || '').toString().trim();
  const cleanNew = (newValue || '').toString().trim();
  if (!cleanOld || !cleanNew) return false;

  const item = memoryStore.remarkOptions.find(opt => (opt.optionValue || opt).toLowerCase() === cleanOld.toLowerCase());
  if (item) {
    if (typeof item === 'object') item.optionValue = cleanNew;
    else memoryStore.remarkOptions[memoryStore.remarkOptions.indexOf(item)] = { optionValue: cleanNew, disableAadhar: false };

    try {
      const { dbRun } = require('./database');
      await dbRun('UPDATE remark_options SET option_value = ? WHERE LOWER(option_value) = LOWER(?)', [cleanNew, cleanOld]);
    } catch (e) {}

    await saveToR2(R2_KEYS.REMARK_OPTIONS, memoryStore.remarkOptions);
  }
  return true;
}

async function toggleRemarkOptionAadhar(optionValue, disableAadhar) {
  const cleanVal = (optionValue || '').toString().trim();
  if (!cleanVal) return false;

  const item = memoryStore.remarkOptions.find(opt => (typeof opt === 'object' ? opt.optionValue : opt).toString().trim().toLowerCase() === cleanVal.toLowerCase());
  if (item) {
    if (typeof item === 'object') item.disableAadhar = !!disableAadhar;
    else {
      const idx = memoryStore.remarkOptions.indexOf(item);
      memoryStore.remarkOptions[idx] = { optionValue: cleanVal, disableAadhar: !!disableAadhar };
    }
  } else {
    memoryStore.remarkOptions.push({ optionValue: cleanVal, disableAadhar: !!disableAadhar });
  }

  try {
    const { dbRun } = require('./database');
    await dbRun(`
      INSERT INTO remark_options (option_value, disable_aadhar)
      VALUES (?, ?)
      ON CONFLICT(option_value) DO UPDATE SET disable_aadhar = excluded.disable_aadhar
    `, [cleanVal, disableAadhar ? 1 : 0]);
  } catch (e) {}

  await saveToR2(R2_KEYS.REMARK_OPTIONS, memoryStore.remarkOptions);
  return true;
}

async function deleteRemarkOption(optionValue) {
  const cleanVal = (optionValue || '').toString().trim();
  if (!cleanVal) return false;

  memoryStore.remarkOptions = memoryStore.remarkOptions.filter(opt => (opt.optionValue || opt).toLowerCase() !== cleanVal.toLowerCase());

  try {
    const { dbRun } = require('./database');
    await dbRun('DELETE FROM remark_options WHERE LOWER(option_value) = LOWER(?)', [cleanVal]);
  } catch (e) {}

  await saveToR2(R2_KEYS.REMARK_OPTIONS, memoryStore.remarkOptions);
  return true;
}

/* ==========================================================================
   System Settings Methods
   ========================================================================== */

async function getSystemSettings() {
  const raw = memoryStore.settings ? (memoryStore.settings.aadhar_mandatory ?? memoryStore.settings.aadharMandatory) : false;
  const aadharMandatory = String(raw).trim().toLowerCase() === 'true' || String(raw).trim() === '1';
  return { aadharMandatory };
}

async function updateSystemSetting(key, value) {
  const strVal = (String(value).toLowerCase() === 'true' || String(value) === '1') ? 'true' : 'false';
  if (!memoryStore.settings) memoryStore.settings = {};
  memoryStore.settings[key] = strVal;

  await saveToR2(R2_KEYS.SETTINGS, memoryStore.settings);
  return await getSystemSettings();
}

module.exports = {
  initCloudflareStorage,
  initGoogleSheets: initCloudflareStorage, // Backward compatibility alias
  getUsers,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  getRecords,
  addRecord,
  updateRecord,
  deleteRecord,
  batchAddRecords,
  getDeleteRequests,
  createDeleteRequest,
  updateDeleteRequestStatus,
  deleteDeleteRequest,
  getEditRequests,
  createEditRequest,
  updateEditRequestStatus,
  deleteEditRequest,
  getListAddRequests,
  createListAddRequest,
  updateListAddRequestStatus,
  deleteListAddRequest,
  getRemarkOptions,
  addRemarkOption,
  updateRemarkOption,
  deleteRemarkOption,
  toggleRemarkOptionAadhar,
  getSystemSettings,
  updateSystemSetting,
  getIsConnected: () => isConnected,
  getConnectionError: () => connectionError
};
