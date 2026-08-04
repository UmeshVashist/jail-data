/**
 * routes/importRoutes.js - Batch Excel/CSV upload processing with Detailed Duplicate & Numeric PID Reporting
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { getRecords, batchAddRecords, getRemarkOptions } = require('../config/googleSheets');
const { requireAuth, requireImportPermission } = require('../middleware/auth');

// GET /api/import/sample-template - Native Excel file download with Inline Data Validation Dropdowns
router.get('/sample-template', requireAuth, async (req, res) => {
  try {
    const remarkOptions = await getRemarkOptions();
    const options = remarkOptions.length > 0 ? remarkOptions : ['Completed', 'Pending', 'In Progress', 'Verified', 'Rejected', 'Imported', 'Other'];

    const workbook = new ExcelJS.Workbook();

    // Data_Template Sheet
    const sheet1 = workbook.addWorksheet('Data_Template');
    sheet1.columns = [
      { header: 'PID', key: 'pid', width: 14 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Father', key: 'father', width: 25 },
      { header: 'UT No', key: 'utNo', width: 18 },
      { header: 'Aadhar No', key: 'aadharNo', width: 20 },
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Remark', key: 'remark', width: 32 }
    ];

    // Style Header Row for ONLY Columns A to G (1 to 7)
    for (let col = 1; col <= 7; col++) {
      const cell = sheet1.getCell(1, col);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Inline list formula so no extra sheet is needed
    const listFormula = `"${options.map(o => o.replace(/"/g, '""')).join(',')}"`;

    // Add 35 blank data rows with inline Excel Data Validation on Column G (Remark)
    for (let r = 2; r <= 35; r++) {
      const row = sheet1.getRow(r);
      row.values = ['', '', '', '', '', '', ''];
      row.getCell(7).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [listFormula],
        showErrorMessage: true,
        errorTitle: 'Invalid Remark Option',
        error: 'Please select a valid Remark from the dropdown list.'
      };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Data_Import_Template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Template download error: ' + err.message });
  }
});

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

      // Skip completely empty rows (e.g. blank template rows 2 to 31)
      if (!pid && !name && !father && !utNo && !rawAadhar) {
        continue;
      }

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

      // If Remark is "Foreigner", ignore any provided Aadhar number and force it to blank / #N/A
      const isForeigner = remark.toLowerCase() === 'foreigner';
      const effectiveAadhar = isForeigner ? '' : rawAadhar;

      // Validate Aadhar No format
      const aadharRes = processImportAadhar(effectiveAadhar);
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
