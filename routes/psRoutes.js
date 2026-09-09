/**
 * routes/psRoutes.js - Police Station (PS List) Management API
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const {
  getPSList,
  addPSEntry,
  updatePSEntry,
  deletePSEntry,
  batchAddPS
} = require('../config/cloudflareStorage');
const { requireAuth, requireAdmin, requirePSListPermission } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/ps - Fetch and filter PS list (3 separate search bars: ps, district, state)
router.get('/', requirePSListPermission, async (req, res) => {
  try {
    const psQuery = (req.query.ps || req.query.query || '').trim().toLowerCase();
    const districtQuery = (req.query.district || '').trim().toLowerCase();
    const stateQuery = (req.query.state || '').trim().toLowerCase();
    const page = parseInt(req.query.page || 1, 10);
    const pageSize = req.query.pageSize === 'All' ? 'All' : parseInt(req.query.pageSize || req.query.limit || 25, 10);

    const allList = await getPSList();
    let filtered = allList;

    if (psQuery) {
      filtered = filtered.filter(item => (item.psName || item.ps || '').toLowerCase().includes(psQuery));
    }
    if (districtQuery) {
      filtered = filtered.filter(item => (item.district || '').toLowerCase().includes(districtQuery));
    }
    if (stateQuery) {
      filtered = filtered.filter(item => (item.state || '').toLowerCase().includes(stateQuery));
    }

    const total = filtered.length;
    let paginated = filtered;

    if (pageSize !== 'All') {
      const start = (page - 1) * pageSize;
      paginated = filtered.slice(start, start + pageSize);
    }

    const paginatedUppercase = paginated.map(item => ({
      ...item,
      ps: String(item.psName || item.ps || '').toUpperCase(),
      psName: String(item.psName || item.ps || '').toUpperCase(),
      district: String(item.district || '').toUpperCase(),
      state: String(item.state || '').toUpperCase()
    }));

    res.json({
      success: true,
      data: paginatedUppercase,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: pageSize === 'All' ? 1 : Math.ceil(total / pageSize) || 1
      },
      canModify: req.user.role && req.user.role.toLowerCase() === 'admin'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching PS list: ' + err.message });
  }
});

// POST /api/ps - Add new PS (Admin Only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const psName = (req.body.psName || req.body.ps || '').trim().toUpperCase();
    const district = (req.body.district || '').trim().toUpperCase();
    const state = (req.body.state || '').trim().toUpperCase();

    if (!psName) {
      return res.status(400).json({ success: false, message: 'Police Station (PS Name) is required.' });
    }

    const newEntry = await addPSEntry({
      psName: psName,
      ps: psName,
      district: district,
      state: state,
      createdBy: req.user.username
    });

    res.json({
      success: true,
      message: `Police Station "${psName}" added successfully.`,
      data: newEntry
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error adding PS: ' + err.message });
  }
});

// PUT /api/ps/:id - Update PS (Admin Only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const psName = (req.body.psName || req.body.ps || '').trim().toUpperCase();
    const district = (req.body.district || '').trim().toUpperCase();
    const state = (req.body.state || '').trim().toUpperCase();

    if (!psName) {
      return res.status(400).json({ success: false, message: 'Police Station (PS Name) is required.' });
    }

    const updated = await updatePSEntry(id, {
      psName: psName,
      ps: psName,
      district: district,
      state: state
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Police Station entry not found.' });
    }

    res.json({
      success: true,
      message: `Police Station "${psName}" updated successfully.`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating PS: ' + err.message });
  }
});

// DELETE /api/ps/:id - Delete PS (Admin Only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deletePSEntry(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Police Station entry not found.' });
    }

    res.json({ success: true, message: 'Police Station deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting PS: ' + err.message });
  }
});

// POST /api/ps/import - Bulk upload PS data from Excel/CSV (Admin Only)
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided for import.' });
    }

    const cleanRecords = [];
    for (const r of records) {
      const psName = (r.psName || r.ps || r.name || r['PS Name'] || r['Police Station'] || r['PS'] || '').toString().trim().toUpperCase();
      const district = (r.district || r['District'] || '').toString().trim().toUpperCase();
      const state = (r.state || r['State'] || '').toString().trim().toUpperCase();

      if (psName) {
        cleanRecords.push({
          psName,
          ps: psName,
          district,
          state,
          createdBy: req.user.username
        });
      }
    }

    if (cleanRecords.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid Police Station records found. Please check column headers (PS Name, District, State).' });
    }

    await batchAddPS(cleanRecords);
    res.json({
      success: true,
      message: `Successfully imported ${cleanRecords.length} Police Stations!`,
      count: cleanRecords.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Import error: ' + err.message });
  }
});

// GET /api/ps/sample-template - Download formatted sample Excel template (Admin Only)
router.get('/sample-template', requireAdmin, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Police Stations');

    worksheet.columns = [
      { header: 'PS Name', key: 'psName', width: 28 },
      { header: 'District', key: 'district', width: 24 },
      { header: 'State', key: 'state', width: 24 }
    ];

    // Style header row ONLY for columns A to C (1 to 3)
    for (let col = 1; col <= 3; col++) {
      const cell = worksheet.getCell(1, col);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Sample data rows
    worksheet.addRow({ psName: 'SADAR BAZAR', district: 'NORTH DELHI', state: 'DELHI' });
    worksheet.addRow({ psName: 'CIVIL LINES', district: 'CENTRAL', state: 'DELHI' });
    worksheet.addRow({ psName: 'INDIRAPURAM', district: 'GHAZIABAD', state: 'UTTAR PRADESH' });
    worksheet.addRow({ psName: 'SECTOR 14', district: 'GURUGRAM', state: 'HARYANA' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="PS_List_Sample_Template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error generating template: ' + err.message });
  }
});

module.exports = router;
