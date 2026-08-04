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
let editRequestsSheet = null;
let listAddRequestsSheet = null;
let dropdownSheet = null;
let isConnected = false;
let connectionError = null;

const inMemoryData = {
  users: [
    { rowIndex: 2, username: 'Admin', password: 'Admin@123', role: 'Admin', importPermission: true, fullAccess: true, deleteRequestPermission: true, status: 'Active' },
    { rowIndex: 3, username: 'Add', password: 'Add@123', role: 'Add', importPermission: false, fullAccess: false, deleteRequestPermission: false, status: 'Active' },
    { rowIndex: 4, username: 'View', password: 'View@123', role: 'View', importPermission: false, fullAccess: false, deleteRequestPermission: false, status: 'Active' }
  ],
  records: [],
  deleteRequests: [],
  editRequests: [],
  listAddRequests: [],
  remarkOptions: ['Not Available', 'Already Linked but other Prisoner', 'Biometric Block', 'Biometric data not match', 'Aadhar Suspended', 'Other']
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
        headerValues: ['ID', 'Record PID', 'Record Name', 'Father', 'UT No', 'Aadhar No', 'Requested By', 'Requested Date', 'Requested Time', 'Remark', 'Reason', 'Status', 'Action By', 'Action Date']
      });
    } else {
      try {
        await deleteRequestsSheet.loadHeaderRow();
        const headers = deleteRequestsSheet.headerValues || [];
        if (!headers.includes('Remark') && !headers.includes('Reason')) {
          console.log('Adding "Remark" column to existing "DeleteRequests" sheet header...');
          const newHeaders = [...headers];
          const statusIdx = newHeaders.indexOf('Status');
          if (statusIdx !== -1) {
            newHeaders.splice(statusIdx, 0, 'Remark');
          } else {
            newHeaders.push('Remark');
          }
          await deleteRequestsSheet.setHeaderRow(newHeaders);
        }
      } catch (e) {
        console.error('Error checking DeleteRequests header row:', e.message);
      }
    }

    // Ensure 'EditRequests' sheet exists
    editRequestsSheet = doc.sheetsByTitle['EditRequests'];
    if (!editRequestsSheet) {
      console.log('Creating "EditRequests" sheet in Google Sheet...');
      editRequestsSheet = await doc.addSheet({
        title: 'EditRequests',
        headerValues: ['ID', 'Record PID', 'Record Name', 'Father', 'UT No', 'Aadhar No', 'Proposed Data', 'Requested By', 'Requested Date', 'Requested Time', 'Reason', 'Status', 'Action By', 'Action Date']
      });
    }

    // Ensure 'ListAddRequests' sheet exists
    listAddRequestsSheet = doc.sheetsByTitle['ListAddRequests'];
    if (!listAddRequestsSheet) {
      console.log('Creating "ListAddRequests" sheet in Google Sheet...');
      listAddRequestsSheet = await doc.addSheet({
        title: 'ListAddRequests',
        headerValues: ['ID', 'Option Value', 'Requested By', 'Requested Date', 'Requested Time', 'Reason', 'Status', 'Action By', 'Action Date']
      });
    }

    // Ensure 'DropdownOptions' sheet exists
    dropdownSheet = doc.sheetsByTitle['DropdownOptions'];
    if (!dropdownSheet) {
      console.log('Creating "DropdownOptions" sheet in Google Sheet...');
      dropdownSheet = await doc.addSheet({
        title: 'DropdownOptions',
        headerValues: ['Remark Options']
      });
      await dropdownSheet.addRows([
        { 'Remark Options': 'Completed' },
        { 'Remark Options': 'Pending' },
        { 'Remark Options': 'In Progress' },
        { 'Remark Options': 'Verified' },
        { 'Remark Options': 'Rejected' },
        { 'Remark Options': 'Imported' },
        { 'Remark Options': 'Other' }
      ]);
      console.log('Default Remark Options seeded into "DropdownOptions" sheet.');
    } else {
      const existingRows = await dropdownSheet.getRows();
      if (existingRows.length === 0) {
        console.log('Seeding default Remark Options into empty "DropdownOptions" sheet...');
        await dropdownSheet.addRows([
          { 'Remark Options': 'Completed' },
          { 'Remark Options': 'Pending' },
          { 'Remark Options': 'In Progress' },
          { 'Remark Options': 'Verified' },
          { 'Remark Options': 'Rejected' },
          { 'Remark Options': 'Imported' },
          { 'Remark Options': 'Other' }
        ]);
      }
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
    return inMemoryData.users.map(u => ({ ...u, id: u.rowIndex }));
  }

  try {
    const rows = await usersSheet.getRows();
    return rows.map(row => {
      const delReqVal = (row.get('Delete Request Access') || row.get('Delete Request Permission') || '').toString().trim().toLowerCase();
      return {
        id: row.rowNumber,
        rowIndex: row.rowNumber,
        username: (row.get('Username') || '').toString().trim(),
        password: (row.get('Password') || '').toString().trim(),
        role: (row.get('Role') || 'View').toString().trim(),
        importPermission: (row.get('Import Permission') || '').toString().trim().toLowerCase() === 'yes',
        fullAccess: (row.get('Full Access') || '').toString().trim().toLowerCase() === 'yes',
        deleteRequestPermission: delReqVal === 'yes',
        status: (row.get('Status') || 'Active').toString().trim()
      };
    });
  } catch (err) {
    console.error('getUsers error:', err.message);
    return inMemoryData.users.map(u => ({ ...u, id: u.rowIndex }));
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

  const delReqStr = userObj.deleteRequestPermission ? 'Yes' : 'No';
  const rowData = {
    Username: userObj.username,
    Password: userObj.password,
    Role: userObj.role || 'View',
    'Import Permission': userObj.importPermission ? 'Yes' : 'No',
    'Full Access': userObj.fullAccess ? 'Yes' : 'No',
    Status: userObj.status || 'Active'
  };
  rowData['Delete Request Access'] = delReqStr;
  rowData['Delete Request Permission'] = delReqStr;

  await usersSheet.addRow(rowData);
  return true;
}

