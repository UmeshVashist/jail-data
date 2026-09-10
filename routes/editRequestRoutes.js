/**
 * routes/editRequestRoutes.js - Edit Requests API routes
 */

const express = require('express');
const router = express.Router();
const { 
  getRecords, 
  updateRecord, 
  getEditRequests, 
  createEditRequest, 
  updateEditRequestStatus, 
  deleteEditRequest,
  getRemarkOptions,
  getSystemSettings
} = require('../config/cloudflareStorage');
const { requireAuth, requireDeleteRequestPermission } = require('../middleware/auth');

router.use(requireAuth);

async function isAadharDisabledRemark(remarkValue) {
  if (!remarkValue) return false;
  const val = remarkValue.toString().trim().toLowerCase();

  try {
    const options = await getRemarkOptions();
    const match = options.find(opt => (opt.optionValue || opt).toString().trim().toLowerCase() === val);
    if (match && typeof match === 'object') {
      return !!match.disableAadhar;
    }
  } catch (e) {}

  return (
    val === 'foreigner' ||
    val === 'not available' ||
    val === 'notavailable' ||
    val === 'n/a' ||
    val === 'na' ||
    val === 'aadhar not made' ||
    val === 'aadharnotmade' ||
    val.includes('aadhar not made') ||
    val.includes('not made')
  );
}

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
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
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

