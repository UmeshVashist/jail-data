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
  SETTINGS: 'data/system_settings.json',
  PS_LIST: 'data/ps_list.json'
};

/* In-memory Data Store (Auto-seeded with defaults) */
const memoryStore = {
  users: [
    { id: 1, rowIndex: 1, username: 'Admin', password: 'Admin@123', role: 'Admin', importPermission: true, fullAccess: true, deleteRequestPermission: true, psListPermission: true, status: 'Active' },
    { id: 2, rowIndex: 2, username: 'Add', password: 'Add@123', role: 'Add', importPermission: false, fullAccess: false, deleteRequestPermission: false, psListPermission: false, status: 'Active' },
    { id: 3, rowIndex: 3, username: 'View', password: 'View@123', role: 'View', importPermission: false, fullAccess: false, deleteRequestPermission: false, psListPermission: false, status: 'Active' }
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
  },
  psList: []
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

  const psList = readLocal(R2_KEYS.PS_LIST);
  if (psList && Array.isArray(psList)) {
    memoryStore.psList = psList.filter(p => {
      const name = (p.psName || p.ps || '').trim().toLowerCase();
      return !['sadar bazar', 'civil lines', 'sector 14', 'indirapuram'].includes(name);
    });
  }
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

/* Dynamic Sync Cache Tracking for Multi-User & Multi-Computer Real-Time Sync */
const lastSyncTimestamps = {
  users: 0,
  records: 0,
  deleteRequests: 0,
  editRequests: 0,
  listAddRequests: 0,
  remarkOptions: 0,
  settings: 0,
  psList: 0
};
const SYNC_CACHE_TTL = 3000; // 3 seconds cache TTL ensures instant updates across all computers without excess network calls

async function ensureRecordsSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.records > SYNC_CACHE_TTL)) {
    const remote = await readFromR2(R2_KEYS.RECORDS);
    if (remote && Array.isArray(remote)) {
      memoryStore.records = remote;
      lastSyncTimestamps.records = now;
    }
  }
}

async function ensurePSSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.psList > SYNC_CACHE_TTL)) {
    const remote = await readFromR2(R2_KEYS.PS_LIST);
    if (remote && Array.isArray(remote)) {
      memoryStore.psList = remote.filter(p => {
        const name = (p.psName || p.ps || '').trim().toLowerCase();
        return !['sadar bazar', 'civil lines', 'sector 14', 'indirapuram'].includes(name);
      });
      lastSyncTimestamps.psList = now;
    }
  }
}

async function ensureUsersSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.users > SYNC_CACHE_TTL)) {
    const remote = await readFromR2(R2_KEYS.USERS);
    if (remote && Array.isArray(remote)) {
      memoryStore.users = remote;
      lastSyncTimestamps.users = now;
    }
  }
}

async function ensureSettingsSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.settings > SYNC_CACHE_TTL)) {
    const remote = await readFromR2(R2_KEYS.SETTINGS);
    if (remote && typeof remote === 'object') {
      memoryStore.settings = remote;
      lastSyncTimestamps.settings = now;
    }
  }
}

