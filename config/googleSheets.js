/**
 * config/googleSheets.js - Direct Google Sheets API Integration Service
 * Reads credentials directly from .env variables with fallback to config/credentials.json
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ? process.env.SPREADSHEET_ID.replace(/"/g, '').trim() : '';
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

let doc = null;
let dataSheet = null;
let usersSheet = null;
let deleteRequestsSheet = null;
let isConnected = false;
let connectionError = null;

const inMemoryData = {
  users: [
    { rowIndex: 2, username: 'Admin', password: 'Admin@123', role: 'Admin', importPermission: true, fullAccess: true, deleteRequestPermission: true, status: 'Active' },
    { rowIndex: 3, username: 'Add', password: 'Add@123', role: 'Add', importPermission: false, fullAccess: false, deleteRequestPermission: false, status: 'Active' },
    { rowIndex: 4, username: 'View', password: 'View@123', role: 'View', importPermission: false, fullAccess: false, deleteRequestPermission: false, status: 'Active' }
  ],
  records: [],
  deleteRequests: []
};

/**
 * Initializes connection to Google Spreadsheet.
 */
async function initGoogleSheets() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
    connectionError = 'Spreadsheet ID not set in .env file.';
    console.warn('\n===============================================================');
    console.warn('  [NOTICE] Google Spreadsheet ID is not configured in .env file.');
    console.warn('  Please paste your Google Spreadsheet ID in .env');
    console.warn('  Running in Fallback Mode with default test accounts.');
    console.warn('===============================================================\n');
    return false;
  }

  // Load credentials from .env or fallback to credentials.json
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.replace(/"/g, '').trim() : '';
  let privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.trim() : '';

  if (fs.existsSync(CREDENTIALS_PATH)) {
    try {
      const rawText = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
      const creds = JSON.parse(rawText);
      if (!clientEmail) clientEmail = creds.client_email;
      if (!privateKey) privateKey = creds.private_key;
    } catch (e) {
      // JSON parse fallback
    }
  }

  if (!clientEmail) {
    connectionError = 'Service Account email not set in .env or config/credentials.json';
    console.warn('\n===============================================================');
    console.warn('  [NOTICE] GOOGLE_SERVICE_ACCOUNT_EMAIL is missing in .env');
    console.warn('===============================================================\n');
    return false;
  }

  try {
    let formattedPrivateKey = privateKey;
    if (formattedPrivateKey) {
      // Strip leading/trailing single or double quotes
      formattedPrivateKey = formattedPrivateKey.trim().replace(/^['"]/, '').replace(/['"]$/, '').trim();
      // Replace literal \n with real newline characters
      if (formattedPrivateKey.includes('\\n')) {
        formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
      }
    }

    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: formattedPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log(`\n===============================================================`);
    console.log(`  SUCCESS! Connected to Live Google Sheet: "${doc.title}"`);
    console.log(`  Credentials loaded directly from .env variables`);
    console.log(`===============================================================\n`);

    // Ensure 'Data' sheet exists
    dataSheet = doc.sheetsByTitle['Data'];
    if (!dataSheet) {
      console.log('Creating "Data" sheet in Google Sheet...');
      dataSheet = await doc.addSheet({
        title: 'Data',
        headerValues: ['PID', 'Name', 'Father', 'UT No', 'Aadhar no.', 'Date', 'Remark', 'Created By', 'Created Date', 'Created Time', 'Updated Date', 'Updated Time']
      });
    }

    // Ensure 'Users' sheet exists
    usersSheet = doc.sheetsByTitle['Users'];
    if (!usersSheet) {
      console.log('Creating "Users" sheet in Google Sheet...');
      usersSheet = await doc.addSheet({
        title: 'Users',
        headerValues: ['Username', 'Password', 'Role', 'Import Permission', 'Full Access', 'Delete Request Permission', 'Status']
      });

      await usersSheet.addRows([
        { Username: 'Admin', Password: 'Admin@123', Role: 'Admin', 'Import Permission': 'Yes', 'Full Access': 'Yes', 'Delete Request Permission': 'Yes', Status: 'Active' },
        { Username: 'Add', Password: 'Add@123', Role: 'Add', 'Import Permission': 'No', 'Full Access': 'No', 'Delete Request Permission': 'No', Status: 'Active' },
        { Username: 'View', Password: 'View@123', Role: 'View', 'Import Permission': 'No', 'Full Access': 'No', 'Delete Request Permission': 'No', Status: 'Active' }
      ]);
      console.log('Default user accounts seeded into Google Sheet.');
    } else {
      const existingUserRows = await usersSheet.getRows();
      if (existingUserRows.length === 0) {
        console.log('Seeding default user accounts into empty "Users" sheet...');

        await usersSheet.addRows([
          { Username: 'Admin', Password: 'Admin@123', Role: 'Admin', 'Import Permission': 'Yes', 'Full Access': 'Yes', 'Delete Request Permission': 'Yes', Status: 'Active' },
          { Username: 'Add', Password: 'Add@123', Role: 'Add', 'Import Permission': 'No', 'Full Access': 'No', 'Delete Request Permission': 'No', Status: 'Active' },
          { Username: 'View', Password: 'View@123', Role: 'View', 'Import Permission': 'No', 'Full Access': 'No', 'Delete Request Permission': 'No', Status: 'Active' }
        ]);
      }
    }

    // Ensure 'DeleteRequests' sheet exists
    deleteRequestsSheet = doc.sheetsByTitle['DeleteRequests'];
    if (!deleteRequestsSheet) {
      console.log('Creating "DeleteRequests" sheet in Google Sheet...');
      deleteRequestsSheet = await doc.addSheet({
        title: 'DeleteRequests',
        headerValues: ['ID', 'Record PID', 'Record Name', 'Father', 'UT No', 'Aadhar No', 'Requested By', 'Requested Date', 'Requested Time', 'Status', 'Action By', 'Action Date']
      });
    }

    isConnected = true;
    return true;
  } catch (err) {
    connectionError = err.message;
    console.error('Error connecting to Google Sheets API:', err.message);
    return false;
  }
}

/* Helper to normalize Excel date serial numbers or date strings */
function formatDateValue(val) {
  if (val === null || val === undefined || val === '') {
    return '';
  }

  const numVal = Number(val);
  if (!isNaN(numVal) && typeof val !== 'boolean') {
    if (numVal > 10000 && numVal < 90000) {
      const dateObj = new Date(Math.round((numVal - 25569) * 86400 * 1000));
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getFullYear();
        const m = ('0' + (dateObj.getMonth() + 1)).slice(-2);
        const d = ('0' + dateObj.getDate()).slice(-2);
        return `${y}-${m}-${d}`;
      }
    }
  }

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

/* ==========================================================================
   Users Data Access Methods
   ========================================================================== */

async function getUsers() {
  if (!isConnected) {
    return inMemoryData.users;
  }

  try {
    const rows = await usersSheet.getRows();
    return rows.map(row => ({
      rowIndex: row.rowNumber,
      username: (row.get('Username') || '').toString().trim(),
      password: (row.get('Password') || '').toString().trim(),
      role: (row.get('Role') || 'View').toString().trim(),
      importPermission: (row.get('Import Permission') || '').toString().trim().toLowerCase() === 'yes',
      fullAccess: (row.get('Full Access') || '').toString().trim().toLowerCase() === 'yes',
      deleteRequestPermission: (row.get('Delete Request Permission') || '').toString().trim().toLowerCase() === 'yes',
      status: (row.get('Status') || 'Active').toString().trim()
    }));
  } catch (err) {
    console.error('getUsers error:', err.message);
    return inMemoryData.users;
  }
}

async function getUserByUsername(username) {
  const users = await getUsers();
  const target = (username || '').toLowerCase();
  return users.find(u => u.username.toLowerCase() === target) || null;
}

async function createUser(userObj) {
  if (!isConnected) {
    const newId = inMemoryData.users.length + 2;
    const newUser = {
      rowIndex: newId,
      username: userObj.username,
      password: userObj.password,
      role: userObj.role || 'View',
      importPermission: userObj.importPermission || false,
      fullAccess: userObj.fullAccess || false,
      deleteRequestPermission: userObj.deleteRequestPermission || false,
      status: userObj.status || 'Active'
    };
    inMemoryData.users.push(newUser);
    return true;
  }

  await usersSheet.addRow({
    Username: userObj.username,
    Password: userObj.password,
    Role: userObj.role || 'View',
    'Import Permission': userObj.importPermission ? 'Yes' : 'No',
    'Full Access': userObj.fullAccess ? 'Yes' : 'No',
    'Delete Request Permission': userObj.deleteRequestPermission ? 'Yes' : 'No',
    Status: userObj.status || 'Active'
  });
  return true;
}

async function updateUser(rowIndex, userObj) {
  if (!isConnected) {
    const target = inMemoryData.users.find(u => u.rowIndex === parseInt(rowIndex, 10));
    if (target) {
      if (userObj.password) target.password = userObj.password;
      if (userObj.role) target.role = userObj.role;
      if (userObj.importPermission !== undefined) target.importPermission = userObj.importPermission;
      if (userObj.fullAccess !== undefined) target.fullAccess = userObj.fullAccess;
      if (userObj.deleteRequestPermission !== undefined) target.deleteRequestPermission = userObj.deleteRequestPermission;
      if (userObj.status) target.status = userObj.status;
    }
    return true;
  }

  const rows = await usersSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(rowIndex, 10));
  if (targetRow) {
    if (userObj.role) targetRow.set('Role', userObj.role);
    if (userObj.importPermission !== undefined) targetRow.set('Import Permission', userObj.importPermission ? 'Yes' : 'No');
    if (userObj.fullAccess !== undefined) targetRow.set('Full Access', userObj.fullAccess ? 'Yes' : 'No');
    if (userObj.deleteRequestPermission !== undefined) targetRow.set('Delete Request Permission', userObj.deleteRequestPermission ? 'Yes' : 'No');
    if (userObj.status) targetRow.set('Status', userObj.status);
    if (userObj.password) targetRow.set('Password', userObj.password);
    await targetRow.save();
  }
  return true;
}

async function deleteUser(rowIndex, targetUsername) {
  if (!isConnected) {
    inMemoryData.users = inMemoryData.users.filter(u => u.rowIndex !== parseInt(rowIndex, 10));
    return true;
  }

  const rows = await usersSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(rowIndex, 10) || (r.get('Username') || '').toLowerCase() === targetUsername.toLowerCase());
  if (targetRow) {
    await targetRow.delete();
  }
  return true;
}

