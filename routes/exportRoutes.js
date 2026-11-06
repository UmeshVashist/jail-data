/**
 * routes/exportRoutes.js - Formatted Export Data Endpoints via Cloudflare R2 & ExcelJS
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { getRecords } = require('../config/cloudflareStorage');
const { requireAuth } = require('../middleware/auth');

// GET /api/export - Export records to real .xlsx, .csv or formatted JSON
router.get('/', requireAuth, async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').trim().toLowerCase();
    const query = (req.query.query || '').trim().toLowerCase();
    const startDate = (req.query.startDate || '').trim();
    const endDate = (req.query.endDate || '').trim();
    const remarkFilter = (req.query.remark || '').trim();
    const recordTypeFilter = (req.query.recordType || 'all').trim().toUpperCase();

    const allRecords = await getRecords();
    const headers = ['PID', 'Name', 'Father', 'UT No', 'Aadhar no.', 'Date', 'Remark', 'Created By', 'Created Date'];
    const formattedRows = [];

    for (let i = 0; i < allRecords.length; i++) {
      const r = allRecords[i];
      if (!r) continue;

      if (query !== '') {
        const pidMatch = String(r.pid || '').toLowerCase().includes(query);
        const nameMatch = String(r.name || '').toLowerCase().includes(query);
        const fatherMatch = String(r.father || '').toLowerCase().includes(query);
        const utMatch = String(r.utNo || '').toLowerCase().includes(query);
        const aadharMatch = String(r.aadharNo || '').toLowerCase().includes(query);
        if (!pidMatch && !nameMatch && !fatherMatch && !utMatch && !aadharMatch) continue;
      }

      if (remarkFilter !== '' && remarkFilter.toLowerCase() !== 'all') {
        if ((r.remark || '').trim().toLowerCase() !== remarkFilter.toLowerCase()) continue;
      }

      if (recordTypeFilter === 'UT') {
        const isUT = (r.recordType && r.recordType.toUpperCase() === 'UT') || /\bUT\b|UT/i.test(r.utNo);
        if (!isUT) continue;
      } else if (recordTypeFilter === 'CT') {
        const isCT = (r.recordType && r.recordType.toUpperCase() === 'CT') || /\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(r.utNo);
        if (!isCT) continue;
      }

      if (startDate !== '' && r.date < startDate) continue;
      if (endDate !== '' && r.date > endDate) continue;

      const numPid = (r.pid !== undefined && r.pid !== null && !isNaN(r.pid) && String(r.pid).trim() !== '')
        ? Number(r.pid)
        : (r.pid || '');

      formattedRows.push([
        numPid,
        r.name || '',
        r.father || '',
        r.utNo || '',
        r.aadharNo || '',
        r.date || '',
        r.remark || '',
        r.createdBy || '',
        r.createdDate || ''
      ]);
    }

    const todayDateStr = new Date().toISOString().slice(0, 10);

    // 1. Export as Excel (.xlsx) file
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'JAM Portal';
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet('Data Records', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      worksheet.columns = [
        { header: 'PID', key: 'pid', width: 14 },
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Father', key: 'father', width: 26 },
        { header: 'UT No', key: 'utNo', width: 22 },
        { header: 'Aadhar no.', key: 'aadharNo', width: 20 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Remark', key: 'remark', width: 22 },
        { header: 'Created By', key: 'createdBy', width: 16 },
        { header: 'Created Date', key: 'createdDate', width: 16 }
      ];

      // Styled Header Row: Royal Navy Blue with Bold White Text
      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 26;

      // Add Data Rows
      formattedRows.forEach((row, idx) => {
        const addedRow = worksheet.addRow(row);
        addedRow.height = 20;
        addedRow.font = { name: 'Segoe UI', size: 10 };
        addedRow.alignment = { vertical: 'middle' };

        // Subtle alternating row zebra shading
        if (idx % 2 === 1) {
          addedRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }

        // Light gray cell borders
        addedRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      const filename = `JAM_Data_Records_${todayDateStr}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('x-no-compression', '1');
      return res.status(200).send(Buffer.from(buffer));
    }

    // 2. Export as CSV (.csv) file
    if (format === 'csv') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data Records');
      worksheet.addRow(headers);
      formattedRows.forEach(row => worksheet.addRow(row));

      const filename = `JAM_Data_Records_${todayDateStr}.csv`;
      const buffer = await workbook.csv.writeBuffer({ encoding: 'utf-8' });
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'x-no-compression': '1'
      });
      return res.end(Buffer.from(buffer));
    }

    // 3. Fallback: Raw JSON response
    res.json({
      success: true,
      data: {
        headers: headers,
        rows: formattedRows,
        totalCount: formattedRows.length
      }
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, message: 'Export error: ' + err.message });
  }
});

module.exports = router;