async function ensureDeleteRequestsSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.deleteRequests > SYNC_CACHE_TTL)) {
    let remote = await readFromR2(R2_KEYS.DELETE_REQUESTS);
    if (!remote || !Array.isArray(remote) || remote.length === 0) {
      try {
        const { dbAll } = require('./database');
        const rows = await dbAll('SELECT * FROM delete_requests ORDER BY id DESC');
        if (rows && rows.length > 0) {
          remote = rows.map(r => ({
            id: r.id,
            rowIndex: r.id,
            recordId: (r.record_id || r.recordId || r.id).toString(),
            pid: (r.pid || '').toString().trim(),
            name: (r.name || '').toString().trim(),
            father: (r.father || '').toString().trim(),
            utNo: (r.ut_no || r.utNo || '').toString().trim(),
            aadharNo: (r.aadhar_no || r.aadharNo || '').toString().trim(),
            requestedBy: (r.requested_by || r.requestedBy || '').toString().trim(),
            requestedDate: (r.requested_date || r.requestedDate || '').toString().trim(),
            requestedTime: (r.requested_time || r.requestedTime || '').toString().trim(),
            reason: (r.reason || r.remark || '').toString().trim(),
            remark: (r.remark || r.reason || '').toString().trim(),
            status: (r.status || 'Pending').toString().trim(),
            actionBy: (r.action_by || r.actionBy || '').toString().trim(),
            actionDate: (r.action_date || r.actionDate || '').toString().trim()
          }));
        }
      } catch (e) {}
    }
    if (remote && Array.isArray(remote)) {
      memoryStore.deleteRequests = remote;
      lastSyncTimestamps.deleteRequests = now;
    }
  }
}

async function ensureEditRequestsSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.editRequests > SYNC_CACHE_TTL)) {
    let remote = await readFromR2(R2_KEYS.EDIT_REQUESTS);
    if (!remote || !Array.isArray(remote) || remote.length === 0) {
      try {
        const { dbAll } = require('./database');
        const rows = await dbAll('SELECT * FROM edit_requests ORDER BY id DESC');
        if (rows && rows.length > 0) {
          remote = rows.map(r => ({
            id: r.id,
            rowIndex: r.id,
            recordId: (r.record_id || r.recordId || r.id).toString(),
            pid: (r.pid || '').toString().trim(),
            name: (r.name || '').toString().trim(),
            father: (r.father || '').toString().trim(),
            utNo: (r.ut_no || r.utNo || '').toString().trim(),
            aadharNo: (r.aadhar_no || r.aadharNo || '').toString().trim(),
            proposedData: typeof r.proposed_data === 'string' ? JSON.parse(r.proposed_data || '{}') : (r.proposed_data || r.proposedData || {}),
            requestedBy: (r.requested_by || r.requestedBy || '').toString().trim(),
            requestedDate: (r.requested_date || r.requestedDate || '').toString().trim(),
            requestedTime: (r.requested_time || r.requestedTime || '').toString().trim(),
            reason: (r.reason || '').toString().trim(),
            status: (r.status || 'Pending').toString().trim(),
            actionBy: (r.action_by || r.actionBy || '').toString().trim(),
            actionDate: (r.action_date || r.actionDate || '').toString().trim()
          }));
        }
      } catch (e) {}
    }
    if (remote && Array.isArray(remote)) {
      memoryStore.editRequests = remote;
      lastSyncTimestamps.editRequests = now;
    }
  }
}

async function ensureListAddRequestsSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.listAddRequests > SYNC_CACHE_TTL)) {
    let remote = await readFromR2(R2_KEYS.LIST_ADD_REQUESTS);
    if (!remote || !Array.isArray(remote) || remote.length === 0) {
      try {
        const { dbAll } = require('./database');
        const rows = await dbAll('SELECT * FROM list_add_requests ORDER BY id DESC');
        if (rows && rows.length > 0) {
          remote = rows.map(r => ({
            id: r.id,
            rowIndex: r.id,
            optionValue: r.option_value || r.optionValue,
            requestedBy: r.requested_by || r.requestedBy,
            requestedDate: r.requested_date || r.requestedDate,
            requestedTime: r.requested_time || r.requestedTime,
            reason: r.reason,
            status: r.status || 'Pending',
            actionBy: r.action_by || r.actionBy,
            actionDate: r.action_date || r.actionDate,
            createdAt: r.created_at || r.createdAt || Date.now()
          }));
        }
      } catch (e) {}
    }
    if (remote && Array.isArray(remote)) {
      memoryStore.listAddRequests = remote;
      lastSyncTimestamps.listAddRequests = now;
    }
  }
}