/* ==========================================================================
   Records Data Access Methods
   ========================================================================== */

async function getRecords() {
  if (!isConnected) {
    return inMemoryData.records;
  }

  try {
    const rows = await dataSheet.getRows();
    return rows.map(row => ({
      id: row.rowNumber,
      rowIndex: row.rowNumber,
      pid: (row.get('PID') || '').toString().trim(),
      name: (row.get('Name') || '').toString().trim(),
      father: (row.get('Father') || '').toString().trim(),
      utNo: (row.get('UT No') || '').toString().trim(),
      aadharNo: (row.get('Aadhar no.') || '').toString().trim(),
      date: formatDateValue(row.get('Date')) || (row.get('Date') || '').toString().trim(),
      remark: (row.get('Remark') || '').toString().trim(),
      createdBy: (row.get('Created By') || '').toString().trim(),
      createdDate: formatDateValue(row.get('Created Date')) || (row.get('Created Date') || '').toString().trim(),
      createdTime: (row.get('Created Time') || '').toString().trim(),
      updatedDate: formatDateValue(row.get('Updated Date')) || (row.get('Updated Date') || '').toString().trim(),
      updatedTime: (row.get('Updated Time') || '').toString().trim()
    }));
  } catch (err) {
    console.error('getRecords error:', err.message);
    return inMemoryData.records;
  }
}

