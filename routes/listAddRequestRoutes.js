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
  getRemarkOptions,
  getRecords,
  getIsConnected
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

// POST /api/list-add-requests - Send Request to Add New Dropdown Option
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'View') {
      return res.status(403).json({ success: false, message: 'View उपयोगकर्ता लिस्ट ऐड अनुरोध नहीं भेज सकते हैं।' });
    }

    const { optionValue, reason, disableAadhar } = req.body;
    const cleanOption = (optionValue || '').toString().trim();

    if (!cleanOption) {
      return res.status(400).json({ success: false, message: 'ड्रॉपडाउन विकल्प का नाम आवश्यक है।' });
    }

    // Check if option already exists in current options
    const existingOptions = await getRemarkOptions();
    const alreadyExists = existingOptions.some(opt => {
      const val = typeof opt === 'object' && opt !== null ? (opt.optionValue || '') : String(opt || '');
      return val.trim().toLowerCase() === cleanOption.toLowerCase();
    });

    if (alreadyExists) {
      return res.status(400).json({ success: false, message: `विकल्प "${cleanOption}" पहले से ही ड्रॉपडाउन सूची में मौजूद है।` });
    }

    // Check if a pending request already exists for this option name
    const allRequests = await getListAddRequests();
    const existingPending = allRequests.find(r => 
      (r.optionValue || '').toLowerCase() === cleanOption.toLowerCase() && 
      r.status === 'Pending'
    );

    if (existingPending) {
      return res.status(400).json({ success: false, message: `विकल्प "${cleanOption}" के लिए अनुरोध पहले से पेंडिंग है।` });
    }

    const now = new Date();
    const reqDate = getFormattedDate(now);
    const reqTime = getFormattedTime(now);

    await createListAddRequest({
      optionValue: cleanOption,
      requestedBy: req.user.username,
      requestedDate: reqDate,
      requestedTime: reqTime,
      createdAt: now.getTime(),
      reason: (reason || '').toString().trim(),
      disableAadhar: !!disableAadhar
    });

    res.json({ success: true, message: `विकल्प "${cleanOption}" को ड्रॉपडाउन में जोड़ने का अनुरोध सफलतापूर्वक भेज दिया गया!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अनुरोध भेजने में त्रुटि: ' + err.message });
  }
});

// GET /api/list-add-requests/reactive - List all reactive / unapproved list add requests AND affected records
router.get('/reactive', async (req, res) => {
  try {
    const [allRequests, allRecords] = await Promise.all([
      getListAddRequests(),
      getRecords()
    ]);

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    // Get permanent approved remark options
    let permanentOptions = [];
    if (!getIsConnected()) {
      try {
        const { dbAll } = require('../config/database');
        const rows = await dbAll('SELECT option_value FROM remark_options ORDER BY id ASC');
        if (rows && rows.length > 0) {
          permanentOptions = rows.map(r => r.option_value).filter(Boolean);
        }
      } catch (e) {}
    } else {
      try {
        permanentOptions = await getRemarkOptions();
      } catch (e) {}
    }
    if (!permanentOptions || permanentOptions.length === 0) {
      permanentOptions = ['Not Available', 'Already Linked but other Prisoner', 'Biometric Block', 'Biometric data not match', 'Aadhar Suspended', 'Other'];
    }

    const permSet = new Set(permanentOptions.map(opt => {
      const val = typeof opt === 'object' && opt !== null ? (opt.optionValue || '') : String(opt || '');
      return val.trim().toLowerCase();
    }));

    // Filter requests that are Pending for Dropdown Option Requests list
    const pendingRequests = allRequests.filter(r => String(r.status || '').toLowerCase() === 'pending');

    const allRequestsMap = new Map();
    allRequests.forEach(r => {
      if (r.optionValue) {
        allRequestsMap.set(r.optionValue.trim().toLowerCase(), r);
      }
    });

    const formattedRequests = pendingRequests.map(r => {
      let reqMs = r.createdAt;
      if (!reqMs && r.requestedDate) {
        try {
          reqMs = new Date(`${r.requestedDate}T${r.requestedTime || '00:00:00'}`).getTime();
        } catch (e) {}
      }
      reqMs = reqMs || now;
      const elapsed = now - reqMs;
      const isTempActive = elapsed <= TWENTY_FOUR_HOURS_MS && r.status === 'Pending';
      const hoursLeft = Math.max(0, Math.ceil((TWENTY_FOUR_HOURS_MS - elapsed) / (1000 * 60 * 60)));

      return {
        ...r,
        isTempActive,
        hoursLeft,
        tempStatusLabel: isTempActive ? `Temp Active (${hoursLeft}h left)` : 'Temp Expired (Pending Approval)'
      };
    });

    // Find all data records whose remark is NOT a permanent approved option
    const affectedRecords = [];
    allRecords.forEach(rec => {
      const recRemark = (rec.remark || '').trim();
      if (recRemark && !permSet.has(recRemark.toLowerCase())) {
        const matchingReq = allRequestsMap.get(recRemark.toLowerCase());
        affectedRecords.push({
          id: rec.id || rec.rowIndex,
          pid: rec.pid,
          name: rec.name,
          father: rec.father || '-',
          utNo: rec.utNo || rec.ut_no || '-',
          date: rec.date || '-',
          remark: rec.remark,
          unapprovedOption: matchingReq ? matchingReq.optionValue : rec.remark,
          requestedBy: matchingReq ? matchingReq.requestedBy : (rec.createdBy || '-'),
          optionStatus: matchingReq ? matchingReq.status : 'Pending Approval'
        });
      }
    });

    res.json({
      success: true,
      data: formattedRequests,
      requests: formattedRequests,
      affectedRecords: affectedRecords
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch reactive list error: ' + err.message });
  }
});

// GET /api/list-add-requests - List all list add requests (Root alias)
router.get('/', async (req, res) => {
  try {
    const allRequests = await getListAddRequests();
    res.json({ success: true, data: allRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch list-add requests error: ' + err.message });
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

// Approve list add request (Supports both POST and PUT)
const handleApproveListAdd = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const { disableAadhar } = req.body;
    const allRequests = await getListAddRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId ||
      String(r.id) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'लिस्ट ऐड अनुरोध नहीं मिला।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `अनुरोध पहले से ही ${targetReq.status} है।` });
    }

    const shouldDisableAadhar = disableAadhar !== undefined ? !!disableAadhar : !!targetReq.disableAadhar;

    // Add option to remark options sheet
    if (targetReq.optionValue) {
      await addRemarkOption(targetReq.optionValue, shouldDisableAadhar);
    }

    // Update request status to Approved
    await updateListAddRequestStatus(targetReq.id || requestId, 'Approved', req.user.username);

    res.json({
      success: true,
      message: `लिस्ट ऐड अनुरोध स्वीकृत किया गया। विकल्प "${targetReq.optionValue}" सफलतापूर्वक जोड़ दिया गया!`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'लिस्ट ऐड अनुरोध स्वीकृत करने में त्रुटि: ' + err.message });
  }
};
router.post('/:id/approve', requireDeleteRequestPermission, handleApproveListAdd);
router.put('/:id/approve', requireDeleteRequestPermission, handleApproveListAdd);

// Reject list add request (Supports both POST and PUT)
const handleRejectListAdd = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getListAddRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId ||
      String(r.id) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'लिस्ट ऐड अनुरोध नहीं मिला।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `अनुरोध पहले से ही ${targetReq.status} है।` });
    }

    await updateListAddRequestStatus(targetReq.id || requestId, 'Rejected', req.user.username);

    res.json({ success: true, message: `विकल्प "${targetReq.optionValue}" के लिए अनुरोध अस्वीकृत (Reject) कर दिया गया।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अनुरोध अस्वीकृत करने में त्रुटि: ' + err.message });
  }
};
router.post('/:id/reject', requireDeleteRequestPermission, handleRejectListAdd);
router.put('/:id/reject', requireDeleteRequestPermission, handleRejectListAdd);

// Cancel / Withdraw pending list add request by the user who sent it
const handleWithdrawListAdd = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getListAddRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId ||
      String(r.id) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'लिस्ट ऐड अनुरोध नहीं मिला।' });
    }

    // Verify ownership
    if (String(targetReq.requestedBy).toLowerCase() !== String(req.user.username).toLowerCase() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'आप केवल अपने द्वारा भेजे गए अनुरोध को ही वापस ले सकते हैं।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `जो अनुरोध पहले से ${targetReq.status} हो चुका है, उसे वापस नहीं लिया जा सकता।` });
    }

    await deleteListAddRequest(targetReq.id || requestId);

    res.json({ success: true, message: `विकल्प "${targetReq.optionValue}" का अनुरोध सफलतापूर्वक वापस (Withdraw) ले लिया गया है।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अनुरोध वापस लेने में त्रुटि: ' + err.message });
  }
};
router.delete('/:id/cancel', handleWithdrawListAdd);
router.post('/:id/cancel', handleWithdrawListAdd);
router.delete('/:id', handleWithdrawListAdd);

module.exports = router;
