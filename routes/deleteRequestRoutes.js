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
      return res.status(403).json({ success: false, message: 'Users with View permission cannot submit delete requests.' });
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
        message: `A delete request for PID ${targetRecord.pid} is already pending. Please wait for Admin approval.` 
      });
    }

    const existingPendingEdit = allEditRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && String(r.pid) === String(targetRecord.pid))) && 
      r.status === 'Pending'
    );
    if (existingPendingEdit) {
      return res.status(400).json({ 
        success: false, 
        message: `An edit request for PID ${targetRecord.pid} is already pending. Only 1 pending request is allowed per PID.` 
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

    res.json({ success: true, message: `Delete request for PID ${targetRecord.pid} submitted successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error submitting delete request: ' + err.message });
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
      return res.status(404).json({ success: false, message: 'Delete request not found.' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status}.` });
    }

    // Soft delete the record so it is hidden from active Data Records/Dashboard, but retained in database
    const records = await getRecords(true);
    let targetRecord = null;
    if (targetReq.pid) {
      targetRecord = records.find(r => r.pid && String(r.pid).trim() === String(targetReq.pid).trim());
    }
    if (!targetRecord && targetReq.recordId) {
      const recId = parseInt(targetReq.recordId, 10);
      targetRecord = records.find(r => 
        (r.id === recId || r.rowIndex === recId) && 
        (!targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
      );
    }
    if (!targetRecord && !isNaN(requestId)) {
      targetRecord = records.find(r => 
        (r.id === requestId || r.rowIndex === requestId) && 
        (!targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
      );
    }

    if (targetRecord) {
      await softDeleteRecord(targetRecord.id || targetRecord.rowIndex, req.user.username);
    }

    // Update request status to Approved
    await updateDeleteRequestStatus(targetReq.id || requestId, 'Approved', req.user.username);

    res.json({ 
      success: true, 
      message: `Delete request for PID ${targetReq.pid} approved. The record is safely archived in the deletion approval list.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error approving delete request: ' + err.message });
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
    let targetRecord = null;
    if (targetReq && targetReq.pid) {
      targetRecord = records.find(r => r.pid && String(r.pid).trim() === String(targetReq.pid).trim());
    }
    if (!targetRecord && targetReq && targetReq.recordId) {
      const recId = parseInt(targetReq.recordId, 10);
      targetRecord = records.find(r => 
        (r.id === recId || r.rowIndex === recId) && 
        (!targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
      );
    }
    if (!targetRecord && !isNaN(requestId)) {
      targetRecord = records.find(r => 
        (r.id === requestId || r.rowIndex === requestId) &&
        (!targetReq || !targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
      );
    }

    if (targetRecord) {
      await deleteRecord(targetRecord.id || targetRecord.rowIndex);
    }

    if (targetReq) {
      await deleteDeleteRequest(targetReq.id || targetReq.rowIndex);
    } else if (!isNaN(requestId)) {
      await deleteDeleteRequest(requestId).catch(() => {});
    }

    const displayPid = targetReq ? targetReq.pid : (targetRecord ? targetRecord.pid : rawId);
    res.json({ success: true, message: `Record PID ${displayPid} permanently deleted from the database.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error permanently deleting record: ' + err.message });
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
      return res.status(400).json({ success: false, message: 'No record IDs provided.' });
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

      let targetRecord = null;
      if (targetReq && targetReq.pid) {
        targetRecord = records.find(r => r.pid && String(r.pid).trim() === String(targetReq.pid).trim());
      }
      if (!targetRecord && targetReq && targetReq.recordId) {
        const recId = parseInt(targetReq.recordId, 10);
        targetRecord = records.find(r => 
          (r.id === recId || r.rowIndex === recId) && 
          (!targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
        );
      }
      if (!targetRecord && !isNaN(requestId)) {
        targetRecord = records.find(r => 
          (r.id === requestId || r.rowIndex === requestId) &&
          (!targetReq || !targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
        );
      }

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

    res.json({ success: true, message: `Selected ${deletedCount} record(s) permanently deleted from the database.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error in bulk permanent delete: ' + err.message });
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
    let targetRecord = null;
    if (targetReq && targetReq.pid) {
      targetRecord = records.find(r => r.pid && String(r.pid).trim() === String(targetReq.pid).trim());
    }
    if (!targetRecord && targetReq && targetReq.recordId) {
      const recId = parseInt(targetReq.recordId, 10);
      targetRecord = records.find(r => 
        (r.id === recId || r.rowIndex === recId) && 
        (!targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
      );
    }
    if (!targetRecord && !isNaN(requestId)) {
      targetRecord = records.find(r => 
        (r.id === requestId || r.rowIndex === requestId) &&
        (!targetReq || !targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
      );
    }

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
    res.json({ success: true, message: `Record PID ${displayPid} restored to active data successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error restoring record: ' + err.message });
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
      return res.status(400).json({ success: false, message: 'No record IDs provided.' });
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

      let targetRecord = null;
      if (targetReq && targetReq.pid) {
        targetRecord = records.find(r => r.pid && String(r.pid).trim() === String(targetReq.pid).trim());
      }
      if (!targetRecord && targetReq && targetReq.recordId) {
        const recId = parseInt(targetReq.recordId, 10);
        targetRecord = records.find(r => 
          (r.id === recId || r.rowIndex === recId) && 
          (!targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
        );
      }
      if (!targetRecord && !isNaN(requestId)) {
        targetRecord = records.find(r => 
          (r.id === requestId || r.rowIndex === requestId) &&
          (!targetReq || !targetReq.pid || String(r.pid).trim() === String(targetReq.pid).trim())
        );
      }

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

    res.json({ success: true, message: `Selected ${restoredCount} record(s) restored to active data successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error in bulk restore: ' + err.message });
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
      return res.status(404).json({ success: false, message: 'Delete request not found.' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${targetReq.status}.` });
    }

    await updateDeleteRequestStatus(targetReq.id || requestId, 'Rejected', req.user.username);

    res.json({ success: true, message: `Delete request for PID ${targetReq.pid} rejected.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error rejecting delete request: ' + err.message });
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
      return res.status(404).json({ success: false, message: 'Delete request not found.' });
    }

    // Verify ownership
    if (String(targetReq.requestedBy).toLowerCase() !== String(req.user.username).toLowerCase() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'You can only withdraw delete requests submitted by yourself.' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `Requests with status ${targetReq.status} cannot be withdrawn.` });
    }

    await deleteDeleteRequest(targetReq.id || requestId);

    res.json({ success: true, message: `Delete request for PID ${targetReq.pid} withdrawn successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error withdrawing request: ' + err.message });
  }
};
router.delete('/:id/cancel', handleWithdrawDelete);
router.post('/:id/cancel', handleWithdrawDelete);
router.delete('/:id', handleWithdrawDelete);

module.exports = router;