async function addRecord(recObj) {
  if (!isConnected) {
    const newId = inMemoryData.records.length + 2;
    const newRec = { id: newId, rowIndex: newId, ...recObj };
    inMemoryData.records.push(newRec);
    return true;
  }

  await dataSheet.addRow({
    PID: recObj.pid,
    Name: recObj.name,
    Father: recObj.father || '',
    'UT No': recObj.utNo || '',
    'Aadhar no.': recObj.aadharNo || '',
    Date: recObj.date || '',
    Remark: recObj.remark || '',
    'Created By': recObj.createdBy,
    'Created Date': recObj.createdDate,
    'Created Time': recObj.createdTime,
    'Updated Date': '',
    'Updated Time': ''
  });
  return true;
}

async function updateRecord(rowIndex, recObj) {
  if (!isConnected) {
    const target = inMemoryData.records.find(r => r.id === parseInt(rowIndex, 10));
    if (target) {
      Object.assign(target, recObj);
    }
    return true;
  }

  const rows = await dataSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(rowIndex, 10));
  if (targetRow) {
    targetRow.set('PID', recObj.pid);
    targetRow.set('Name', recObj.name);
    targetRow.set('Father', recObj.father || '');
    targetRow.set('UT No', recObj.utNo || '');
    targetRow.set('Aadhar no.', recObj.aadharNo || '');
    targetRow.set('Date', recObj.date || '');
    targetRow.set('Remark', recObj.remark || '');
    targetRow.set('Updated Date', recObj.updatedDate || '');
    targetRow.set('Updated Time', recObj.updatedTime || '');
    await targetRow.save();
  }
  return true;
}