async function ensureRemarkOptionsSynced(force = false) {
  const now = Date.now();
  if (force || (now - lastSyncTimestamps.remarkOptions > SYNC_CACHE_TTL)) {
    let remote = await readFromR2(R2_KEYS.REMARK_OPTIONS);
    if (!remote || !Array.isArray(remote) || remote.length === 0) {
      try {
        const { dbAll } = require('./database');
        const rows = await dbAll('SELECT * FROM remark_options ORDER BY id ASC');
        if (rows && rows.length > 0) {
          remote = rows.map(r => ({
            id: r.id,
            optionValue: r.option_value,
            disableAadhar: !!r.disable_aadhar
          }));
        }
      } catch (e) {}
    }
    if (remote && Array.isArray(remote) && remote.length > 0) {
      memoryStore.remarkOptions = remote;
      lastSyncTimestamps.remarkOptions = now;
    }
  }
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

    // 8. PS List
    const r2PS = await readFromR2(R2_KEYS.PS_LIST);
    if (r2PS && Array.isArray(r2PS)) {
      memoryStore.psList = r2PS.filter(p => {
        const name = (p.psName || p.ps || '').trim().toLowerCase();
        return !['sadar bazar', 'civil lines', 'sector 14', 'indirapuram'].includes(name);
      });
      if (memoryStore.psList.length !== r2PS.length) {
        await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
      }
    } else {
      // Check local SQLite database
      try {
        const { dbAll } = require('./database');
        const rows = await dbAll('SELECT * FROM police_stations ORDER BY id DESC');
        if (rows && rows.length > 0) {
          memoryStore.psList = rows.map(r => ({
            id: r.id,
            psName: r.ps_name,
            ps: r.ps_name,
            district: r.district,
            state: r.state,
            createdBy: r.created_by,
            createdDate: r.created_date,
            updatedDate: r.updated_date || ''
          }));
          await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
        } else {
          const local = readLocal(R2_KEYS.PS_LIST);
          const cleanLocal = Array.isArray(local) ? local.filter(p => {
            const name = (p.psName || p.ps || '').trim().toLowerCase();
            return !['sadar bazar', 'civil lines', 'sector 14', 'indirapuram'].includes(name);
          }) : [];
          memoryStore.psList = cleanLocal;
          await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
        }
      } catch (e) {
        const local = readLocal(R2_KEYS.PS_LIST);
        memoryStore.psList = Array.isArray(local) ? local.filter(p => {
          const name = (p.psName || p.ps || '').trim().toLowerCase();
          return !['sadar bazar', 'civil lines', 'sector 14', 'indirapuram'].includes(name);
        }) : [];
      }
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
  await ensureUsersSynced();
  return memoryStore.users.map(u => {
    const isAdmin = (u.role || '').trim().toLowerCase() === 'admin';
    return {
      id: u.id || u.rowIndex,
      rowIndex: u.rowIndex || u.id,
      username: (u.username || '').trim(),
      password: u.password,
      role: u.role || 'View',
      importPermission: !!u.importPermission,
      fullAccess: !!u.fullAccess,
      deleteRequestPermission: !!u.deleteRequestPermission,
      psListPermission: isAdmin ? true : !!u.psListPermission,
      status: (u.status || 'Active').trim()
    };
  });
}

async function getUserByUsername(username) {
  await ensureUsersSynced();
  const users = await getUsers();
  const target = (username || '').toLowerCase().trim();
  return users.find(u => u.username.toLowerCase() === target) || null;
}

async function createUser(userObj) {
  await ensureUsersSynced(true);
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
    psListPermission: !!userObj.psListPermission,
    status: userObj.status || 'Active'
  };

  memoryStore.users.push(newUser);

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.USERS, memoryStore.users);
  lastSyncTimestamps.users = Date.now();
  return newUser;
}