async function updateUser(rowIndex, userObj) {
  if (!isConnected) {
    const target = inMemoryData.users.find(u => u.rowIndex === parseInt(rowIndex, 10) || (userObj.username && u.username.toLowerCase() === userObj.username.toLowerCase()));
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
  const targetRow = rows.find(r => r.rowNumber === parseInt(rowIndex, 10) || (userObj.username && (r.get('Username') || '').toString().trim().toLowerCase() === userObj.username.toLowerCase()));
  if (targetRow) {
    if (userObj.role) targetRow.set('Role', userObj.role);
    if (userObj.importPermission !== undefined) targetRow.set('Import Permission', userObj.importPermission ? 'Yes' : 'No');
    if (userObj.fullAccess !== undefined) targetRow.set('Full Access', userObj.fullAccess ? 'Yes' : 'No');
    if (userObj.deleteRequestPermission !== undefined) {
      const val = userObj.deleteRequestPermission ? 'Yes' : 'No';
      try { targetRow.set('Delete Request Access', val); } catch (e) {}
      try { targetRow.set('Delete Request Permission', val); } catch (e) {}
    }
    if (userObj.status) targetRow.set('Status', userObj.status);
    if (userObj.password) targetRow.set('Password', userObj.password);
    await targetRow.save();
  }
  return true;
}

async function deleteUser(rowIndex, targetUsername) {
  const cleanUser = (targetUsername || '').toString().trim().toLowerCase();
  if (!isConnected) {
    inMemoryData.users = inMemoryData.users.filter(u => u.rowIndex !== parseInt(rowIndex, 10) && u.username.toLowerCase() !== cleanUser);
    return true;
  }

  const rows = await usersSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(rowIndex, 10) || (r.get('Username') || '').toString().trim().toLowerCase() === cleanUser);
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
    return newRec;
  }

  const addedRow = await dataSheet.addRow({
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
  return { id: addedRow.rowNumber, rowIndex: addedRow.rowNumber, ...recObj };
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
    return rows.map(row => {
      const remarkVal = (row.get('Remark') || row.get('Reason') || '').toString().trim();
      return {
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
        reason: remarkVal,
        remark: remarkVal,
        status: (row.get('Status') || 'Pending').toString().trim(),
        actionBy: (row.get('Action By') || '').toString().trim(),
        actionDate: (row.get('Action Date') || '').toString().trim()
      };
    });
  } catch (err) {
    console.error('getDeleteRequests error:', err.message);
    return inMemoryData.deleteRequests;
  }
}