async function deleteRecord(rowIndex) {
  if (!isConnected) {
    inMemoryData.records = inMemoryData.records.filter(r => r.id !== parseInt(rowIndex, 10));
    return true;
  }

  const rows = await dataSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(rowIndex, 10));
  if (targetRow) {
    await targetRow.delete();
  }
  return true;
}

async function batchAddRecords(recordsArr) {
  if (!isConnected) {
    recordsArr.forEach(rec => {
      const newId = inMemoryData.records.length + 2;
      inMemoryData.records.push({ id: newId, rowIndex: newId, ...rec });
    });
    return true;
  }

  const mappedRows = recordsArr.map(rec => ({
    PID: rec.pid,
    Name: rec.name,
    Father: rec.father || '',
    'UT No': rec.utNo || '',
    'Aadhar no.': rec.aadharNo || '',
    Date: rec.date || '',
    Remark: rec.remark || '',
    'Created By': rec.createdBy,
    'Created Date': rec.createdDate,
    'Created Time': rec.createdTime,
    'Updated Date': '',
    'Updated Time': ''
  }));

  await dataSheet.addRows(mappedRows);
  return true;
}

/* ==========================================================================
   Delete Requests Data Access Methods
   ========================================================================== */

async function getDeleteRequests() {
  if (!isConnected) {
    try {
      const { dbAll } = require('./database');
      const rows = await dbAll('SELECT * FROM delete_requests ORDER BY id DESC');
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          rowIndex: r.id,
          recordId: r.record_id,
          pid: r.pid,
          name: r.name,
          father: r.father,
          utNo: r.ut_no,
          aadharNo: r.aadhar_no,
          requestedBy: r.requested_by,
          requestedDate: r.requested_date,
          requestedTime: r.requested_time,
          status: r.status,
          actionBy: r.action_by,
          actionDate: r.action_date
        }));
      }
    } catch (e) {
      // Fallback
    }
    return inMemoryData.deleteRequests;
  }

  try {
    const rows = await deleteRequestsSheet.getRows();
    return rows.map(row => ({
      id: row.rowNumber,
      rowIndex: row.rowNumber,
      recordId: (row.get('ID') || row.rowNumber).toString().trim(),
      pid: (row.get('Record PID') || '').toString().trim(),
      name: (row.get('Record Name') || '').toString().trim(),
      father: (row.get('Father') || '').toString().trim(),
      utNo: (row.get('UT No') || '').toString().trim(),
      aadharNo: (row.get('Aadhar No') || '').toString().trim(),
      requestedBy: (row.get('Requested By') || '').toString().trim(),
      requestedDate: (row.get('Requested Date') || '').toString().trim(),
      requestedTime: (row.get('Requested Time') || '').toString().trim(),
      status: (row.get('Status') || 'Pending').toString().trim(),
      actionBy: (row.get('Action By') || '').toString().trim(),
      actionDate: (row.get('Action Date') || '').toString().trim()
    }));
  } catch (err) {
    console.error('getDeleteRequests error:', err.message);
    return inMemoryData.deleteRequests;
  }
}