async function updateUser(rowIndex, updateFields) {
  await ensureUsersSynced(true);
  const target = memoryStore.users.find(u => (u.id === parseInt(rowIndex, 10) || u.rowIndex === parseInt(rowIndex, 10)));
  if (!target) return false;

  if (updateFields.password) target.password = updateFields.password;
  if (updateFields.role) target.role = updateFields.role;
  if (updateFields.importPermission !== undefined) target.importPermission = !!updateFields.importPermission;
  if (updateFields.fullAccess !== undefined) target.fullAccess = !!updateFields.fullAccess;
  if (updateFields.deleteRequestPermission !== undefined) target.deleteRequestPermission = !!updateFields.deleteRequestPermission;
  if (updateFields.psListPermission !== undefined) target.psListPermission = !!updateFields.psListPermission;
  if (updateFields.status) target.status = updateFields.status;

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    let sql = 'UPDATE users SET role = ?, import_permission = ?, full_access = ?, delete_request_permission = ?, ps_list_permission = ?, status = ?';
    let params = [target.role, target.importPermission ? 1 : 0, target.fullAccess ? 1 : 0, target.deleteRequestPermission ? 1 : 0, target.psListPermission ? 1 : 0, target.status];
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
  lastSyncTimestamps.users = Date.now();
  return true;
}

async function deleteUser(rowIndex) {
  await ensureUsersSynced(true);
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
  lastSyncTimestamps.users = Date.now();
  return true;
}

/* ==========================================================================
   Records Data Access Methods
   ========================================================================== */

async function getRecords() {
  await ensureRecordsSynced();
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
  // Always fetch latest from Cloudflare R2 first to prevent overwriting multi-computer data
  await ensureRecordsSynced(true);
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
  lastSyncTimestamps.records = Date.now();
  return newRec;
}

async function updateRecord(rowIndex, recObj) {
  await ensureRecordsSynced(true);
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
  lastSyncTimestamps.records = Date.now();
  return true;
}

async function deleteRecord(rowIndex) {
  await ensureRecordsSynced(true);
  const idNum = parseInt(rowIndex, 10);
  memoryStore.records = memoryStore.records.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  // Sync to local SQLite
  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM records WHERE id = ?`, [idNum]);
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.RECORDS, memoryStore.records);
  lastSyncTimestamps.records = Date.now();
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
  await ensureDeleteRequestsSynced();
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
  await ensureDeleteRequestsSynced(true);
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

  memoryStore.deleteRequests.unshift(item);

  try {
    const { dbRun } = require('./database');
    await dbRun(
      `INSERT INTO delete_requests (record_id, pid, name, father, ut_no, aadhar_no, requested_by, requested_date, requested_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.recordId, item.pid, item.name, item.father, item.utNo, item.aadharNo, item.requestedBy, item.requestedDate, item.requestedTime, item.remark, 'Pending']
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.DELETE_REQUESTS, memoryStore.deleteRequests);
  lastSyncTimestamps.deleteRequests = Date.now();
  return true;
}

async function updateDeleteRequestStatus(requestId, status, actionBy) {
  await ensureDeleteRequestsSynced(true);
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
  lastSyncTimestamps.deleteRequests = Date.now();
  return true;
}

async function deleteDeleteRequest(requestId) {
  await ensureDeleteRequestsSynced(true);
  const idNum = parseInt(requestId, 10);
  memoryStore.deleteRequests = memoryStore.deleteRequests.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM delete_requests WHERE id = ?`, [idNum]);
  } catch (e) {}

  await saveToR2(R2_KEYS.DELETE_REQUESTS, memoryStore.deleteRequests);
  lastSyncTimestamps.deleteRequests = Date.now();
  return true;
}

/* ==========================================================================
   Edit Requests Methods
   ========================================================================== */

async function getEditRequests() {
  await ensureEditRequestsSynced();
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
  await ensureEditRequestsSynced(true);
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

  memoryStore.editRequests.unshift(item);

  try {
    const { dbRun } = require('./database');
    const proposedStr = typeof reqObj.proposedData === 'string' ? reqObj.proposedData : JSON.stringify(reqObj.proposedData || {});
    await dbRun(
      `INSERT INTO edit_requests (record_id, pid, name, father, ut_no, aadhar_no, proposed_data, requested_by, requested_date, requested_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.recordId, item.pid, item.name, item.father, item.utNo, item.aadharNo, proposedStr, item.requestedBy, item.requestedDate, item.requestedTime, reasonVal, 'Pending']
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.EDIT_REQUESTS, memoryStore.editRequests);
  lastSyncTimestamps.editRequests = Date.now();
  return true;
}

