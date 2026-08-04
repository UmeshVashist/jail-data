/**
 * routes/listAddRequestRoutes.js - List Add Requests API routes
 */

const express = require('express');
const router = express.Router();
const { 
  getListAddRequests, 
  createListAddRequest, 
  updateListAddRequestStatus, 
  deleteListAddRequest,
  addRemarkOption,
  getRemarkOptions
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

// POST /api/list-add-requests - Send Request to Add New Dropdown Option
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'View') {
      return res.status(403).json({ success: false, message: 'View users cannot send list add requests.' });
    }

    const { optionValue, reason } = req.body;
    const cleanOption = (optionValue || '').toString().trim();

    if (!cleanOption) {
      return res.status(400).json({ success: false, message: 'Dropdown option name is required.' });
    }

    // Check if option already exists in current options
    const existingOptions = await getRemarkOptions();
    const alreadyExists = existingOptions.some(opt => opt.toLowerCase() === cleanOption.toLowerCase());

    if (alreadyExists) {
      return res.status(400).json({ success: false, message: `Option "${cleanOption}" already exists in dropdown list.` });
    }

    // Check if a pending request already exists for this option name
    const allRequests = await getListAddRequests();
    const existingPending = allRequests.find(r => 
      (r.optionValue || '').toLowerCase() === cleanOption.toLowerCase() && 
      r.status === 'Pending'
    );

    if (existingPending) {
      return res.status(400).json({ success: false, message: `A list add request is already pending for option "${cleanOption}".` });
    }

    const now = new Date();
    const reqDate = getFormattedDate(now);
    const reqTime = getFormattedTime(now);

    await createListAddRequest({
      optionValue: cleanOption,
      requestedBy: req.user.username,
      requestedDate: reqDate,
      requestedTime: reqTime,
      reason: (reason || '').toString().trim()
    });

    res.json({ success: true, message: `Request to add "${cleanOption}" to dropdown list sent successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Send list add request error: ' + err.message });
  }
});

// GET /api/list-add-requests/pending - List pending list add requests
router.get('/pending', requireDeleteRequestPermission, async (req, res) => {
  try {
    const allRequests = await getListAddRequests();
    const pendingRequests = allRequests.filter(r => r.status === 'Pending');

    res.json({ success: true, data: pendingRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch pending list add requests error: ' + err.message });
  }
});

// GET /api/list-add-requests/all - List ALL list add requests (Pending, Approved, Rejected)
router.get('/all', requireDeleteRequestPermission, async (req, res) => {
  try {
    const allRequests = await getListAddRequests();
    res.json({ success: true, data: allRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch all list add requests error: ' + err.message });
  }
});

// GET /api/list-add-requests/my-requests - List list add requests submitted by current user
router.get('/my-requests', async (req, res) => {
  try {
    const allRequests = await getListAddRequests();
    const userRequests = allRequests.filter(r => 
      String(r.requestedBy || '').toLowerCase() === String(req.user.username || '').toLowerCase()
    );

    res.json({ success: true, data: userRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch my list add requests error: ' + err.message });
  }
});

// POST /api/list-add-requests/:id/approve - Approve list add request and add option to dropdown list
router.post('/:id/approve', requireDeleteRequestPermission, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getListAddRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'List add request not found.' });
    }

    if (targetReq.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status.toLowerCase()}.` });
    }

    // Add option to remark options sheet
    if (targetReq.optionValue) {
      await addRemarkOption(targetReq.optionValue);
    }

    // Update request status to Approved
    await updateListAddRequestStatus(requestId, 'Approved', req.user.username);

    res.json({ success: true, message: `List add request approved. Option "${targetReq.optionValue}" added to dropdown list.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Approve list add request error: ' + err.message });
  }
});

// POST /api/list-add-requests/:id/reject - Reject list add request
router.post('/:id/reject', requireDeleteRequestPermission, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getListAddRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'List add request not found.' });
    }

    if (targetReq.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status.toLowerCase()}.` });
    }

    await updateListAddRequestStatus(requestId, 'Rejected', req.user.username);

    res.json({ success: true, message: `List add request for option "${targetReq.optionValue}" rejected.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Reject list add request error: ' + err.message });
  }
});

// DELETE /api/list-add-requests/:id/cancel - Cancel pending list add request by the user who sent it
router.delete('/:id/cancel', async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const allRequests = await getListAddRequests();
    const targetReq = allRequests.find(r => r.id === requestId || r.rowIndex === requestId);

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'List add request not found.' });
    }

    // Verify ownership
    if (String(targetReq.requestedBy).toLowerCase() !== String(req.user.username).toLowerCase() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'You can only cancel your own list add requests.' });
    }

    await deleteListAddRequest(requestId);

    res.json({ success: true, message: `List add request for option "${targetReq.optionValue}" canceled.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancel list add request error: ' + err.message });
  }
});

module.exports = router;