// POST /api/edit-requests - Send Edit Request for a record
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'View') {
      return res.status(403).json({ success: false, message: 'View users cannot send edit requests.' });
    }

    const { recordId, proposedData, reason } = req.body;
    const targetRecordId = parseInt(recordId, 10);

    if (!proposedData || typeof proposedData !== 'object') {
      return res.status(400).json({ success: false, message: 'Proposed changes are required.' });
    }

    const records = await getRecords();
    const targetRecord = records.find(r => r.id === targetRecordId || r.rowIndex === targetRecordId);

    if (!targetRecord) {
      return res.status(404).json({ success: false, message: 'Target record not found.' });
    }

    // Check if a pending edit request already exists for this record
    const allRequests = await getEditRequests();
    const existingPending = allRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && r.pid === targetRecord.pid)) && 
      r.status === 'Pending'
    );

    if (existingPending) {
      return res.status(400).json({ success: false, message: 'An edit request is already pending for this record.' });
    }

    const now = new Date();
    const reqDate = getFormattedDate(now);
    const reqTime = getFormattedTime(now);

    const propDate = normalizeToYMD(proposedData.date);
    if (propDate && propDate > reqDate) {
      return res.status(400).json({ success: false, message: 'Enter valid date. Future dates are not allowed. Today or previous dates are allowed.' });
    }

    const propRemark = (proposedData.remark || '').trim();
    const isDisabledRemark = await isAadharDisabledRemark(propRemark);
    let propAadhar = isDisabledRemark ? '' : (proposedData.aadharNo || '').trim();

    const sysSettings = await getSystemSettings();
    if (sysSettings.aadharMandatory && !isDisabledRemark) {
      if (!propAadhar || propAadhar === '' || propAadhar === '#N/A') {
        return res.status(400).json({ success: false, message: 'Aadhar No. is mandatory according to system settings.' });
      }
    }

    if (propAadhar && propAadhar !== '#N/A' && /[^\d\s]/.test(propAadhar)) {
      return res.status(400).json({ success: false, message: 'Aadhar No must contain numbers only.' });
    }

    await createEditRequest({
      recordId: targetRecord.id || targetRecord.rowIndex,
      pid: targetRecord.pid,
      name: targetRecord.name,
      father: targetRecord.father,
      utNo: targetRecord.utNo,
      aadharNo: targetRecord.aadharNo,
      date: targetRecord.date,
      remark: targetRecord.remark,
      proposedData: {
        pid: targetRecord.pid,
        name: (proposedData.name || targetRecord.name).trim(),
        father: (proposedData.father || '').trim(),
        utNo: (proposedData.utNo || '').trim(),
        aadharNo: propAadhar,
        date: proposedData.date || targetRecord.date || '',
        remark: propRemark,
        createdBy: targetRecord.createdBy,
        createdDate: targetRecord.createdDate,
        createdTime: targetRecord.createdTime
      },
      requestedBy: req.user.username,
      requestedDate: reqDate,
      requestedTime: reqTime,
      reason: (reason || '').toString().trim()
    });

    res.json({ success: true, message: `Edit request sent successfully for PID ${targetRecord.pid}!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Send edit request error: ' + err.message });
  }
});

// GET /api/edit-requests/pending - List all pending edit requests
router.get('/pending', requireDeleteRequestPermission, async (req, res) => {
  try {
    const allRequests = await getEditRequests();
    const pendingRequests = allRequests.filter(r => r.status === 'Pending');

    res.json({ success: true, data: pendingRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch pending edit requests error: ' + err.message });
  }
});

// GET /api/edit-requests/all - List ALL edit requests
router.get('/all', requireDeleteRequestPermission, async (req, res) => {
  try {
    const allRequests = await getEditRequests();
    res.json({ success: true, data: allRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch all edit requests error: ' + err.message });
  }
});

// GET /api/edit-requests/my-requests - List edit requests submitted by current user
router.get('/my-requests', async (req, res) => {
  try {
    const allRequests = await getEditRequests();
    const userRequests = allRequests.filter(r => 
      String(r.requestedBy || '').toLowerCase() === String(req.user.username || '').toLowerCase()
    );

    res.json({ success: true, data: userRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch my edit requests error: ' + err.message });
  }
});

// POST /api/edit-requests/:id/approve - Approve edit request and apply updates to record
router.post('/:id/approve', requireDeleteRequestPermission, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getEditRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'Edit request not found.' });
    }

    if (targetReq.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status.toLowerCase()}.` });
    }

    // Find target record and apply proposed updates
    const records = await getRecords();
    const targetRecord = records.find(r => 
      r.id === parseInt(targetReq.recordId, 10) || 
      r.rowIndex === parseInt(targetReq.recordId, 10) || 
      (r.pid && r.pid === targetReq.pid)
    );

    if (!targetRecord) {
      return res.status(404).json({ success: false, message: 'Target record to update was not found.' });
    }

    const now = new Date();
    const updatedDate = getFormattedDate(now);
    const updatedTime = getFormattedTime(now);

    const proposed = targetReq.proposedData || {};

    const updatedObj = {
      pid: targetRecord.pid,
      name: proposed.name || targetRecord.name,
      father: proposed.father !== undefined ? proposed.father : targetRecord.father,
      utNo: proposed.utNo !== undefined ? proposed.utNo : targetRecord.utNo,
      aadharNo: proposed.aadharNo !== undefined ? proposed.aadharNo : targetRecord.aadharNo,
      date: proposed.date || targetRecord.date,
      remark: proposed.remark !== undefined ? proposed.remark : targetRecord.remark,
      createdBy: targetRecord.createdBy,
      createdDate: targetRecord.createdDate,
      createdTime: targetRecord.createdTime,
      updatedDate: updatedDate,
      updatedTime: updatedTime
    };

    await updateRecord(targetRecord.id || targetRecord.rowIndex, updatedObj);

    // Update edit request status to Approved
    await updateEditRequestStatus(requestId, 'Approved', req.user.username);

    res.json({ success: true, message: `Edit request approved. Record PID ${targetReq.pid} updated successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Approve edit request error: ' + err.message });
  }
});

// POST /api/edit-requests/:id/reject - Reject edit request
router.post('/:id/reject', requireDeleteRequestPermission, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getEditRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'Edit request not found.' });
    }

    if (targetReq.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status.toLowerCase()}.` });
    }

    await updateEditRequestStatus(requestId, 'Rejected', req.user.username);

    res.json({ success: true, message: `Edit request for PID ${targetReq.pid} rejected.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Reject edit request error: ' + err.message });
  }
});

// DELETE /api/edit-requests/:id/cancel - Cancel pending edit request by the user who sent it
router.delete('/:id/cancel', async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getEditRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'Edit request not found.' });
    }

    // Verify ownership
    if (String(targetReq.requestedBy).toLowerCase() !== String(req.user.username).toLowerCase() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'You can only cancel your own edit requests.' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot withdraw request that has already been ${targetReq.status.toLowerCase()}.` });
    }

    await deleteEditRequest(requestId);

    res.json({ success: true, message: `Edit request for PID ${targetReq.pid} canceled.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancel edit request error: ' + err.message });
  }
});

module.exports = router;
