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
  deleteEditRequest 
} = require('../config/googleSheets');
const { requireAuth, requireDeleteRequestPermission } = require('../middleware/auth');

router.use(requireAuth);

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
        aadharNo: (proposedData.aadharNo || '').trim(),
        date: proposedData.date || targetRecord.date || '',
        remark: (proposedData.remark || '').trim(),
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

    await deleteEditRequest(requestId);

    res.json({ success: true, message: `Edit request for PID ${targetReq.pid} canceled.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancel edit request error: ' + err.message });
  }
});

module.exports = router;
