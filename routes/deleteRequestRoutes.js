/**
 * routes/deleteRequestRoutes.js - Delete Requests API routes
 */

const express = require('express');
const router = express.Router();
const { 
  getRecords, 
  deleteRecord, 
  getDeleteRequests, 
  createDeleteRequest, 
  updateDeleteRequestStatus, 
  deleteDeleteRequest 
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

// POST /api/delete-requests - Send Delete Request for a record
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'View') {
      return res.status(403).json({ success: false, message: 'View users cannot send delete requests.' });
    }

    const { recordId } = req.body;
    const targetRecordId = parseInt(recordId, 10);

    const records = await getRecords();
    const targetRecord = records.find(r => r.id === targetRecordId || r.rowIndex === targetRecordId);

    if (!targetRecord) {
      return res.status(404).json({ success: false, message: 'Target record not found.' });
    }

    // Check if a pending delete request already exists for this record
    const allRequests = await getDeleteRequests();
    const existingPending = allRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && r.pid === targetRecord.pid)) && 
      r.status === 'Pending'
    );

    if (existingPending) {
      return res.status(400).json({ success: false, message: 'A delete request is already pending for this record.' });
    }

    const now = new Date();
    const reqDate = getFormattedDate(now);
    const reqTime = getFormattedTime(now);

    await createDeleteRequest({
      recordId: targetRecord.id || targetRecord.rowIndex,
      pid: targetRecord.pid,
      name: targetRecord.name,
      father: targetRecord.father,
      utNo: targetRecord.utNo,
      aadharNo: targetRecord.aadharNo,
      requestedBy: req.user.username,
      requestedDate: reqDate,
      requestedTime: reqTime
    });

    res.json({ success: true, message: `Delete request sent successfully for PID ${targetRecord.pid}!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Send delete request error: ' + err.message });
  }
});

// GET /api/delete-requests/pending - List all pending delete requests (Admin / Delete Request Access)
router.get('/pending', requireDeleteRequestPermission, async (req, res) => {
  try {
    const allRequests = await getDeleteRequests();
    const pendingRequests = allRequests.filter(r => r.status === 'Pending');

    res.json({ success: true, data: pendingRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch pending requests error: ' + err.message });
  }
});

// GET /api/delete-requests/my-requests - List delete requests submitted by current user
router.get('/my-requests', async (req, res) => {
  try {
    const allRequests = await getDeleteRequests();
    const userRequests = allRequests.filter(r => 
      String(r.requestedBy || '').toLowerCase() === String(req.user.username || '').toLowerCase()
    );

    res.json({ success: true, data: userRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch my requests error: ' + err.message });
  }
});

// POST /api/delete-requests/:id/approve - Approve delete request and delete the record
router.post('/:id/approve', requireDeleteRequestPermission, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'Delete request not found.' });
    }

    if (targetReq.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status.toLowerCase()}.` });
    }

    // Find and delete the record
    const records = await getRecords();
    const targetRecord = records.find(r => 
      r.id === parseInt(targetReq.recordId, 10) || 
      r.rowIndex === parseInt(targetReq.recordId, 10) || 
      (r.pid && r.pid === targetReq.pid)
    );

    if (targetRecord) {
      await deleteRecord(targetRecord.id || targetRecord.rowIndex);
    }

    // Update request status to Approved
    await updateDeleteRequestStatus(requestId, 'Approved', req.user.username);

    res.json({ success: true, message: `Delete request approved. Record PID ${targetReq.pid} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Approve delete request error: ' + err.message });
  }
});

// POST /api/delete-requests/:id/reject - Reject / Cancel delete request by admin/permitted user
router.post('/:id/reject', requireDeleteRequestPermission, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'Delete request not found.' });
    }

    if (targetReq.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status.toLowerCase()}.` });
    }

    await updateDeleteRequestStatus(requestId, 'Rejected', req.user.username);

    res.json({ success: true, message: `Delete request for PID ${targetReq.pid} rejected.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Reject delete request error: ' + err.message });
  }
});

// DELETE /api/delete-requests/:id/cancel - Cancel pending delete request by the user who sent it
router.delete('/:id/cancel', async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'Delete request not found.' });
    }

    // Verify ownership
    if (String(targetReq.requestedBy).toLowerCase() !== String(req.user.username).toLowerCase() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'You can only cancel your own delete requests.' });
    }

    await deleteDeleteRequest(requestId);

    res.json({ success: true, message: `Delete request for PID ${targetReq.pid} canceled.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancel delete request error: ' + err.message });
  }
});

module.exports = router;