async function createDeleteRequest(reqObj) {
  const remarkVal = (reqObj.remark || reqObj.reason || '').toString().trim();

  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      const res = await dbRun(
        `INSERT INTO delete_requests (record_id, pid, name, father, ut_no, aadhar_no, requested_by, requested_date, requested_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reqObj.recordId, reqObj.pid, reqObj.name, reqObj.father || '', reqObj.utNo || '', reqObj.aadharNo || '', reqObj.requestedBy, reqObj.requestedDate, reqObj.requestedTime, remarkVal, 'Pending']
      );
      reqObj.id = res.lastID;
      reqObj.rowIndex = res.lastID;
    } catch (e) {
      const newId = inMemoryData.deleteRequests.length + 1;
      reqObj.id = newId;
      reqObj.rowIndex = newId;
    }
    inMemoryData.deleteRequests.push({ ...reqObj, reason: remarkVal, remark: remarkVal, status: 'Pending' });
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
    'Remark': remarkVal,
    'Reason': remarkVal,
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

/* ==========================================================================
   Edit Requests Data Access Methods
   ========================================================================== */

async function getEditRequests() {
  if (!isConnected) {
    try {
      const { dbAll } = require('./database');
      const rows = await dbAll('SELECT * FROM edit_requests ORDER BY id DESC');
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
          date: r.date,
          remark: r.remark,
          proposedData: r.proposed_data ? (typeof r.proposed_data === 'string' ? JSON.parse(r.proposed_data) : r.proposed_data) : {},
          requestedBy: r.requested_by,
          requestedDate: r.requested_date,
          requestedTime: r.requested_time,
          reason: r.reason,
          status: r.status,
          actionBy: r.action_by,
          actionDate: r.action_date
        }));
      }
    } catch (e) {}
    return inMemoryData.editRequests;
  }

  try {
    const rows = await editRequestsSheet.getRows();
    return rows.map(row => {
      let propData = {};
      try {
        propData = JSON.parse(row.get('Proposed Data') || '{}');
      } catch (e) {}
      const reasonVal = (row.get('Reason') || row.get('Remark') || '').toString().trim();
      return {
        id: row.rowNumber,
        rowIndex: row.rowNumber,
        recordId: (row.get('ID') || row.rowNumber).toString().trim(),
        pid: (row.get('Record PID') || '').toString().trim(),
        name: (row.get('Record Name') || '').toString().trim(),
        father: (row.get('Father') || '').toString().trim(),
        utNo: (row.get('UT No') || '').toString().trim(),
        aadharNo: (row.get('Aadhar No') || '').toString().trim(),
        proposedData: propData,
        requestedBy: (row.get('Requested By') || '').toString().trim(),
        requestedDate: (row.get('Requested Date') || '').toString().trim(),
        requestedTime: (row.get('Requested Time') || '').toString().trim(),
        reason: reasonVal,
        status: (row.get('Status') || 'Pending').toString().trim(),
        actionBy: (row.get('Action By') || '').toString().trim(),
        actionDate: (row.get('Action Date') || '').toString().trim()
      };
    });
  } catch (err) {
    console.error('getEditRequests error:', err.message);
    return inMemoryData.editRequests;
  }
}

async function createEditRequest(reqObj) {
  const reasonVal = (reqObj.reason || '').toString().trim();
  const proposedStr = typeof reqObj.proposedData === 'string' ? reqObj.proposedData : JSON.stringify(reqObj.proposedData || {});

  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      const res = await dbRun(
        `INSERT INTO edit_requests (record_id, pid, name, father, ut_no, aadhar_no, date, remark, proposed_data, requested_by, requested_date, requested_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reqObj.recordId, reqObj.pid, reqObj.name, reqObj.father || '', reqObj.utNo || '', reqObj.aadharNo || '',
          reqObj.date || '', reqObj.remark || '', proposedStr, reqObj.requestedBy, reqObj.requestedDate, reqObj.requestedTime, reasonVal, 'Pending'
        ]
      );
      reqObj.id = res.lastID;
      reqObj.rowIndex = res.lastID;
    } catch (e) {
      const newId = inMemoryData.editRequests.length + 1;
      reqObj.id = newId;
      reqObj.rowIndex = newId;
    }
    inMemoryData.editRequests.push({ ...reqObj, proposedData: reqObj.proposedData, reason: reasonVal, status: 'Pending' });
    return true;
  }

  await editRequestsSheet.addRow({
    'ID': reqObj.recordId,
    'Record PID': reqObj.pid,
    'Record Name': reqObj.name,
    'Father': reqObj.father || '',
    'UT No': reqObj.utNo || '',
    'Aadhar No': reqObj.aadharNo || '',
    'Proposed Data': proposedStr,
    'Requested By': reqObj.requestedBy,
    'Requested Date': reqObj.requestedDate,
    'Requested Time': reqObj.requestedTime,
    'Reason': reasonVal,
    'Status': 'Pending',
    'Action By': '',
    'Action Date': ''
  });
  return true;
}

