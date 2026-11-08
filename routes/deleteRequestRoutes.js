/**
 * routes/deleteRequestRoutes.js - Delete Requests API routes
 */

const express = require('express');
const router = express.Router();
const { 
  getRecords, 
  addRecord,
  deleteRecord, 
  softDeleteRecord,
  restoreRecord,
  getDeleteRequests, 
  getEditRequests,
  createDeleteRequest, 
  updateDeleteRequestStatus, 
  deleteDeleteRequest 
} = require('../config/cloudflareStorage');
const { requireAuth, requireDeleteRequestPermission, requireAdmin } = require('../middleware/auth');

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
      return res.status(403).json({ success: false, message: 'View उपयोगकर्ता डिलीट अनुरोध नहीं भेज सकते हैं।' });
    }

    const { recordId, reason } = req.body;
    const targetRecordId = parseInt(recordId, 10);

    const records = await getRecords();
    const targetRecord = records.find(r => r.id === targetRecordId || r.rowIndex === targetRecordId);

    if (!targetRecord) {
      return res.status(404).json({ success: false, message: 'लक्षित रिकॉर्ड नहीं मिला।' });
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
        message: `इस PID (${targetRecord.pid}) का डिलीट अनुरोध पहले से पेंडिंग है। कृपया एडमिन अप्रूवल का इंतजार करें।` 
      });
    }

    const existingPendingEdit = allEditRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && String(r.pid) === String(targetRecord.pid))) && 
      r.status === 'Pending'
    );
    if (existingPendingEdit) {
      return res.status(400).json({ 
        success: false, 
        message: `इस PID (${targetRecord.pid}) का एडिट अनुरोध पहले से पेंडिंग है। एक PID के लिए एक समय में सिर्फ 1 अनुरोध भेजा जा सकता है।` 
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

    res.json({ success: true, message: `PID ${targetRecord.pid} के लिए डिलीट अनुरोध सफलतापूर्वक भेज दिया गया!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'डिलीट अनुरोध भेजने में त्रुटि: ' + err.message });
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
// Soft-deletes record from active view and sets status to Approved (keeps record for admin permanent deletion later)
// Approve delete request (Supports both POST and PUT)
// Soft-deletes record from active view and sets status to Approved (keeps record for admin permanent deletion later)
const handleApproveDelete = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId || 
      String(r.id) === String(rawId) ||
      String(r.pid) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'डिलीट अनुरोध नहीं मिला।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `अनुरोध पहले से ही ${targetReq.status} है।` });
    }

    // Soft delete the record so it is hidden from active Data Records/Dashboard, but retained in database
    const records = await getRecords(true);
    const targetRecord = records.find(r => 
      r.id === parseInt(targetReq.recordId, 10) || 
      r.rowIndex === parseInt(targetReq.recordId, 10) || 
      (r.pid && String(r.pid) === String(targetReq.pid))
    );

    if (targetRecord) {
      await softDeleteRecord(targetRecord.id || targetRecord.rowIndex, req.user.username);
    }

    // Update request status to Approved
    await updateDeleteRequestStatus(targetReq.id || requestId, 'Approved', req.user.username);

    res.json({ 
      success: true, 
      message: `PID ${targetReq.pid} के लिए डिलीट अनुरोध स्वीकृत किया गया। रिकॉर्ड अप्रूव्ड लिस्ट में सुरक्षित है (एडमिन इसे बाद में स्थायी डिलीट या रीस्टोर कर सकते हैं)।` 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'डिलीट अनुरोध स्वीकृत करने में त्रुटि: ' + err.message });
  }
};
router.post('/:id/approve', requireDeleteRequestPermission, handleApproveDelete);
router.put('/:id/approve', requireDeleteRequestPermission, handleApproveDelete);

// Single Permanent Delete (Admin Only) - Supports DELETE, POST, PUT
const handlePermanentDeleteSingle = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId || 
      String(r.id) === String(rawId) || 
      String(r.pid) === String(rawId) ||
      String(r.recordId) === String(rawId)
    );

    const records = await getRecords(true);
    const targetRecord = records.find(r => 
      (targetReq && (
        r.id === parseInt(targetReq.recordId, 10) || 
        r.rowIndex === parseInt(targetReq.recordId, 10) || 
        (r.pid && String(r.pid) === String(targetReq.pid))
      )) ||
      r.id === requestId || 
      r.rowIndex === requestId || 
      String(r.pid) === String(rawId)
    );

    if (targetRecord) {
      await deleteRecord(targetRecord.id || targetRecord.rowIndex);
    }

    if (targetReq) {
      await deleteDeleteRequest(targetReq.id || targetReq.rowIndex);
    } else if (!isNaN(requestId)) {
      await deleteDeleteRequest(requestId).catch(() => {});
    }

    const displayPid = targetReq ? targetReq.pid : (targetRecord ? targetRecord.pid : rawId);
    res.json({ success: true, message: `रिकॉर्ड PID ${displayPid} डेटाबेस से हमेशा के लिए सफलतापूर्वक डिलीट कर दिया गया है।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'रिकॉर्ड स्थायी रूप से डिलीट करने में त्रुटि: ' + err.message });
  }
};
router.delete('/:id/permanent', requireAdmin, handlePermanentDeleteSingle);
router.post('/:id/permanent', requireAdmin, handlePermanentDeleteSingle);
router.put('/:id/permanent', requireAdmin, handlePermanentDeleteSingle);

// Bulk Permanent Delete (Admin Only) - Supports POST, DELETE, PUT
const handleBulkPermanentDelete = async (req, res) => {
  try {
    let ids = req.body.ids || req.body.requestIds || req.query.ids;
    if (typeof ids === 'string') {
      try { ids = JSON.parse(ids); } catch (e) { ids = ids.split(',').map(s => s.trim()); }
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'कोई रिकॉर्ड आईडी प्रदान नहीं की गई।' });
    }

    const allRequests = await getDeleteRequests();
    const records = await getRecords(true);
    let deletedCount = 0;

    for (const idStr of ids) {
      const requestId = parseInt(idStr, 10);
      const targetReq = allRequests.find(r => 
        r.id === requestId || 
        r.rowIndex === requestId || 
        String(r.id) === String(idStr) ||
        String(r.pid) === String(idStr) ||
        String(r.recordId) === String(idStr)
      );

      const targetRecord = records.find(r => 
        (targetReq && (
          r.id === parseInt(targetReq.recordId, 10) || 
          r.rowIndex === parseInt(targetReq.recordId, 10) || 
          (r.pid && String(r.pid) === String(targetReq.pid))
        )) ||
        r.id === requestId || 
        r.rowIndex === requestId || 
        String(r.pid) === String(idStr)
      );

      if (targetRecord) {
        await deleteRecord(targetRecord.id || targetRecord.rowIndex);
      }
      if (targetReq) {
        await deleteDeleteRequest(targetReq.id || targetReq.rowIndex);
      } else if (!isNaN(requestId)) {
        await deleteDeleteRequest(requestId).catch(() => {});
      }
      deletedCount++;
    }

    res.json({ success: true, message: `चयनित ${deletedCount} रिकॉर्ड डेटाबेस से हमेशा के लिए सफलतापूर्वक डिलीट कर दिए गए हैं।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'बल्क डिलीट में त्रुटि: ' + err.message });
  }
};
router.post('/bulk-permanent', requireAdmin, handleBulkPermanentDelete);
router.delete('/bulk-permanent', requireAdmin, handleBulkPermanentDelete);
router.put('/bulk-permanent', requireAdmin, handleBulkPermanentDelete);

// Single Restore back to active records (Admin Only) - Supports POST, PUT, GET
const handleRestoreSingle = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId || 
      String(r.id) === String(rawId) ||
      String(r.pid) === String(rawId) ||
      String(r.recordId) === String(rawId)
    );

    const records = await getRecords(true);
    const targetRecord = records.find(r => 
      (targetReq && (
        r.id === parseInt(targetReq.recordId, 10) || 
        r.rowIndex === parseInt(targetReq.recordId, 10) || 
        (r.pid && String(r.pid) === String(targetReq.pid))
      )) ||
      r.id === requestId || 
      r.rowIndex === requestId || 
      String(r.pid) === String(rawId)
    );

    if (targetRecord) {
      await restoreRecord(targetRecord.id || targetRecord.rowIndex);
    } else if (targetReq) {
      // Re-add to main data records if it was previously hard deleted
      await addRecord({
        pid: targetReq.pid,
        name: targetReq.name,
        father: targetReq.father || '',
        utNo: targetReq.utNo || '',
        aadharNo: targetReq.aadharNo || '#N/A',
        date: targetReq.date || getFormattedDate(),
        remark: targetReq.remark || 'Restored',
        createdBy: targetReq.requestedBy || req.user.username,
        createdDate: getFormattedDate(),
        createdTime: getFormattedTime()
      });
    }

    if (targetReq) {
      await deleteDeleteRequest(targetReq.id || targetReq.rowIndex);
    } else if (!isNaN(requestId)) {
      await deleteDeleteRequest(requestId).catch(() => {});
    }

    const displayPid = targetReq ? targetReq.pid : (targetRecord ? targetRecord.pid : rawId);
    res.json({ success: true, message: `रिकॉर्ड PID ${displayPid} मुख्य सक्रिय डेटा में सफलतापूर्वक रीस्टोर कर दिया गया है।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'रिकॉर्ड रीस्टोर करने में त्रुटि: ' + err.message });
  }
};
router.post('/:id/restore', requireAdmin, handleRestoreSingle);
router.put('/:id/restore', requireAdmin, handleRestoreSingle);
router.get('/:id/restore', requireAdmin, handleRestoreSingle);