async function updateEditRequestStatus(requestId, status, actionBy) {
  await ensureEditRequestsSynced(true);
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
  lastSyncTimestamps.editRequests = Date.now();
  return true;
}

async function deleteEditRequest(requestId) {
  await ensureEditRequestsSynced(true);
  const idNum = parseInt(requestId, 10);
  memoryStore.editRequests = memoryStore.editRequests.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM edit_requests WHERE id = ?`, [idNum]);
  } catch (e) {}

  await saveToR2(R2_KEYS.EDIT_REQUESTS, memoryStore.editRequests);
  lastSyncTimestamps.editRequests = Date.now();
  return true;
}

/* ==========================================================================
   List Add Requests Methods
   ========================================================================== */

async function getListAddRequests() {
  await ensureListAddRequestsSynced();
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
  await ensureListAddRequestsSynced(true);
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

  memoryStore.listAddRequests.unshift(item);

  try {
    const { dbRun } = require('./database');
    await dbRun(
      `INSERT INTO list_add_requests (option_value, requested_by, requested_date, requested_time, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.optionValue, item.requestedBy, item.requestedDate, item.requestedTime, item.reason, 'Pending', nowMs]
    );
  } catch (e) {}

  await saveToR2(R2_KEYS.LIST_ADD_REQUESTS, memoryStore.listAddRequests);
  lastSyncTimestamps.listAddRequests = Date.now();
  return true;
}

async function updateListAddRequestStatus(requestId, status, actionBy) {
  await ensureListAddRequestsSynced(true);
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
  lastSyncTimestamps.listAddRequests = Date.now();
  return true;
}