async function updateEditRequestStatus(requestId, status, actionBy) {
  const actionDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun(
        `UPDATE edit_requests SET status = ?, action_by = ?, action_date = ? WHERE id = ?`,
        [status, actionBy, actionDate, requestId]
      );
    } catch (e) {}
    const item = inMemoryData.editRequests.find(r => r.id === parseInt(requestId, 10));
    if (item) {
      item.status = status;
      item.actionBy = actionBy;
      item.actionDate = actionDate;
    }
    return true;
  }

  const rows = await editRequestsSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(requestId, 10));
  if (targetRow) {
    targetRow.set('Status', status);
    targetRow.set('Action By', actionBy);
    targetRow.set('Action Date', actionDate);
    await targetRow.save();
  }
  return true;
}

async function deleteEditRequest(requestId) {
  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun(`DELETE FROM edit_requests WHERE id = ?`, [requestId]);
    } catch (e) {}
    inMemoryData.editRequests = inMemoryData.editRequests.filter(r => r.id !== parseInt(requestId, 10));
    return true;
  }

  const rows = await editRequestsSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(requestId, 10));
  if (targetRow) {
    await targetRow.delete();
  }
  return true;
}

/* ==========================================================================
   List Add Requests Data Access Methods
   ========================================================================== */

async function getListAddRequests() {
  if (!isConnected) {
    try {
      const { dbAll } = require('./database');
      const rows = await dbAll('SELECT * FROM list_add_requests ORDER BY id DESC');
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          rowIndex: r.id,
          optionValue: r.option_value,
          requestedBy: r.requested_by,
          requestedDate: r.requested_date,
          requestedTime: r.requested_time,
          reason: r.reason,
          status: r.status,
          actionBy: r.action_by,
          actionDate: r.action_date
        }));
      }
    } catch (e) {}
    return inMemoryData.listAddRequests;
  }

  try {
    const rows = await listAddRequestsSheet.getRows();
    return rows.map(row => ({
      id: row.rowNumber,
      rowIndex: row.rowNumber,
      optionValue: (row.get('Option Value') || '').toString().trim(),
      requestedBy: (row.get('Requested By') || '').toString().trim(),
      requestedDate: (row.get('Requested Date') || '').toString().trim(),
      requestedTime: (row.get('Requested Time') || '').toString().trim(),
      reason: (row.get('Reason') || '').toString().trim(),
      status: (row.get('Status') || 'Pending').toString().trim(),
      actionBy: (row.get('Action By') || '').toString().trim(),
      actionDate: (row.get('Action Date') || '').toString().trim()
    }));
  } catch (err) {
    console.error('getListAddRequests error:', err.message);
    return inMemoryData.listAddRequests;
  }
}

