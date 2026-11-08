/**
 * routes/editRequestRoutes.js - Edit Requests API routes
 */

const express = require('express');
const router = express.Router();
const { 
  getRecords, 
  updateRecord, 
  getEditRequests, 
  getDeleteRequests,
  createEditRequest, 
  updateEditRequestStatus, 
  deleteEditRequest,
  getRemarkOptions,
  getListAddRequests,
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
      return res.status(403).json({ success: false, message: 'View उपयोगकर्ता एडिट अनुरोध नहीं भेज सकते हैं।' });
    }

    const { recordId, proposedData, reason } = req.body;
    const targetRecordId = parseInt(recordId, 10);

    if (!proposedData || typeof proposedData !== 'object') {
      return res.status(400).json({ success: false, message: 'बदलाव के विवरण आवश्यक हैं।' });
    }

    const records = await getRecords();
    const targetRecord = records.find(r => r.id === targetRecordId || r.rowIndex === targetRecordId);

    if (!targetRecord) {
      return res.status(404).json({ success: false, message: 'लक्षित रिकॉर्ड नहीं मिला।' });
    }

    // Check if ANY pending request (Edit OR Delete) already exists for this record/PID
    const [allEditRequests, allDeleteRequests] = await Promise.all([
      getEditRequests(),
      getDeleteRequests()
    ]);

    const existingPendingEdit = allEditRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && String(r.pid) === String(targetRecord.pid))) && 
      r.status === 'Pending'
    );
    if (existingPendingEdit) {
      return res.status(400).json({ 
        success: false, 
        message: `इस PID (${targetRecord.pid}) का एडिट अनुरोध पहले से पेंडिंग है। कृपया एडमिन अप्रूवल का इंतजार करें।` 
      });
    }

    const existingPendingDelete = allDeleteRequests.find(r => 
      (parseInt(r.recordId, 10) === targetRecordId || (r.pid && String(r.pid) === String(targetRecord.pid))) && 
      r.status === 'Pending'
    );
    if (existingPendingDelete) {
      return res.status(400).json({ 
        success: false, 
        message: `इस PID (${targetRecord.pid}) का डिलीट अनुरोध पहले से पेंडिंग है। एक PID के लिए एक समय में सिर्फ 1 अनुरोध भेजा जा सकता है।` 
      });
    }

    const now = new Date();
    const reqDate = getFormattedDate(now);
    const reqTime = getFormattedTime(now);

    const propDate = normalizeToYMD(proposedData.date);
    if (propDate && propDate > reqDate) {
      return res.status(400).json({ success: false, message: 'अमान्य दिनांक। भविष्य की तारीख दर्ज नहीं की जा सकती। केवल आज या पिछली तारीख दर्ज करें।' });
    }

    const propRemark = (proposedData.remark || '').trim();
    const isDisabledRemark = await isAadharDisabledRemark(propRemark);
    let propAadhar = isDisabledRemark ? '' : (proposedData.aadharNo || '').trim();

    const sysSettings = await getSystemSettings();
    if (sysSettings.aadharMandatory && !isDisabledRemark) {
      if (!propAadhar || propAadhar === '' || propAadhar === '#N/A') {
        return res.status(400).json({ success: false, message: 'सिस्टम सेटिंग्स के अनुसार आधार नंबर अनिवार्य है।' });
      }
    }

    if (propAadhar && propAadhar !== '#N/A') {
      const cleanDigits = propAadhar.replace(/\D/g, '');
      if (cleanDigits.length < 12) {
        return res.status(400).json({ success: false, message: 'आधार नंबर में कम से कम 12 अंक होने चाहिए।' });
      }
      propAadhar = `${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4, 8)} ${cleanDigits.slice(8, 12)}`;
    } else if (!propAadhar && (!targetRecord.aadharNo || targetRecord.aadharNo === '#N/A')) {
      propAadhar = '#N/A';
    }

    // Auto-detect proposed recordType / prison type from proposed UT No
    const propUtNo = (proposedData.utNo !== undefined ? proposedData.utNo : targetRecord.utNo || '').trim().toUpperCase();
    let propType = targetRecord.type || targetRecord.recordType || 'UT';
    if (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(propUtNo)) {
      propType = 'CT';
    } else if (/\bUT\b|UT/i.test(propUtNo)) {
      propType = 'UT';
    }

    await createEditRequest({
      recordId: targetRecord.id || targetRecord.rowIndex,
      pid: targetRecord.pid,
      name: targetRecord.name,
      father: targetRecord.father || '',
      utNo: targetRecord.utNo || '',
      aadharNo: targetRecord.aadharNo || '',
      date: targetRecord.date || '',
      remark: targetRecord.remark || '',
      proposedData: {
        pid: targetRecord.pid,
        name: (proposedData.name || targetRecord.name).trim(),
        father: (proposedData.father !== undefined ? proposedData.father : targetRecord.father || '').trim(),
        utNo: propUtNo,
        type: propType,
        recordType: propType,
        aadharNo: propAadhar,
        date: (proposedData.date !== undefined && proposedData.date !== null && proposedData.date !== '') ? proposedData.date.trim() : (targetRecord.date || ''),
        remark: propRemark || targetRecord.remark || '',
        createdBy: targetRecord.createdBy,
        createdDate: targetRecord.createdDate,
        createdTime: targetRecord.createdTime
      },
      requestedBy: req.user.username,
      requestedDate: reqDate,
      requestedTime: reqTime,
      reason: (reason || '').toString().trim()
    });

    res.json({ success: true, message: `PID ${targetRecord.pid} के लिए एडिट अनुरोध सफलतापूर्वक भेज दिया गया!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'एडिट अनुरोध भेजने में त्रुटि: ' + err.message });
  }
});

// GET /api/edit-requests - List all edit requests (Root alias)
router.get('/', async (req, res) => {
  try {
    const allRequests = await getEditRequests();
    res.json({ success: true, data: allRequests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch edit requests error: ' + err.message });
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
const handleApproveEdit = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getEditRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId ||
      String(r.id) === String(rawId) ||
      String(r.pid) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'एडिट अनुरोध नहीं मिला।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `अनुरोध पहले से ही ${targetReq.status} है।` });
    }

    // Find target record and apply proposed updates
    const records = await getRecords();
    const targetRecord = records.find(r => 
      r.id === parseInt(targetReq.recordId, 10) || 
      r.rowIndex === parseInt(targetReq.recordId, 10) || 
      (r.pid && String(r.pid) === String(targetReq.pid))
    );

    if (!targetRecord) {
      return res.status(404).json({ success: false, message: 'अपडेट करने के लिए लक्षित रिकॉर्ड नहीं मिला।' });
    }

    const now = new Date();
    const updatedDate = getFormattedDate(now);
    const updatedTime = getFormattedTime(now);

    const proposed = targetReq.proposedData || {};
    const updatedUtNo = (proposed.utNo !== undefined ? proposed.utNo : targetRecord.utNo || '').trim();

    // Determine type/prison type automatically based on proposed UT No
    let finalType = proposed.type || proposed.recordType;
    if (!finalType || /\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(updatedUtNo) || /\bUT\b|UT/i.test(updatedUtNo)) {
      if (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(updatedUtNo)) {
        finalType = 'CT';
      } else if (/\bUT\b|UT/i.test(updatedUtNo)) {
        finalType = 'UT';
      } else {
        finalType = targetRecord.type || targetRecord.recordType || 'UT';
      }
    }

    const updatedObj = {
      pid: targetRecord.pid,
      name: proposed.name || targetRecord.name,
      father: proposed.father !== undefined ? proposed.father : targetRecord.father,
      utNo: updatedUtNo,
      type: finalType,
      recordType: finalType,
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
    await updateEditRequestStatus(targetReq.id || requestId, 'Approved', req.user.username);

    res.json({ success: true, message: `एडिट अनुरोध स्वीकृत। रिकॉर्ड PID ${targetReq.pid} सफलतापूर्वक अपडेट हो गया!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'एडिट अनुरोध स्वीकृत करने में त्रुटि: ' + err.message });
  }
};
router.post('/:id/approve', requireDeleteRequestPermission, handleApproveEdit);
router.put('/:id/approve', requireDeleteRequestPermission, handleApproveEdit);