async function deleteListAddRequest(requestId) {
  await ensureListAddRequestsSynced(true);
  const idNum = parseInt(requestId, 10);
  memoryStore.listAddRequests = memoryStore.listAddRequests.filter(r => (r.id !== idNum && r.rowIndex !== idNum));

  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM list_add_requests WHERE id = ?`, [idNum]);
  } catch (e) {}

  await saveToR2(R2_KEYS.LIST_ADD_REQUESTS, memoryStore.listAddRequests);
  lastSyncTimestamps.listAddRequests = Date.now();
  return true;
}

/* ==========================================================================
   Remark Options Methods
   ========================================================================== */

async function getRemarkOptions() {
  await ensureRemarkOptionsSynced();
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
  await ensureRemarkOptionsSynced(true);
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
    lastSyncTimestamps.remarkOptions = Date.now();
  }
  return true;
}

async function updateRemarkOption(oldValue, newValue) {
  await ensureRemarkOptionsSynced(true);
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
    lastSyncTimestamps.remarkOptions = Date.now();
  }
  return true;
}

async function toggleRemarkOptionAadhar(optionValue, disableAadhar) {
  await ensureRemarkOptionsSynced(true);
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
  lastSyncTimestamps.remarkOptions = Date.now();
  return true;
}

async function deleteRemarkOption(optionValue) {
  await ensureRemarkOptionsSynced(true);
  const cleanVal = (optionValue || '').toString().trim();
  if (!cleanVal) return false;

  memoryStore.remarkOptions = memoryStore.remarkOptions.filter(opt => (opt.optionValue || opt).toLowerCase() !== cleanVal.toLowerCase());

  try {
    const { dbRun } = require('./database');
    await dbRun('DELETE FROM remark_options WHERE LOWER(option_value) = LOWER(?)', [cleanVal]);
  } catch (e) {}

  await saveToR2(R2_KEYS.REMARK_OPTIONS, memoryStore.remarkOptions);
  lastSyncTimestamps.remarkOptions = Date.now();
  return true;
}

/* ==========================================================================
   System Settings Methods
   ========================================================================== */

async function getSystemSettings() {
  await ensureSettingsSynced();
  const raw = memoryStore.settings ? (memoryStore.settings.aadhar_mandatory ?? memoryStore.settings.aadharMandatory) : false;
  const aadharMandatory = String(raw).trim().toLowerCase() === 'true' || String(raw).trim() === '1';
  return { aadharMandatory };
}

async function updateSystemSetting(key, value) {
  await ensureSettingsSynced(true);
  const strVal = (String(value).toLowerCase() === 'true' || String(value) === '1') ? 'true' : 'false';
  if (!memoryStore.settings) memoryStore.settings = {};
  memoryStore.settings[key] = strVal;

  await saveToR2(R2_KEYS.SETTINGS, memoryStore.settings);
  lastSyncTimestamps.settings = Date.now();
  return await getSystemSettings();
}

/* ==========================================================================
   PS List (Police Stations) Methods
   ========================================================================== */

async function getPSList() {
  await ensurePSSynced();
  return (memoryStore.psList || []).map(p => {
    const val = (p.psName || p.ps || p.name || '').toString().trim();
    return {
      id: p.id,
      psName: val,
      ps: val,
      district: (p.district || '').toString().trim(),
      state: (p.state || '').toString().trim(),
      createdBy: p.createdBy || 'Admin',
      createdDate: p.createdDate || '',
      updatedDate: p.updatedDate || ''
    };
  });
}

async function addPSEntry(entryObj) {
  await ensurePSSynced(true);
  const newId = memoryStore.psList.length > 0 ? Math.max(...memoryStore.psList.map(p => p.id || 0)) + 1 : 1;
  const cleanPS = (entryObj.psName || entryObj.ps || entryObj.name || '').toString().trim();
  const newEntry = {
    id: newId,
    psName: cleanPS,
    ps: cleanPS,
    district: (entryObj.district || '').toString().trim(),
    state: (entryObj.state || '').toString().trim(),
    createdBy: entryObj.createdBy || 'Admin',
    createdDate: entryObj.createdDate || getFormattedDateTime(),
    updatedDate: ''
  };

  memoryStore.psList.unshift(newEntry);

  // Sync to local SQLite database
  try {
    const { dbRun } = require('./database');
    await dbRun(
      `INSERT OR REPLACE INTO police_stations (id, ps_name, district, state, created_by, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newEntry.id, newEntry.psName, newEntry.district, newEntry.state, newEntry.createdBy, newEntry.createdDate, newEntry.updatedDate]
    );
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
  lastSyncTimestamps.psList = Date.now();
  return newEntry;
}

async function updatePSEntry(id, entryObj) {
  await ensurePSSynced(true);
  const idNum = parseInt(id, 10);
  const target = memoryStore.psList.find(p => p.id === idNum);
  if (!target) return false;

  const cleanPS = entryObj.psName !== undefined ? entryObj.psName : entryObj.ps;
  if (cleanPS !== undefined) {
    target.psName = (cleanPS || '').toString().trim();
    target.ps = target.psName;
  }
  if (entryObj.district !== undefined) target.district = (entryObj.district || '').toString().trim();
  if (entryObj.state !== undefined) target.state = (entryObj.state || '').toString().trim();
  target.updatedDate = getFormattedDateTime();

  // Sync to local SQLite database
  try {
    const { dbRun } = require('./database');
    await dbRun(
      `UPDATE police_stations SET ps_name = ?, district = ?, state = ?, updated_date = ? WHERE id = ?`,
      [target.psName, target.district, target.state, target.updatedDate, idNum]
    );
  } catch (e) {}

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
  lastSyncTimestamps.psList = Date.now();
  return target;
}