async function createListAddRequest(reqObj) {
  const reasonVal = (reqObj.reason || '').toString().trim();
  const optVal = (reqObj.optionValue || '').toString().trim();

  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      const res = await dbRun(
        `INSERT INTO list_add_requests (option_value, requested_by, requested_date, requested_time, reason, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [optVal, reqObj.requestedBy, reqObj.requestedDate, reqObj.requestedTime, reasonVal, 'Pending']
      );
      reqObj.id = res.lastID;
      reqObj.rowIndex = res.lastID;
    } catch (e) {
      const newId = inMemoryData.listAddRequests.length + 1;
      reqObj.id = newId;
      reqObj.rowIndex = newId;
    }
    inMemoryData.listAddRequests.push({ ...reqObj, optionValue: optVal, reason: reasonVal, status: 'Pending' });
    return true;
  }

  await listAddRequestsSheet.addRow({
    'ID': reqObj.id || Date.now(),
    'Option Value': optVal,
    'Requested By': reqObj.requestedBy,
    'Requested Date': reqObj.requestedDate,
    'Requested Time': reqObj.requestedTime,
    'Reason': reasonVal,
    'Status': 'Pending',
    'Action By': '',
    'Action Date': ''
  });
  return true;
}

async function updateListAddRequestStatus(requestId, status, actionBy) {
  const actionDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun(
        `UPDATE list_add_requests SET status = ?, action_by = ?, action_date = ? WHERE id = ?`,
        [status, actionBy, actionDate, requestId]
      );
    } catch (e) {}
    const item = inMemoryData.listAddRequests.find(r => r.id === parseInt(requestId, 10));
    if (item) {
      item.status = status;
      item.actionBy = actionBy;
      item.actionDate = actionDate;
    }
    return true;
  }

  const rows = await listAddRequestsSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(requestId, 10));
  if (targetRow) {
    targetRow.set('Status', status);
    targetRow.set('Action By', actionBy);
    targetRow.set('Action Date', actionDate);
    await targetRow.save();
  }
  return true;
}

async function deleteListAddRequest(requestId) {
  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun(`DELETE FROM list_add_requests WHERE id = ?`, [requestId]);
    } catch (e) {}
    inMemoryData.listAddRequests = inMemoryData.listAddRequests.filter(r => r.id !== parseInt(requestId, 10));
    return true;
  }

  const rows = await listAddRequestsSheet.getRows();
  const targetRow = rows.find(r => r.rowNumber === parseInt(requestId, 10));
  if (targetRow) {
    await targetRow.delete();
  }
  return true;
}

/* ==========================================================================
   Dropdown Options Access Method
   ========================================================================== */

async function getRemarkOptions() {
  if (!isConnected) {
    try {
      const { dbAll } = require('./database');
      const rows = await dbAll('SELECT option_value FROM remark_options ORDER BY id ASC');
      if (rows && rows.length > 0) {
        return rows
          .map(r => r.option_value)
          .filter(val => val && val.toString().trim().toLowerCase() !== 'remark options');
      }
    } catch (e) {}
    return inMemoryData.remarkOptions;
  }

  try {
    const rows = await dropdownSheet.getRows();
    const options = rows
      .map(row => {
        const val = row.get('Remark Options') || (row._rawData ? row._rawData[0] : '');
        return (val || '').toString().trim();
      })
      .filter(val => val !== '' && val.toLowerCase() !== 'remark options');
    
    if (options.length > 0) return options;
  } catch (err) {
    console.error('getRemarkOptions error:', err.message);
  }
  return inMemoryData.remarkOptions;
}

async function addRemarkOption(optionValue) {
  const cleanVal = (optionValue || '').toString().trim();
  if (!cleanVal) return false;

  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun('INSERT OR IGNORE INTO remark_options (option_value) VALUES (?)', [cleanVal]);
    } catch (e) {}
    if (!inMemoryData.remarkOptions.includes(cleanVal)) {
      inMemoryData.remarkOptions.push(cleanVal);
    }
    return true;
  }

  const rows = await dropdownSheet.getRows();
  const exists = rows.some(r => (r.get('Remark Options') || '').toString().trim().toLowerCase() === cleanVal.toLowerCase());
  if (!exists) {
    await dropdownSheet.addRow({ 'Remark Options': cleanVal });
  }
  return true;
}

async function updateRemarkOption(oldValue, newValue) {
  const cleanOld = (oldValue || '').toString().trim();
  const cleanNew = (newValue || '').toString().trim();
  if (!cleanOld || !cleanNew) return false;

  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun('UPDATE remark_options SET option_value = ? WHERE option_value = ?', [cleanNew, cleanOld]);
    } catch (e) {}
    const idx = inMemoryData.remarkOptions.indexOf(cleanOld);
    if (idx !== -1) inMemoryData.remarkOptions[idx] = cleanNew;
    return true;
  }

  const rows = await dropdownSheet.getRows();
  const targetRow = rows.find(r => (r.get('Remark Options') || '').toString().trim().toLowerCase() === cleanOld.toLowerCase());
  if (targetRow) {
    targetRow.set('Remark Options', cleanNew);
    await targetRow.save();
  }
  return true;
}

async function deleteRemarkOption(optionValue) {
  const cleanVal = (optionValue || '').toString().trim();
  if (!cleanVal) return false;

  if (!isConnected) {
    try {
      const { dbRun } = require('./database');
      await dbRun('DELETE FROM remark_options WHERE option_value = ?', [cleanVal]);
    } catch (e) {}
    inMemoryData.remarkOptions = inMemoryData.remarkOptions.filter(opt => opt !== cleanVal);
    return true;
  }

  const rows = await dropdownSheet.getRows();
  const targetRow = rows.find(r => (r.get('Remark Options') || '').toString().trim().toLowerCase() === cleanVal.toLowerCase());
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
  getIsConnected: () => isConnected,
  getConnectionError: () => connectionError
};