async function createDeleteRequest(reqObj) {
  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      const res = await dbRun(
        `INSERT INTO delete_requests (record_id, pid, name, father, ut_no, aadhar_no, requested_by, requested_date, requested_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reqObj.recordId, reqObj.pid, reqObj.name, reqObj.father || '', reqObj.utNo || '', reqObj.aadharNo || '', reqObj.requestedBy, reqObj.requestedDate, reqObj.requestedTime, 'Pending']
      );
      reqObj.id = res.lastID;
      reqObj.rowIndex = res.lastID;
    } catch (e) {
      const newId = inMemoryData.deleteRequests.length + 1;
      reqObj.id = newId;
      reqObj.rowIndex = newId;
    }
    inMemoryData.deleteRequests.push({ ...reqObj, status: 'Pending' });
    return true;
  }

  await deleteRequestsSheet.addRow({
    'ID': reqObj.recordId,
    'Record PID': reqObj.pid,
    'Record Name': reqObj.name,
    'Father': reqObj.father || '',
    'UT No': reqObj.utNo || '',
    'Aadhar No': reqObj.aadharNo || '',
    'Requested By': reqObj.requestedBy,
    'Requested Date': reqObj.requestedDate,
    'Requested Time': reqObj.requestedTime,
    'Status': 'Pending',
    'Action By': '',
    'Action Date': ''
  });
  return true;
}

async function updateDeleteRequestStatus(requestId, status, actionBy) {
  const actionDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun(
        `UPDATE delete_requests SET status = ?, action_by = ?, action_date = ? WHERE id = ?`,
        [status, actionBy, actionDate, requestId]
      );
    } catch (e) {}
    const item = inMemoryData.deleteRequests.find(r => r.id === parseInt(requestId, 10));
    if (item) {
      item.status = status;
      item.actionBy = actionBy;
      item.actionDate = actionDate;
    }
    return true;
  }

  const rows = await deleteRequestsSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(requestId, 10));
  if (targetRow) {
    targetRow.set('Status', status);
    targetRow.set('Action By', actionBy);
    targetRow.set('Action Date', actionDate);
    await targetRow.save();
  }
  return true;
}

async function deleteDeleteRequest(requestId) {
  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun(`DELETE FROM delete_requests WHERE id = ?`, [requestId]);
    } catch (e) {}
    inMemoryData.deleteRequests = inMemoryData.deleteRequests.filter(r => r.id !== parseInt(requestId, 10));
    return true;
  }

  const rows = await deleteRequestsSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(requestId, 10));
  if (targetRow) {
    await targetRow.delete();
  }
  return true;
}

module.exports = {
  initGoogleSheets,
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
  getIsConnected: () => isConnected,
  getConnectionError: () => connectionError
};