// Bulk Restore back to active records (Admin Only) - Supports POST, PUT
const handleBulkRestore = async (req, res) => {
  try {
    let ids = req.body.ids || req.body.requestIds || req.query.ids;
    if (typeof ids === 'string') {
      try { ids = JSON.parse(ids); } catch (e) { ids = ids.split(',').map(s => s.trim()); }
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'कोई रिकॉर्ड आईडी प्रदान नहीं की गई।' });
    }

    const allRequests = await getDeleteRequests();
    const records = await getRecords(true);
    let restoredCount = 0;

    for (const idStr of ids) {
      const requestId = parseInt(idStr, 10);
      const targetReq = allRequests.find(r => 
        r.id === requestId || 
        r.rowIndex === requestId || 
        String(r.id) === String(idStr) ||
        String(r.pid) === String(idStr) ||
        String(r.recordId) === String(idStr)
      );

      const targetRecord = records.find(r => 
        (targetReq && (
          r.id === parseInt(targetReq.recordId, 10) || 
          r.rowIndex === parseInt(targetReq.recordId, 10) || 
          (r.pid && String(r.pid) === String(targetReq.pid))
        )) ||
        r.id === requestId || 
        r.rowIndex === requestId || 
        String(r.pid) === String(idStr)
      );

      if (targetRecord) {
        await restoreRecord(targetRecord.id || targetRecord.rowIndex);
      } else if (targetReq) {
        await addRecord({
          pid: targetReq.pid,
          name: targetReq.name,
          father: targetReq.father || '',
          utNo: targetReq.utNo || '',
          aadharNo: targetReq.aadharNo || '#N/A',
          date: targetReq.date || getFormattedDate(),
          remark: targetReq.remark || 'Restored',
          createdBy: targetReq.requestedBy || req.user.username,
          createdDate: getFormattedDate(),
          createdTime: getFormattedTime()
        });
      }

      if (targetReq) {
        await deleteDeleteRequest(targetReq.id || targetReq.rowIndex);
      } else if (!isNaN(requestId)) {
        await deleteDeleteRequest(requestId).catch(() => {});
      }
      restoredCount++;
    }

    res.json({ success: true, message: `चयनित ${restoredCount} रिकॉर्ड मुख्य सक्रिय डेटा में सफलतापूर्वक रीस्टोर कर दिए गए हैं।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'बल्क रीस्टोर में त्रुटि: ' + err.message });
  }
};
router.post('/bulk-restore', requireAdmin, handleBulkRestore);
router.put('/bulk-restore', requireAdmin, handleBulkRestore);

// Reject delete request by admin/permitted user (Supports both POST and PUT)
const handleRejectDelete = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId || 
      String(r.id) === String(rawId) ||
      String(r.pid) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'डिलीट अनुरोध नहीं मिला।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `अनुरोध पहले से ही ${targetReq.status} है।` });
    }

    await updateDeleteRequestStatus(targetReq.id || requestId, 'Rejected', req.user.username);

    res.json({ success: true, message: `PID ${targetReq.pid} के लिए डिलीट अनुरोध अस्वीकृत (Reject) कर दिया गया।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'डिलीट अनुरोध अस्वीकृत करने में त्रुटि: ' + err.message });
  }
};
router.post('/:id/reject', requireDeleteRequestPermission, handleRejectDelete);
router.put('/:id/reject', requireDeleteRequestPermission, handleRejectDelete);

// Cancel / Withdraw pending delete request by the user who sent it
const handleWithdrawDelete = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getDeleteRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId || 
      String(r.id) === String(rawId) ||
      String(r.pid) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'डिलीट अनुरोध नहीं मिला।' });
    }

    // Verify ownership
    if (String(targetReq.requestedBy).toLowerCase() !== String(req.user.username).toLowerCase() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'आप केवल अपने द्वारा भेजे गए डिलीट अनुरोध को ही वापस (Withdraw) ले सकते हैं।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `जो अनुरोध पहले से ${targetReq.status} हो चुका है, उसे वापस नहीं लिया जा सकता।` });
    }

    await deleteDeleteRequest(targetReq.id || requestId);

    res.json({ success: true, message: `PID ${targetReq.pid} के लिए भेजा गया डिलीट अनुरोध सफलतापूर्वक वापस (Withdraw) ले लिया गया है।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अनुरोध वापस लेने में त्रुटि: ' + err.message });
  }
};
router.delete('/:id/cancel', handleWithdrawDelete);
router.post('/:id/cancel', handleWithdrawDelete);
router.delete('/:id', handleWithdrawDelete);

module.exports = router;
