/**
 * routes/deleteRequestRoutes.js - Delete Requests API routes
 */

const express = require('express');
const router = express.Router();
const { 
  getRecords, 
  deleteRecord, 
  getDeleteRequests, 
  getEditRequests,
  createDeleteRequest, 
  updateDeleteRequestStatus, 
  deleteDeleteRequest 
} = require('../config/cloudflareStorage');
const { requireAuth, requireDeleteRequestPermission } = require('../middleware/auth');

router.use(requireAuth);

function getFormattedDate(d = new Date()) {
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(d);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
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

// POST /api/delete-requests - Send Delete Request for a record
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'View') {
      return res.status(403).json({ success: false, message: 'View users cannot send delete requests.' });
    }

    const { recordId, reason } = req.body;
    const targetRecordId = parseInt(recordId, 10);

    const records = await getRecords();
    const targetRecord = records.find(r => r.id === targetRecordId || r.rowIndex === targetRecordId);

    if (!targetRecord) {
      return res.status(404).json({ success: false, message: 'Target record not found.' });
    }

    // Check if ANY pending request (Delete OR Edit) already exists for this record/PID
    const [allDeleteRequests, allEditRequests] = await Promise.all([
      getDeleteRequests(),
      getEditRequests()
    ]);

    const existingPendingDelete = allDeleteRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && String(r.pid) === String(targetRecord.pid))) && 
      r.status === 'Pending'
    );
    if (existingPendingDelete) {
      return res.status(400).json({ 
        success: false, 
        message: `Is PID (${targetRecord.pid}) ki Delete Request pehle se pending hai. Approval ka wait karein.` 
      });
    }

    const existingPendingEdit = allEditRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && String(r.pid) === String(targetRecord.pid))) && 
      r.status === 'Pending'
    );
    if (existingPendingEdit) {
      return res.status(400).json({ 
        success: false, 
        message: `Is PID (${targetRecord.pid}) ki Edit Request pehle se pending hai. Ek PID ke liye ek waqt me sirf 1 request bheji ja sakti hai.` 
      });
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
      requestedTime: reqTime,
      reason: (reason || '').toString().trim()
    });

    res.json({ success: true, message: `Delete request sent successfully for PID ${targetRecord.pid}!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Send delete request error: ' + err.message });
  }
});

// GET /api/delete-requests - List all delete requests (Root alias)
router.get('/', async (req, res) => {
  try {
    const allRequests = await getDeleteRequests();
    res.json({ success: true, data: allRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch delete requests error: ' + err.message });
  }
});

// GET /api/delete-requests/pending - List all pending delete requests
router.get('/pending', requireDeleteRequestPermission, async (req, res) => {
  try {
    const allRequests = await getDeleteRequests();
    const pendingRequests = allRequests.filter(r => r.status === 'Pending');

    res.json({ success: true, data: pendingRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch pending requests error: ' + err.message });
  }
});

// GET /api/delete-requests/all - List ALL delete requests (Pending, Approved, Rejected)
router.get('/all', requireDeleteRequestPermission, async (req, res) => {
  try {
    const allRequests = await getDeleteRequests();
    res.json({ success: true, data: allRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch all requests error: ' + err.message });
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

// Approve delete request (Supports both POST and PUT)
const handleApproveDelete = async (req, res) => {
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
};
router.post('/:id/approve', requireDeleteRequestPermission, handleApproveDelete);
router.put('/:id/approve', requireDeleteRequestPermission, handleApproveDelete);

// Reject / Cancel delete request by admin/permitted user (Supports both POST and PUT)
const handleRejectDelete = async (req, res) => {
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
};
router.post('/:id/reject', requireDeleteRequestPermission, handleRejectDelete);
router.put('/:id/reject', requireDeleteRequestPermission, handleRejectDelete);

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

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot withdraw request that has already been ${targetReq.status.toLowerCase()}.` });
    }

    await deleteDeleteRequest(requestId);

    res.json({ success: true, message: `Delete request for PID ${targetReq.pid} canceled.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancel delete request error: ' + err.message });
  }
});

module.exports = router;
