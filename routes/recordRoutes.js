/**
 * routes/recordRoutes.js - Records CRUD, Instant Search, Date Filters & Aadhar/PID Validation via Google Sheets API
 */

const express = require('express');
const router = express.Router();
const { getRecords, addRecord, updateRecord, deleteRecord, getUsers, getDeleteRequests, getRemarkOptions, addRemarkOption, updateRemarkOption, deleteRemarkOption } = require('../config/googleSheets');
const { requireAuth, requireAdmin, canModifyRecord } = require('../middleware/auth');

// GET /api/records/remark-options - Fetch dynamic remark options from Google Sheet tab
router.get('/remark-options', requireAuth, async (req, res) => {
  try {
    const options = await getRemarkOptions();
    res.json({ success: true, data: options });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch remark options error: ' + err.message });
  }
});

// POST /api/records/remark-options - Add new remark option (Admin Only)
router.post('/remark-options', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { optionValue } = req.body;
    const cleanVal = (optionValue || '').trim();
    if (!cleanVal) return res.status(400).json({ success: false, message: 'Option value is required.' });

    await addRemarkOption(cleanVal);
    res.json({ success: true, message: `Remark option "${cleanVal}" added successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Add remark option error: ' + err.message });
  }
});

// PUT /api/records/remark-options - Update existing remark option (Admin Only)
router.put('/remark-options', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { oldValue, newValue } = req.body;
    const cleanOld = (oldValue || '').trim();
    const cleanNew = (newValue || '').trim();
    if (!cleanOld || !cleanNew) return res.status(400).json({ success: false, message: 'Old and New option values are required.' });

    await updateRemarkOption(cleanOld, cleanNew);
    res.json({ success: true, message: `Remark option updated from "${cleanOld}" to "${cleanNew}".` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update remark option error: ' + err.message });
  }
});

// DELETE /api/records/remark-options - Delete remark option (Admin Only)
router.delete('/remark-options', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { optionValue } = req.body;
    const cleanVal = (optionValue || '').trim();
    if (!cleanVal) return res.status(400).json({ success: false, message: 'Option value is required.' });

    await deleteRemarkOption(cleanVal);
    res.json({ success: true, message: `Remark option "${cleanVal}" deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete remark option error: ' + err.message });
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
 * Helper to process, validate, and format Aadhar No.
 * - If empty -> returns '#N/A'
 * - If provided -> requires min 12 digits, formats as 'XXXX XXXX XXXX'
 */
function processAadharInput(inputStr) {
  if (!inputStr || inputStr.trim() === '' || inputStr.trim() === '#N/A') {
    return { valid: true, value: '#N/A', cleanDigits: '' };
  }

  const str = inputStr.trim();
  const cleanDigits = str.replace(/\D/g, '');

  if (cleanDigits.length < 12) {
    return { valid: false, error: 'Aadhar No must contain at least 12 digits.' };
  }

  // Format 12+ digits as 'XXXX XXXX XXXX'
  const formatted = cleanDigits.replace(/^(\d{4})(\d{4})(\d{4})(.*)$/, '$1 $2 $3$4').trim();
  return { valid: true, value: formatted, cleanDigits: cleanDigits };
}

// GET /api/records/dashboard - Dashboard Analytics
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const todayStr = getFormattedDate();
    const records = await getRecords();
    const users = await getUsers();

    const totalRecords = records.length;
    let todayRecordsCount = 0;
    let todayImportsCount = 0;

    const recentActivities = [];

    for (let i = records.length - 1; i >= 0; i--) {
      const rec = records[i];
      if (rec.createdDate === todayStr) {
        todayRecordsCount++;
        if ((rec.remark || '').toLowerCase().includes('import') || (rec.createdBy || '').toLowerCase().includes('import')) {
          todayImportsCount++;
        }
      }

      if (recentActivities.length < 10) {
        recentActivities.push(rec);
      }
    }

    res.json({
      success: true,
      data: {
        totalRecords: totalRecords,
        todayRecords: todayRecordsCount,
        totalUsers: users.length,
        todayImports: todayImportsCount,
        recentActivities: recentActivities,
        userPermissions: {
          role: req.user.role,
          importPermission: req.user.importPermission,
          fullAccess: req.user.fullAccess
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Dashboard stats error: ' + err.message });
  }
});

// GET /api/records - Search, Filter, Sort & Paginate
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = (req.query.query || '').trim().toLowerCase();
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const page = parseInt(req.query.page || 1, 10);
    const pageSize = req.query.pageSize === 'All' ? 'All' : parseInt(req.query.pageSize || 25, 10);
    const sortColumn = req.query.sortColumn || 'createdDate';
    const sortDirection = req.query.sortDirection || 'desc';

    const allRecords = await getRecords();
    const allRequests = await getDeleteRequests();
    const pendingRequestRecordIds = new Set(
      allRequests.filter(r => r.status === 'Pending').map(r => String(r.recordId || r.pid))
    );
    const filteredRecords = [];

    for (let i = 0; i < allRecords.length; i++) {
      const rec = allRecords[i];

      // Search Filter (PID, Name, Father, UT No, Aadhar No)
      if (query !== '') {
        const pidMatch = (rec.pid || '').toLowerCase().includes(query);
        const nameMatch = (rec.name || '').toLowerCase().includes(query);
        const fatherMatch = (rec.father || '').toLowerCase().includes(query);
        const utMatch = (rec.utNo || '').toLowerCase().includes(query);
        const aadharMatch = (rec.aadharNo || '').toLowerCase().includes(query);
        if (!pidMatch && !nameMatch && !fatherMatch && !utMatch && !aadharMatch) continue;
      }

      // Date Range Filter
      if (startDate !== '' && rec.date < startDate) continue;
      if (endDate !== '' && rec.date > endDate) continue;

      // Add permission flags
      rec.canEdit = canModifyRecord(req.user, rec);
      rec.canDelete = canModifyRecord(req.user, rec);
      rec.hasPendingDeleteRequest = pendingRequestRecordIds.has(String(rec.id)) || pendingRequestRecordIds.has(String(rec.rowIndex)) || pendingRequestRecordIds.has(String(rec.pid));

      filteredRecords.push(rec);
    }

    // Sort Records
    filteredRecords.sort((a, b) => {
      let valA = a[sortColumn] || '';
      let valB = b[sortColumn] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;

      // Tie-breaker if primary values are equal
      if (sortColumn === 'createdDate') {
        const timeA = a.createdTime || '';
        const timeB = b.createdTime || '';
        if (timeA !== timeB) {
          return sortDirection === 'asc' ? (timeA < timeB ? -1 : 1) : (timeA > timeB ? -1 : 1);
        }
      }
      const idA = Number(a.id || a.rowIndex || 0);
      const idB = Number(b.id || b.rowIndex || 0);
      return sortDirection === 'asc' ? idA - idB : idB - idA;
    });

    const totalRecords = filteredRecords.length;
    let paginatedRecords = [];

    if (pageSize === 'All') {
      paginatedRecords = filteredRecords;
    } else {
      const startIndex = (page - 1) * pageSize;
      paginatedRecords = filteredRecords.slice(startIndex, startIndex + pageSize);
    }

    res.json({
      success: true,
      data: {
        records: paginatedRecords,
        totalRecords: totalRecords,
        page: page,
        pageSize: pageSize,
        userPermissions: {
          role: req.user.role,
          importPermission: req.user.importPermission,
          fullAccess: req.user.fullAccess
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch records error: ' + err.message });
  }
});

// POST /api/records - Add New Record with Numeric PID & Aadhar Uniqueness Checks
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'View') {
      return res.status(403).json({ success: false, message: 'View users cannot add records.' });
    }

    const { pid, name, father, utNo, aadharNo, date, remark } = req.body;
    const cleanPid = (pid || '').toString().trim();
    const cleanName = (name || '').toString().trim();

    if (!cleanPid) return res.status(400).json({ success: false, message: 'PID is required.' });
    if (!/^\d+$/.test(cleanPid)) {
      return res.status(400).json({ success: false, message: 'PID must contain numbers only.' });
    }
    if (!cleanName) return res.status(400).json({ success: false, message: 'Name is required.' });

    // Validate & format Aadhar No
    const aadharRes = processAadharInput(aadharNo);
    if (!aadharRes.valid) {
      return res.status(400).json({ success: false, message: aadharRes.error });
    }

    const records = await getRecords();

    // Check Duplicate PID
    const isPidDup = records.some(r => r.pid.toLowerCase() === cleanPid.toLowerCase());
    if (isPidDup) {
      return res.status(400).json({ success: false, message: 'PID already exists.' });
    }

    // Check Duplicate Aadhar No (if provided and not #N/A)
    if (aadharRes.value !== '#N/A') {
      const cleanTargetAadhar = aadharRes.cleanDigits;
      const isAadharDup = records.some(r => {
        if (!r.aadharNo || r.aadharNo === '#N/A') return false;
        const exClean = r.aadharNo.replace(/\D/g, '');
        return exClean === cleanTargetAadhar;
      });

      if (isAadharDup) {
        return res.status(400).json({ success: false, message: 'Aadhar No already exists.' });
      }
    }

    const now = new Date();
    const createdDate = getFormattedDate(now);
    const createdTime = getFormattedTime(now);
    const recordDate = date || createdDate;

    const createdRec = await addRecord({
      pid: cleanPid,
      name: cleanName,
      father: (father || '').trim(),
      utNo: (utNo || '').trim(),
      aadharNo: aadharRes.value,
      date: recordDate,
      remark: (remark || '').trim(),
      createdBy: req.user.username,
      createdDate: createdDate,
      createdTime: createdTime
    });

    res.json({ success: true, message: 'Record created successfully!', record: createdRec });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Add record error: ' + err.message });
  }
});

// PUT /api/records/:id - Update Existing Record
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const records = await getRecords();
    const existingRecord = records.find(r => r.id === rowIndex || r.rowIndex === rowIndex);

    if (!existingRecord) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    if (!canModifyRecord(req.user, existingRecord)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this record (Only own records within 24h allowed).' });
    }

    const { pid, name, father, utNo, aadharNo, date, remark } = req.body;
    const cleanPid = (pid || '').toString().trim();
    const cleanName = (name || '').toString().trim();

    if (!cleanPid) return res.status(400).json({ success: false, message: 'PID is required.' });
    if (!/^\d+$/.test(cleanPid)) {
      return res.status(400).json({ success: false, message: 'PID must contain numbers only.' });
    }
    if (!cleanName) return res.status(400).json({ success: false, message: 'Name is required.' });

    // Validate & format Aadhar No
    const aadharRes = processAadharInput(aadharNo);
    if (!aadharRes.valid) {
      return res.status(400).json({ success: false, message: aadharRes.error });
    }

    // Check duplicate PID excluding current row
    const isPidDup = records.some(r => r.pid.toLowerCase() === cleanPid.toLowerCase() && (r.id !== rowIndex && r.rowIndex !== rowIndex));
    if (isPidDup) {
      return res.status(400).json({ success: false, message: 'PID already exists.' });
    }

    // Check duplicate Aadhar No excluding current row
    if (aadharRes.value !== '#N/A') {
      const cleanTargetAadhar = aadharRes.cleanDigits;
      const isAadharDup = records.some(r => {
        if ((r.id === rowIndex || r.rowIndex === rowIndex) || !r.aadharNo || r.aadharNo === '#N/A') return false;
        const exClean = r.aadharNo.replace(/\D/g, '');
        return exClean === cleanTargetAadhar;
      });

      if (isAadharDup) {
        return res.status(400).json({ success: false, message: 'Aadhar No already exists.' });
      }
    }

    const now = new Date();
    const updatedDate = getFormattedDate(now);
    const updatedTime = getFormattedTime(now);

    await updateRecord(rowIndex, {
      pid: cleanPid,
      name: cleanName,
      father: (father || '').trim(),
      utNo: (utNo || '').trim(),
      aadharNo: aadharRes.value,
      date: date || existingRecord.date,
      remark: (remark || '').trim(),
      updatedDate: updatedDate,
      updatedTime: updatedTime
    });

    res.json({ success: true, message: 'Record updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update record error: ' + err.message });
  }
});

// DELETE /api/records/:id - Delete Record
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id, 10);
    const records = await getRecords();
    const existingRecord = records.find(r => r.id === rowIndex || r.rowIndex === rowIndex);

    if (!existingRecord) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    if (!canModifyRecord(req.user, existingRecord)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this record.' });
    }

    await deleteRecord(rowIndex);

    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete record error: ' + err.message });
  }
});

module.exports = router;