async function deletePSEntry(id) {
  await ensurePSSynced(true);
  const idNum = parseInt(id, 10);
  const initialLen = memoryStore.psList.length;
  memoryStore.psList = memoryStore.psList.filter(p => p.id !== idNum);
  if (memoryStore.psList.length !== initialLen) {
    // Sync to local SQLite database
    try {
      const { dbRun } = require('./database');
      await dbRun(`DELETE FROM police_stations WHERE id = ?`, [idNum]);
    } catch (e) {}

    // Sync to Cloudflare R2
    await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
    lastSyncTimestamps.psList = Date.now();
    return true;
  }
  return false;
}

async function batchDeletePSEntries(ids) {
  await ensurePSSynced(true);
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const idNums = ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
  if (idNums.length === 0) return 0;
  const idSet = new Set(idNums);
  const initialLen = memoryStore.psList.length;
  memoryStore.psList = memoryStore.psList.filter(p => !idSet.has(p.id));
  const deletedCount = initialLen - memoryStore.psList.length;

  if (deletedCount > 0) {
    // Sync to local SQLite database
    try {
      const { dbRun } = require('./database');
      const placeholders = idNums.map(() => '?').join(',');
      await dbRun(`DELETE FROM police_stations WHERE id IN (${placeholders})`, idNums);
    } catch (e) {
      console.error('[batchDeletePSEntries SQLite error]', e);
    }

    // Sync to Cloudflare R2
    await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
    lastSyncTimestamps.psList = Date.now();
  }
  return deletedCount;
}

async function deleteAllPSEntries() {
  await ensurePSSynced(true);
  const initialLen = memoryStore.psList.length;
  memoryStore.psList = [];

  // Sync to local SQLite database
  try {
    const { dbRun } = require('./database');
    await dbRun(`DELETE FROM police_stations`);
  } catch (e) {
    console.error('[deleteAllPSEntries SQLite error]', e);
  }

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.PS_LIST, []);
  lastSyncTimestamps.psList = Date.now();
  return initialLen;
}

async function batchAddPS(entriesArr) {
  if (!Array.isArray(entriesArr) || entriesArr.length === 0) return true;
  await ensurePSSynced(true);
  let maxId = memoryStore.psList.length > 0 ? Math.max(...memoryStore.psList.map(p => p.id || 0)) : 0;
  const now = getFormattedDateTime();

  for (const item of entriesArr) {
    const psName = (item.psName || item.ps || item.name || item['PS Name'] || item['ps_name'] || item['PS'] || '').toString().trim();
    const district = (item.district || item['District'] || '').toString().trim();
    const state = (item.state || item['State'] || '').toString().trim();

    if (!psName && !district) continue;

    maxId++;
    const entry = {
      id: maxId,
      psName,
      ps: psName,
      district,
      state,
      createdBy: item.createdBy || 'Admin',
      createdDate: item.createdDate || now,
      updatedDate: ''
    };
    memoryStore.psList.push(entry);

    // Sync to local SQLite database
    try {
      const { dbRun } = require('./database');
      await dbRun(
        `INSERT OR REPLACE INTO police_stations (id, ps_name, district, state, created_by, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entry.id, entry.psName, entry.district, entry.state, entry.createdBy, entry.createdDate, '']
      );
    } catch (e) {}
  }

  // Sync to Cloudflare R2
  await saveToR2(R2_KEYS.PS_LIST, memoryStore.psList);
  lastSyncTimestamps.psList = Date.now();
  return true;
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
  getPSList,
  addPSEntry,
  updatePSEntry,
  deletePSEntry,
  batchDeletePSEntries,
  deleteAllPSEntries,
  batchAddPS,
  getIsConnected: () => isConnected,
  getConnectionError: () => connectionError
};
