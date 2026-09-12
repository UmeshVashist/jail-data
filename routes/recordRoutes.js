/**
 * routes/recordRoutes.js - Records CRUD, Instant Search, Date Filters & Aadhar/PID Validation via Cloudflare R2
 */

const express = require('express');
const router = express.Router();
const { getRecords, addRecord, updateRecord, deleteRecord, getUsers, getDeleteRequests, getEditRequests, getListAddRequests, getRemarkOptions, addRemarkOption, updateRemarkOption, deleteRemarkOption, toggleRemarkOptionAadhar, getSystemSettings, updateSystemSetting } = require('../config/cloudflareStorage');
const { requireAuth, requireAdmin, canModifyRecord } = require('../middleware/auth');

// GET /api/records/remark-options - Fetch dynamic remark options (Permanent + Active Pending List-Add Requests)
router.get('/remark-options', requireAuth, async (req, res) => {
  try {
    const permanentOnly = req.query.permanentOnly === 'true';
    const [options, listRequests] = await Promise.all([
      getRemarkOptions(),
      permanentOnly ? Promise.resolve([]) : getListAddRequests()
    ]);

    const existingValues = new Set();
    const result = [];

    // 1. Permanent/Approved remark options
    (options || []).forEach(opt => {
      const val = (typeof opt === 'object' ? opt.optionValue : opt) || '';
      const clean = val.toString().trim();
      if (clean && !existingValues.has(clean.toLowerCase())) {
        existingValues.add(clean.toLowerCase());
        result.push({
          optionValue: clean,
          disableAadhar: typeof opt === 'object' ? !!opt.disableAadhar : false,
          isPending: false
        });
      }
    });

    // 2. Pending list add requests so users can immediately use the option in all dropdowns
    if (!permanentOnly && Array.isArray(listRequests)) {
      listRequests.forEach(req => {
        if (req.status === 'Pending' && req.optionValue) {
          const clean = req.optionValue.toString().trim();
          if (clean && !existingValues.has(clean.toLowerCase())) {
            existingValues.add(clean.toLowerCase());
            result.push({
              optionValue: clean,
              disableAadhar: !!req.disableAadhar,
              isPending: true,
              requestedBy: req.requestedBy || ''
            });
          }
        }
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch remark options error: ' + err.message });
  }
});

// POST /api/records/remark-options - Add new remark option (Admin Only)
router.post('/remark-options', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { optionValue, disableAadhar } = req.body;
    const cleanVal = (optionValue || '').trim();
    if (!cleanVal) return res.status(400).json({ success: false, message: 'Option value is required.' });

    await addRemarkOption(cleanVal, !!disableAadhar);
    res.json({ success: true, message: `Remark option "${cleanVal}" added successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Add remark option error: ' + err.message });
  }
});

// PUT /api/records/remark-options/toggle-aadhar - Toggle Disable Aadhar setting for a remark option (Admin Only)
router.put('/remark-options/toggle-aadhar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { optionValue, disableAadhar } = req.body;
    const cleanVal = (optionValue || '').trim();
    if (!cleanVal) return res.status(400).json({ success: false, message: 'Option value is required.' });

    await toggleRemarkOptionAadhar(cleanVal, !!disableAadhar);
    res.json({ success: true, message: `Remark option "${cleanVal}" Aadhar disable setting updated.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Toggle remark option Aadhar error: ' + err.message });
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

// GET /api/records/check-pid/:pid - Check if PID already exists in database
router.get('/check-pid/:pid', requireAuth, async (req, res) => {
  try {
    const searchPid = (req.params.pid || '').trim();
    if (!searchPid) {
      return res.json({ success: true, exists: false });
    }
    const excludeId = req.query.excludeId ? parseInt(req.query.excludeId, 10) : null;
    const records = await getRecords();
    const exists = records.some(r => {
      if (excludeId && (r.id === excludeId || r.rowIndex === excludeId)) return false;
      return String(r.pid).toLowerCase() === searchPid.toLowerCase();
    });
    res.json({ success: true, exists, pid: searchPid });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function getFormattedDate(d = new Date()) {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(d);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

function normalizeToYMD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const s = dateStr.trim();
  // Format: YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  // Format: DD-MM-YYYY or DD/MM/YYYY
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return s;
}

function getFormattedTime(d = new Date()) {
  return d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Helper to process, validate, and format Aadhar No.
 * - If empty -> returns '#N/A'
 * - If provided -> requires min 12 digits, formats as 'XXXX XXXX XXXX'
 */
function processAadharInput(inputStr) {
  if (!inputStr || inputStr.trim() === '' || inputStr.trim() === '#N/A' || /^n\/?a$/i.test(inputStr.trim()) || /^none$/i.test(inputStr.trim()) || /^null$/i.test(inputStr.trim())) {
    return { valid: true, value: '#N/A', cleanDigits: '' };
  }

  const str = inputStr.trim();
  if (/[^\d\s]/.test(str)) {
    return { valid: false, error: 'Aadhar No must contain numbers only.' };
  }

  const cleanDigits = str.replace(/\D/g, '');

  if (cleanDigits.length < 12) {
    return { valid: false, error: 'Aadhar No must contain at least 12 digits.' };
  }

  // Format 12 digits as 'XXXX XXXX XXXX'
  const formatted = cleanDigits.slice(0, 12).replace(/^(\d{4})(\d{4})(\d{4})$/, '$1 $2 $3').trim();
  return { valid: true, value: formatted, cleanDigits: cleanDigits.slice(0, 12) };
}

async function isAadharDisabledRemark(remarkValue) {
  if (!remarkValue) return false;
  const val = remarkValue.toString().trim().toLowerCase();

  try {
    const options = await getRemarkOptions();
    const match = options.find(opt => (opt.optionValue || opt).toString().trim().toLowerCase() === val);
    if (match && typeof match === 'object') {
      return !!match.disableAadhar;
    }

    // Also check pending list add requests so temporary options respect disableAadhar!
    const listRequests = await getListAddRequests();
    const pendingMatch = (listRequests || []).find(r => r.status === 'Pending' && (r.optionValue || '').toString().trim().toLowerCase() === val);
    if (pendingMatch) {
      return !!pendingMatch.disableAadhar;
    }
  } catch (e) {}

  return (
    val === 'foreigner' ||
    val === 'not available' ||
    val === 'notavailable' ||
    val === 'n/a' ||
    val === 'na' ||
    val === 'aadhar not made' ||
    val === 'aadharnotmade'
  );
}

// GET /api/records/settings - Fetch system settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getSystemSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch settings error: ' + err.message });
  }
});

// PUT /api/records/settings - Update system settings (Admin Only)
router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { aadharMandatory } = req.body;
    const settings = await updateSystemSetting('aadhar_mandatory', aadharMandatory);
    res.json({ success: true, settings, message: 'System settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update settings error: ' + err.message });
  }
});

// GET /api/records/by-pid/:pid - Get single record details by PID
router.get('/by-pid/:pid', requireAuth, async (req, res) => {
  try {
    const pidParam = (req.params.pid || '').trim();
    const records = await getRecords();
    const record = records.find(r => String(r.pid).toLowerCase() === pidParam.toLowerCase());
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found for PID ' + pidParam });
    }
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching record: ' + err.message });
  }
});

// GET /api/records/dashboard - Dashboard Analytics
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const todayStr = getFormattedDate();
    const records = await getRecords();
    const users = await getUsers();

    const totalRecords = records.length;
    let todayRecordsCount = 0;
    let todayImportsCount = 0;

    for (const rec of records) {
      if (rec.createdDate === todayStr) {
        todayRecordsCount++;
        if ((rec.remark || '').toLowerCase().includes('import') || (rec.createdBy || '').toLowerCase().includes('import')) {
          todayImportsCount++;
        }
      }
    }

    // Sort records descending by timestamp/id so the most recent records are at the top
    const sortedRecords = [...records].sort((a, b) => {
      const timeA = (a.createdDate || '') + ' ' + (a.createdTime || '');
      const timeB = (b.createdDate || '') + ' ' + (b.createdTime || '');
      if (timeA && timeB && timeA !== timeB) {
        return timeB.localeCompare(timeA);
      }
      return (b.id || 0) - (a.id || 0);
    });

    const recentActivities = sortedRecords.slice(0, 10);

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
    const todayOnly = req.query.today === 'true' || req.query.todayOnly === 'true';
    const todayStr = getFormattedDate();
    const query = (req.query.query || '').trim().toLowerCase();
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const remarkFilter = (req.query.remark || '').trim();
    const recordTypeFilter = (req.query.recordType || 'all').trim().toUpperCase();
    const page = parseInt(req.query.page || 1, 10);
    const pageSize = req.query.pageSize === 'All' ? 'All' : parseInt(req.query.pageSize || 25, 10);
    const sortColumn = req.query.sortColumn || 'createdDate';
    const sortDirection = req.query.sortDirection || 'desc';

    const allRecords = await getRecords();
    const allDeleteRequests = await getDeleteRequests();
    const allEditRequests = await getEditRequests();

    const pendingDeleteRecordIds = new Set(
      allDeleteRequests.filter(r => r.status === 'Pending').map(r => String(r.recordId || r.pid))
    );
    const pendingEditRecordIds = new Set(
      allEditRequests.filter(r => r.status === 'Pending').map(r => String(r.recordId || r.pid))
    );
    const filteredRecords = [];

    for (let i = 0; i < allRecords.length; i++) {
      const rec = allRecords[i];

      // Today Only Filter
      if (todayOnly && rec.createdDate !== todayStr && rec.date !== todayStr) continue;

      // Search Filter (PID, Name, Father, UT No, Aadhar No)
      if (query !== '') {
        const pidMatch = (rec.pid || '').toLowerCase().includes(query);
        const nameMatch = (rec.name || '').toLowerCase().includes(query);
        const fatherMatch = (rec.father || '').toLowerCase().includes(query);
        const utMatch = (rec.utNo || '').toLowerCase().includes(query);
        const aadharMatch = (rec.aadharNo || '').toLowerCase().includes(query);
        if (!pidMatch && !nameMatch && !fatherMatch && !utMatch && !aadharMatch) continue;
      }

      // Remark Filter
      if (remarkFilter !== '' && remarkFilter.toLowerCase() !== 'all') {
        if ((rec.remark || '').trim().toLowerCase() !== remarkFilter.toLowerCase()) continue;
      }

      // Record Type Filter (UT vs CT)
      if (recordTypeFilter === 'UT') {
        const isUT = (rec.recordType && rec.recordType.toUpperCase() === 'UT') ||
                     /\bUT\b|UT/i.test(rec.utNo);
        if (!isUT) continue;
      } else if (recordTypeFilter === 'CT') {
        const isCT = (rec.recordType && rec.recordType.toUpperCase() === 'CT') ||
                     /\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(rec.utNo);
        if (!isCT) continue;
      }

      // Date Range Filter
      if (startDate !== '' && rec.date < startDate) continue;
      if (endDate !== '' && rec.date > endDate) continue;

      // Add permission flags
      rec.canEdit = canModifyRecord(req.user, rec);
      rec.canDelete = canModifyRecord(req.user, rec);
      rec.hasPendingDeleteRequest = pendingDeleteRecordIds.has(String(rec.id)) || pendingDeleteRecordIds.has(String(rec.rowIndex)) || pendingDeleteRecordIds.has(String(rec.pid));
      rec.hasPendingEditRequest = pendingEditRecordIds.has(String(rec.id)) || pendingEditRecordIds.has(String(rec.rowIndex)) || pendingEditRecordIds.has(String(rec.pid));

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

    const { pid, name, father, utNo, recordType, aadharNo, date, remark } = req.body;
    const cleanPid = (pid || '').toString().trim();
    const cleanName = (name || '').toString().trim();
    const cleanRemark = (remark || '').trim();
    let cleanUtNo = (utNo || '').trim();
    const cleanRecordType = (recordType || '').trim().toUpperCase();

    if (cleanUtNo && !/(UT|CT|CP|DT|DP)/i.test(cleanUtNo) && cleanRecordType) {
      cleanUtNo = `${cleanUtNo}-${cleanRecordType}`;
    }

    if (!cleanPid) return res.status(400).json({ success: false, message: 'PID is required.' });
    if (!/^\d+$/.test(cleanPid)) {
      return res.status(400).json({ success: false, message: 'PID must contain numbers only.' });
    }
    if (!cleanName) return res.status(400).json({ success: false, message: 'Name is required.' });

    const now = new Date();
    const createdDate = getFormattedDate(now);
    const createdTime = getFormattedTime(now);
    const recordDate = normalizeToYMD(date) || createdDate;

    if (recordDate > createdDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Enter valid date. Future dates are not allowed. Today or previous dates are allowed.' 
      });
    }

    // Handle disabled remarks (Aadhar Not Made, Foreigner, etc.)
    const isDisabledRemark = await isAadharDisabledRemark(cleanRemark);
    const effectiveAadharNo = isDisabledRemark ? '' : aadharNo;

    // Fetch system settings to check mandatory Aadhar requirement
    const sysSettings = await getSystemSettings();
    if (sysSettings.aadharMandatory && !isDisabledRemark) {
      if (!effectiveAadharNo || effectiveAadharNo.trim() === '' || effectiveAadharNo.trim() === '#N/A' || /^n\/?a$/i.test(effectiveAadharNo.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Aadhar No. is mandatory according to system settings. Please enter a 12-digit Aadhar Number or select an exempt remark (e.g. Aadhar Not Made, Not Available, Foreigner).'
        });
      }
    }

    // Validate & format Aadhar No
    const aadharRes = processAadharInput(effectiveAadharNo);
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

    const createdRec = await addRecord({
      pid: cleanPid,
      name: cleanName,
      father: (father || '').trim(),
      utNo: cleanUtNo,
      recordType: cleanRecordType || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(cleanUtNo) ? 'CT' : 'UT'),
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

// PUT /api/records/:id/remark - Update record remark (Used in Reactive List page)
router.put('/:id/remark', requireAuth, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    const { remark } = req.body;
    const cleanRemark = (remark || '').toString().trim();

    if (!cleanRemark) {
      return res.status(400).json({ success: false, message: 'New remark value is required.' });
    }

    const records = await getRecords();
    const targetRec = records.find(r => r.id === recordId || r.rowIndex === recordId);
    if (!targetRec) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }

    const now = new Date();
    const updatedDate = getFormattedDate(now);
    const updatedTime = getFormattedTime(now);

    const isDisabledRemark = await isAadharDisabledRemark(cleanRemark);
    const updatedAadharNo = isDisabledRemark ? '' : (targetRec.aadharNo || '');

    const updatedData = {
      ...targetRec,
      remark: cleanRemark,
      aadharNo: updatedAadharNo,
      updatedDate,
      updatedTime
    };

    await updateRecord(recordId, updatedData);

    res.json({ success: true, message: `Record (PID: ${targetRec.pid}) remark updated to "${cleanRemark}" successfully!`, data: updatedData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update record remark error: ' + err.message });
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

    const { pid, name, father, utNo, recordType, aadharNo, date, remark } = req.body;
    const cleanPid = (pid || '').toString().trim();
    const cleanName = (name || '').toString().trim();
    const cleanRemark = (remark || '').trim();
    let cleanUtNo = (utNo || '').trim();
    const cleanRecordType = (recordType || '').trim().toUpperCase();

    if (cleanUtNo && !/(UT|CT|CP|DT|DP)/i.test(cleanUtNo) && cleanRecordType) {
      cleanUtNo = `${cleanUtNo}-${cleanRecordType}`;
    }

    if (!cleanPid) return res.status(400).json({ success: false, message: 'PID is required.' });
    if (!/^\d+$/.test(cleanPid)) {
      return res.status(400).json({ success: false, message: 'PID must contain numbers only.' });
    }
    if (!cleanName) return res.status(400).json({ success: false, message: 'Name is required.' });

    // Handle disabled remarks (Aadhar Not Made, Foreigner, etc.)
    const isDisabledRemark = await isAadharDisabledRemark(cleanRemark);
    const effectiveAadharNo = isDisabledRemark ? '' : aadharNo;

    // Fetch system settings to check mandatory Aadhar requirement
    const sysSettings = await getSystemSettings();
    if (sysSettings.aadharMandatory && !isDisabledRemark) {
      if (!effectiveAadharNo || effectiveAadharNo.trim() === '' || effectiveAadharNo.trim() === '#N/A') {
        return res.status(400).json({ success: false, message: 'Aadhar No. is mandatory according to system settings.' });
      }
    }

    // Validate & format Aadhar No
    const aadharRes = processAadharInput(effectiveAadharNo);
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
    const targetDate = normalizeToYMD(date || existingRecord.date);

    if (targetDate && targetDate > updatedDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Enter valid date. Future dates are not allowed. Today or previous dates are allowed.' 
      });
    }

    await updateRecord(rowIndex, {
      pid: cleanPid,
      name: cleanName,
      father: (father || '').trim(),
      utNo: cleanUtNo,
      recordType: cleanRecordType || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(cleanUtNo) ? 'CT' : 'UT'),
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
