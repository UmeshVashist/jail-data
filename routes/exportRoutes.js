/**
 * routes/exportRoutes.js - Formatted Export Data Endpoints via Google Sheets API
 */

const express = require('express');
const router = express.Router();
const { getRecords } = require('../config/googleSheets');
const { requireAuth } = require('../middleware/auth');

// GET /api/export - Get formatted data for Excel/PDF/Print
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = (req.query.query || '').trim().toLowerCase();
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const remarkFilter = (req.query.remark || '').trim();

    const allRecords = await getRecords();
    const headers = ['PID', 'Name', 'Father', 'UT No', 'Aadhar no.', 'Date', 'Remark', 'Created By', 'Created Date'];
    const formattedRows = [];

    for (let i = 0; i < allRecords.length; i++) {
      const r = allRecords[i];

      if (query !== '') {
        const pidMatch = (r.pid || '').toLowerCase().includes(query);
        const nameMatch = (r.name || '').toLowerCase().includes(query);
        const fatherMatch = (r.father || '').toLowerCase().includes(query);
        const utMatch = (r.utNo || '').toLowerCase().includes(query);
        const aadharMatch = (r.aadharNo || '').toLowerCase().includes(query);
        if (!pidMatch && !nameMatch && !fatherMatch && !utMatch && !aadharMatch) continue;
      }

      if (remarkFilter !== '' && remarkFilter.toLowerCase() !== 'all') {
        if ((r.remark || '').trim().toLowerCase() !== remarkFilter.toLowerCase()) continue;
      }

      if (startDate !== '' && r.date < startDate) continue;
      if (endDate !== '' && r.date > endDate) continue;

      formattedRows.push([
        r.pid,
        r.name,
        r.father || '',
        r.utNo || '',
        r.aadharNo || '',
        r.date || '',
        r.remark || '',
        r.createdBy,
        r.createdDate
      ]);
    }

    res.json({
      success: true,
      data: {
        headers: headers,
        rows: formattedRows,
        totalCount: formattedRows.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export error: ' + err.message });
  }
});

module.exports = router;