// POST /api/edit-requests/:id/reject - Reject edit request
const handleRejectEdit = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getEditRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId ||
      String(r.id) === String(rawId) ||
      String(r.pid) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'एडिट अनुरोध नहीं मिला।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `अनुरोध पहले से ही ${targetReq.status} है।` });
    }

    await updateEditRequestStatus(targetReq.id || requestId, 'Rejected', req.user.username);

    res.json({ success: true, message: `PID ${targetReq.pid} के लिए एडिट अनुरोध अस्वीकृत (Reject) कर दिया गया।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'एडिट अनुरोध अस्वीकृत करने में त्रुटि: ' + err.message });
  }
};
router.post('/:id/reject', requireDeleteRequestPermission, handleRejectEdit);
router.put('/:id/reject', requireDeleteRequestPermission, handleRejectEdit);

// Cancel / Withdraw pending edit request by the user who sent it
const handleWithdrawEdit = async (req, res) => {
  try {
    const rawId = req.params.id;
    const requestId = parseInt(rawId, 10);
    const allRequests = await getEditRequests();
    const targetReq = allRequests.find(r => 
      r.id === requestId || 
      r.rowIndex === requestId ||
      String(r.id) === String(rawId) ||
      String(r.pid) === String(rawId)
    );

    if (!targetReq) {
      return res.status(404).json({ success: false, message: 'एडिट अनुरोध नहीं मिला।' });
    }

    // Verify ownership
    if (String(targetReq.requestedBy).toLowerCase() !== String(req.user.username).toLowerCase() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'आप केवल अपने द्वारा भेजे गए एडिट अनुरोध को ही वापस (Withdraw) ले सकते हैं।' });
    }

    if (String(targetReq.status || '').toLowerCase() !== 'pending') {
      return res.status(400).json({ success: false, message: `जो अनुरोध पहले से ${targetReq.status} हो चुका है, उसे वापस नहीं लिया जा सकता।` });
    }

    await deleteEditRequest(targetReq.id || requestId);

    res.json({ success: true, message: `PID ${targetReq.pid} के लिए भेजा गया एडिट अनुरोध सफलतापूर्वक वापस (Withdraw) ले लिया गया है।` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'अनुरोध वापस लेने में त्रुटि: ' + err.message });
  }
};
router.delete('/:id/cancel', handleWithdrawEdit);
router.post('/:id/cancel', handleWithdrawEdit);
router.delete('/:id', handleWithdrawEdit);

module.exports = router;
