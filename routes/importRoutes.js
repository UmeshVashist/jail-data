/**
 * routes/importRoutes.js - Batch Excel/CSV upload processing with Detailed Duplicate & Numeric PID Reporting
 */

const express = require('express');
const router = express.Router();
const { getRecords, batchAddRecords } = require('../config/googleSheets');
const { requireAuth, requireImportPermission } = require('../middleware/auth');

function getFormattedDate(d = new Date()) {
  const year = d.getFullYear();
  const month = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

function getFormattedTime(d = new Date()) {
  const hours = ('0' + d.getHours()).slice(-2);
  const minutes = ('0' + d.getMinutes()).slice(-2);
  const seconds = ('0' + d.getSeconds()).slice(-2);
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Normalizes Excel Serial Dates or custom date strings into 'YYYY-MM-DD'
 */
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

/**
 * Process Aadhar No for import rows.
 * - Empty -> '#N/A'
 * - Provided -> requires at least 12 digits, formatted as 'XXXX XXXX XXXX'
 */
function processImportAadhar(inputStr) {
  if (!inputStr || inputStr.toString().trim() === '' || inputStr.toString().trim() === '#N/A') {
    return { valid: true, value: '#N/A', cleanDigits: '' };
  }

  const str = inputStr.toString().trim();
  const cleanDigits = str.replace(/\D/g, '');

  if (cleanDigits.length < 12) {
    return { valid: false, error: 'Aadhar No must contain at least 12 digits' };
  }

  const formatted = cleanDigits.replace(/^(\d{4})(\d{4})(\d{4})(.*)$/, '$1 $2 $3$4').trim();
  return { valid: true, value: formatted, cleanDigits: cleanDigits };
}

// POST /api/import - Process Batch Records Array
router.post('/', requireAuth, requireImportPermission, async (req, res) => {
  try {
    const records = req.body.records;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid records found in the import payload.' });
    }

    const existingRecords = await getRecords();
    
    const existingPidMap = {};
    const existingAadharMap = {};

    existingRecords.forEach(r => {
      if (r.pid) existingPidMap[r.pid.toLowerCase()] = true;
      if (r.aadharNo && r.aadharNo !== '#N/A') {
        const cleanA = r.aadharNo.replace(/\D/g, '');
        if (cleanA) existingAadharMap[cleanA] = true;
      }
    });

    const now = new Date();
    const createdDate = getFormattedDate(now);
    const createdTime = getFormattedTime(now);

    const rowsToAppend = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const duplicatePids = [];
    const failedDetails = [];
    
    const duplicateItems = [];
    const failedItems = [];

    for (let r = 0; r < records.length; r++) {
      const item = records[r] || {};
      const rowNum = r + 2;
      const pid = (item.pid || item.PID || '').toString().trim();
      const name = (item.name || item.Name || '').toString().trim();
      const father = (item.father || item.Father || '').toString().trim();
      const utNo = (item.utNo || item['UT No'] || item.utno || '').toString().trim();
      const rawAadhar = item.aadharNo || item['Aadhar no.'] || item['Aadhar No'] || item['aadhar No'] || '';
      
      const rawDate = item.date || item.Date || createdDate;
      const formattedRecordDate = formatDateValue(rawDate) || createdDate;

      const remark = (item.remark || item.Remark || 'Bulk Import').toString().trim();

      if (!pid) {
        failedCount++;
        const msg = `Row ${rowNum}: Missing PID`;
        failedDetails.push(msg);
        failedItems.push({ row: rowNum, pid: '-', name: name || '-', reason: 'Missing PID' });
        continue;
      }

      // Check if PID contains numbers only
      if (!/^\d+$/.test(pid)) {
        failedCount++;
        const msg = `Row ${rowNum} (PID ${pid}): PID must contain numbers only`;
        failedDetails.push(msg);
        failedItems.push({ row: rowNum, pid: pid, name: name || '-', reason: 'PID must contain numbers only' });
        continue;
      }

      if (!name) {
        failedCount++;
        const msg = `Row ${rowNum} (PID ${pid}): Missing Name`;
        failedDetails.push(msg);
        failedItems.push({ row: rowNum, pid: pid, name: '-', reason: 'Missing Name' });
        continue;
      }

      // Check PID Duplicate
      const lowerPid = pid.toLowerCase();
      if (existingPidMap[lowerPid]) {
        duplicateCount++;
        duplicatePids.push(pid);
        duplicateItems.push({ row: rowNum, pid: pid, name: name, reason: `Duplicate PID "${pid}" already exists in database` });
        continue;
      }

      // Validate Aadhar No format
      const aadharRes = processImportAadhar(rawAadhar);
      if (!aadharRes.valid) {
        failedCount++;
        const msg = `Row ${rowNum} (PID ${pid}): ${aadharRes.error}`;
        failedDetails.push(msg);
        failedItems.push({ row: rowNum, pid: pid, name: name, reason: aadharRes.error });
        continue;
      }

      // Check Aadhar Duplicate (if provided and not #N/A)
      if (aadharRes.value !== '#N/A') {
        if (existingAadharMap[aadharRes.cleanDigits]) {
          duplicateCount++;
          duplicatePids.push(`${pid} (Duplicate Aadhar: ${aadharRes.value})`);
          duplicateItems.push({ row: rowNum, pid: pid, name: name, reason: `Duplicate Aadhar No "${aadharRes.value}" already exists in database` });
          continue;
        }
        existingAadharMap[aadharRes.cleanDigits] = true;
      }

      existingPidMap[lowerPid] = true;

      rowsToAppend.push({
        pid: pid,
        name: name,
        father: father,
        utNo: utNo,
        aadharNo: aadharRes.value,
        date: formattedRecordDate,
        remark: remark,
        createdBy: req.user.username,
        createdDate: createdDate,
        createdTime: createdTime
      });

      importedCount++;
    }

    if (rowsToAppend.length > 0) {
      await batchAddRecords(rowsToAppend);
    }

    res.json({
      success: true,
      message: 'Batch import completed successfully.',
      data: {
        importedCount: importedCount,
        duplicateCount: duplicateCount,
        failedCount: failedCount,
        duplicatePids: duplicatePids,
        failedDetails: failedDetails,
        duplicateItems: duplicateItems,
        failedItems: failedItems,
        totalProcessed: records.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Import processing error: ' + err.message });
  }
});

module.exports = router;
