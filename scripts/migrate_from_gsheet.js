/**
 * scripts/migrate_from_gsheet.js
 * One-click migration tool: Imports all existing data from Google Sheets into local JSON store (data/*.json) and Cloudflare R2.
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '17NNVyywzZjE4updHon7dqq9zlSp0pcvLr7Z7Q37hC6g';
const CREDENTIALS_PATH = path.join(__dirname, '..', 'config', 'credentials.json');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data/ directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cloudflare R2 Client
let s3Client = null;
const ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT;
const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'jam-data';

if (ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY) {
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
}

async function uploadToR2(key, data) {
  if (!s3Client) return;
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: jsonStr,
      ContentType: 'application/json'
    }));
    console.log(`  ✓ Synced "${key}" to Cloudflare R2 bucket "${BUCKET_NAME}"`);
  } catch (err) {
    console.warn(`  [Notice] Could not sync "${key}" to R2 (${err.message}). Local file saved successfully.`);
  }
}

function formatDateValue(val) {
  if (val === null || val === undefined || val === '') return '';
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

async function runMigration() {
  console.log('===============================================================');
  console.log('  STARTING GOOGLE SHEETS -> NEW DATABASE MIGRATION');
  console.log('===============================================================\n');

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`[ERROR] Credentials file not found at: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  console.log(`Connecting to Google Sheet: "${SPREADSHEET_ID}"...`);
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  console.log(`Connected successfully to: "${doc.title}"\n`);

  // 1. Migrate Users
  const usersSheet = doc.sheetsByTitle['Users'];
  if (usersSheet) {
    console.log('Migrating Users...');
    const userRows = await usersSheet.getRows();
    const migratedUsers = [];

    for (let i = 0; i < userRows.length; i++) {
      const row = userRows[i];
      const username = (row.get('Username') || '').toString().trim();
      const rawPassword = (row.get('Password') || '').toString().trim();
      const role = (row.get('Role') || 'View').toString().trim();
      const importPerm = (row.get('Import Permission') || '').toString().trim().toLowerCase() === 'yes';
      const fullAccess = (row.get('Full Access') || '').toString().trim().toLowerCase() === 'yes';
      const delReqVal = (row.get('Delete Request Access') || row.get('Delete Request Permission') || '').toString().trim().toLowerCase() === 'yes';
      const status = (row.get('Status') || 'Active').toString().trim();

      if (!username) continue;

      migratedUsers.push({
        id: i + 1,
        rowIndex: i + 1,
        username,
        password: rawPassword,
        role,
        importPermission: importPerm,
        fullAccess,
        deleteRequestPermission: delReqVal,
        status
      });
    }

    fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(migratedUsers, null, 2), 'utf8');
    await uploadToR2('data/users.json', migratedUsers);
    console.log(`✓ Migrated ${migratedUsers.length} Users.`);
  }

  // 2. Migrate Records (Data Sheet)
  const dataSheet = doc.sheetsByTitle['Data'];
  if (dataSheet) {
    console.log('\nMigrating Data Records...');
    const dataRows = await dataSheet.getRows();
    const migratedRecords = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const pid = (row.get('PID') || '').toString().trim();
      const name = (row.get('Name') || '').toString().trim();
      const father = (row.get('Father') || '').toString().trim();
      const utNo = (row.get('UT No') || '').toString().trim();
      const type = (row.get('Type') || '').toString().trim() || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(utNo) ? 'CT' : (/\bUT\b|UT/i.test(utNo) ? 'UT' : ''));
      const aadharNo = (row.get('Aadhar no.') || row.get('Aadhar No') || '').toString().trim();
      const date = formatDateValue(row.get('Date'));
      const remark = (row.get('Remark') || '').toString().trim();
      const createdBy = (row.get('Created By') || 'Admin').toString().trim();
      const createdDate = formatDateValue(row.get('Created Date')) || '2026-03-01';
      const createdTime = (row.get('Created Time') || '').toString().trim();
      const updatedDate = formatDateValue(row.get('Updated Date'));
      const updatedTime = (row.get('Updated Time') || '').toString().trim();

      if (!pid && !name) continue;

      migratedRecords.push({
        id: i + 1,
        rowIndex: i + 1,
        pid,
        name,
        father,
        utNo,
        type,
        recordType: type,
        aadharNo,
        date,
        remark,
        createdBy,
        createdDate,
        createdTime,
        updatedDate,
        updatedTime
      });
    }

    fs.writeFileSync(path.join(DATA_DIR, 'records.json'), JSON.stringify(migratedRecords, null, 2), 'utf8');
    await uploadToR2('data/records.json', migratedRecords);
    console.log(`✓ Migrated ${migratedRecords.length} Records.`);
  }

  // 3. Migrate Dropdown Options
  const dropdownSheet = doc.sheetsByTitle['DropdownOptions'];
  if (dropdownSheet) {
    console.log('\nMigrating Dropdown Options...');
    const dropRows = await dropdownSheet.getRows();
    const migratedDropdowns = [];

    for (let i = 0; i < dropRows.length; i++) {
      const row = dropRows[i];
      const optVal = (row.get('Remark Options') || row.get('Option') || '').toString().trim();
      const disAadhar = (row.get('Disable Aadhar') || '').toString().trim().toLowerCase() === 'yes';

      if (!optVal) continue;

      migratedDropdowns.push({
        id: i + 1,
        optionValue: optVal,
        disableAadhar: disAadhar
      });
    }

    fs.writeFileSync(path.join(DATA_DIR, 'remark_options.json'), JSON.stringify(migratedDropdowns, null, 2), 'utf8');
    await uploadToR2('data/remark_options.json', migratedDropdowns);
    console.log(`✓ Migrated ${migratedDropdowns.length} Dropdown Options.`);
  }

  // 4. Migrate Delete Requests
  const delSheet = doc.sheetsByTitle['DeleteRequests'];
  if (delSheet) {
    console.log('\nMigrating Delete Requests...');
    const delRows = await delSheet.getRows();
    const migratedDels = [];

    for (let i = 0; i < delRows.length; i++) {
      const row = delRows[i];
      const recId = row.get('ID') || i + 1;
      const pid = (row.get('Record PID') || '').toString().trim();
      const name = (row.get('Record Name') || '').toString().trim();
      const father = (row.get('Father') || '').toString().trim();
      const utNo = (row.get('UT No') || '').toString().trim();
      const aadharNo = (row.get('Aadhar No') || '').toString().trim();
      const reqBy = (row.get('Requested By') || '').toString().trim();
      const reqDate = (row.get('Requested Date') || '').toString().trim();
      const reqTime = (row.get('Requested Time') || '').toString().trim();
      const reason = (row.get('Reason') || row.get('Remark') || '').toString().trim();
      const status = (row.get('Status') || 'Pending').toString().trim();
      const actionBy = (row.get('Action By') || '').toString().trim();
      const actionDate = (row.get('Action Date') || '').toString().trim();

      if (!pid && !name) continue;

      migratedDels.push({
        id: i + 1,
        rowIndex: i + 1,
        recordId: recId,
        pid,
        name,
        father,
        utNo,
        aadharNo,
        requestedBy: reqBy,
        requestedDate: reqDate,
        requestedTime: reqTime,
        reason,
        remark: reason,
        status,
        actionBy,
        actionDate
      });
    }

    fs.writeFileSync(path.join(DATA_DIR, 'delete_requests.json'), JSON.stringify(migratedDels, null, 2), 'utf8');
    await uploadToR2('data/delete_requests.json', migratedDels);
    console.log(`✓ Migrated ${migratedDels.length} Delete Requests.`);
  }

  // 5. Migrate Edit Requests
  const editSheet = doc.sheetsByTitle['EditRequests'];
  if (editSheet) {
    console.log('\nMigrating Edit Requests...');
    const editRows = await editSheet.getRows();
    const migratedEdits = [];

    for (let i = 0; i < editRows.length; i++) {
      const row = editRows[i];
      const recId = row.get('ID') || i + 1;
      const pid = (row.get('Record PID') || '').toString().trim();
      const name = (row.get('Record Name') || '').toString().trim();
      const father = (row.get('Father') || '').toString().trim();
      const utNo = (row.get('UT No') || '').toString().trim();
      const aadharNo = (row.get('Aadhar No') || '').toString().trim();
      const propDataStr = (row.get('Proposed Data') || '{}').toString().trim();
      let propData = {};
      try { propData = JSON.parse(propDataStr); } catch (e) {}
      const reqBy = (row.get('Requested By') || '').toString().trim();
      const reqDate = (row.get('Requested Date') || '').toString().trim();
      const reqTime = (row.get('Requested Time') || '').toString().trim();
      const reason = (row.get('Reason') || '').toString().trim();
      const status = (row.get('Status') || 'Pending').toString().trim();
      const actionBy = (row.get('Action By') || '').toString().trim();
      const actionDate = (row.get('Action Date') || '').toString().trim();

      if (!pid && !name) continue;

      migratedEdits.push({
        id: i + 1,
        rowIndex: i + 1,
        recordId: recId,
        pid,
        name,
        father,
        utNo,
        aadharNo,
        proposedData: propData,
        requestedBy: reqBy,
        requestedDate: reqDate,
        requestedTime: reqTime,
        reason,
        status,
        actionBy,
        actionDate
      });
    }

    fs.writeFileSync(path.join(DATA_DIR, 'edit_requests.json'), JSON.stringify(migratedEdits, null, 2), 'utf8');
    await uploadToR2('data/edit_requests.json', migratedEdits);
    console.log(`✓ Migrated ${migratedEdits.length} Edit Requests.`);
  }

  // 6. Migrate List Add Requests
  const listSheet = doc.sheetsByTitle['ListAddRequests'];
  if (listSheet) {
    console.log('\nMigrating List Add Requests...');
    const listRows = await listSheet.getRows();
    const migratedLists = [];

    for (let i = 0; i < listRows.length; i++) {
      const row = listRows[i];
      const optVal = (row.get('Option Value') || '').toString().trim();
      const reqBy = (row.get('Requested By') || '').toString().trim();
      const reqDate = (row.get('Requested Date') || '').toString().trim();
      const reqTime = (row.get('Requested Time') || '').toString().trim();
      const reason = (row.get('Reason') || '').toString().trim();
      const status = (row.get('Status') || 'Pending').toString().trim();
      const actionBy = (row.get('Action By') || '').toString().trim();
      const actionDate = (row.get('Action Date') || '').toString().trim();

      if (!optVal) continue;

      migratedLists.push({
        id: i + 1,
        rowIndex: i + 1,
        optionValue: optVal,
        requestedBy: reqBy,
        requestedDate: reqDate,
        requestedTime: reqTime,
        reason,
        status,
        actionBy,
        actionDate,
        createdAt: Date.now()
      });
    }

    fs.writeFileSync(path.join(DATA_DIR, 'list_add_requests.json'), JSON.stringify(migratedLists, null, 2), 'utf8');
    await uploadToR2('data/list_add_requests.json', migratedLists);
    console.log(`✓ Migrated ${migratedLists.length} List Add Requests.`);
  }

  // 7. Migrate System Settings
  const settingsSheet = doc.sheetsByTitle['SystemSettings'];
  if (settingsSheet) {
    console.log('\nMigrating System Settings...');
    const setRows = await settingsSheet.getRows();
    const settingsMap = { aadhar_mandatory: 'false' };

    for (const row of setRows) {
      const k = (row.get('Setting Key') || '').toString().trim();
      const v = (row.get('Setting Value') || '').toString().trim();
      if (k) settingsMap[k] = v;
    }

    fs.writeFileSync(path.join(DATA_DIR, 'system_settings.json'), JSON.stringify(settingsMap, null, 2), 'utf8');
    await uploadToR2('data/system_settings.json', settingsMap);
    console.log('✓ Migrated System Settings.');
  }

  console.log('\n===============================================================');
  console.log('  ALL GOOGLE SHEETS DATA SUCCESSFULLY TRANSFERRED!');
  console.log(`  Saved to local data directory: "${DATA_DIR}"`);
  console.log('===============================================================\n');
}

runMigration().catch(err => {
  console.error('\n[MIGRATION ERROR]:', err);
  process.exit(1);
});
