/**
 * client/src/components/modals/AddRecordModal.jsx
 * Add Record Modal with Single-Click Protection & Dynamic Remark Options
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AddRecordModal({ isOpen, onClose, onRecordAdded }) {
  const { showToast } = useAuth();
  const submittingLockRef = useRef(false);
  const [remarkOptions, setRemarkOptions] = useState([]);
  const [pid, setPid] = useState('');
  const [name, setName] = useState('');
  const [father, setFather] = useState('');
  const [utNo, setUtNo] = useState('');
  const [recordType, setRecordType] = useState('');
  const [aadharNo, setAadharNo] = useState('');
  const [date, setDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAadharDisabled, setIsAadharDisabled] = useState(false);
  const [pidCheck, setPidCheck] = useState({ checking: false, exists: null, message: '', record: null });

  // Fetch dynamic remark options
  useEffect(() => {
    if (!isOpen) return;
    api.get('/api/records/remark-options')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setRemarkOptions(res.data);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Debounced PID live existence check (1-1.5 seconds)
  useEffect(() => {
    const trimmedPid = pid.trim();
    if (!trimmedPid) {
      setPidCheck({ checking: false, exists: null, message: '', record: null });
      return;
    }

    setPidCheck(prev => ({ ...prev, checking: true }));

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/records/check-pid/${encodeURIComponent(trimmedPid)}`);
        if (res && res.exists) {
          const r = res.existingRecord || {};
          const details = [r.name, r.utNo ? `UT: ${r.utNo}` : ''].filter(Boolean).join(' | ');
          setPidCheck({
            checking: false,
            exists: true,
            message: `PID already exists! ${details ? `(${details})` : ''}`,
            record: r
          });
        } else {
          setPidCheck({
            checking: false,
            exists: false,
            message: 'PID is available',
            record: null
          });
        }
      } catch (err) {
        setPidCheck({ checking: false, exists: null, message: '', record: null });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [pid]);

  // Handle Remark selection to auto-disable Aadhar if configured
  const handleRemarkChange = (val) => {
    setRemark(val);
    const matched = remarkOptions.find(opt => (opt.optionValue || opt).toLowerCase() === val.toLowerCase());
    if (matched && matched.disableAadhar) {
      setIsAadharDisabled(true);
      setAadharNo('#N/A');
    } else {
      setIsAadharDisabled(false);
      if (aadharNo === '#N/A') setAadharNo('');
    }
  };

  // Auto-detect UT vs CT based on UT No
  const handleUtNoChange = (val) => {
    setUtNo(val);
    if (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(val)) {
      setRecordType('CT');
    } else if (/\bUT\b|UT/i.test(val)) {
      setRecordType('UT');
    }
  };

  // Format Aadhar No into 12 digits or XXXX XXXX XXXX
  const handleAadharChange = (val) => {
    if (isAadharDisabled) return;
    const clean = val.replace(/\D/g, '').slice(0, 12);
    if (clean.length > 8) {
      setAadharNo(clean.replace(/^(\d{4})(\d{4})(\d{0,4})/, '$1 $2 $3').trim());
    } else if (clean.length > 4) {
      setAadharNo(clean.replace(/^(\d{4})(\d{0,4})/, '$1 $2').trim());
    } else {
      setAadharNo(clean);
    }
  };

  const resetForm = () => {
    setPid('');
    setName('');
    setFather('');
    setUtNo('');
    setRecordType('');
    setAadharNo('');
    setDate(new Date().toISOString().slice(0, 10));
    setRemark('');
    setIsAadharDisabled(false);
    setPidCheck({ checking: false, exists: null, message: '', record: null });
    submittingLockRef.current = false;
    setIsSubmitting(false);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    // Synchronous immediate lock check to prevent rapid double-clicks
    if (submittingLockRef.current || isSubmitting) return;

    if (!pid.trim()) {
      showToast('PID is required.', 'warning');
      return;
    }
    if (!name.trim()) {
      showToast('Name is required.', 'warning');
      return;
    }

    submittingLockRef.current = true;
    setIsSubmitting(true);

    try {
      // Check PID duplicate first
      const checkRes = await api.get(`/api/records/check-pid/${encodeURIComponent(pid.trim())}`);
      if (checkRes.exists) {
        showToast(`Record with PID "${pid.trim()}" already exists!`, 'danger');
        submittingLockRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const res = await api.post('/api/records', {
        pid: pid.trim(),
        name: name.trim().toUpperCase(),
        father: father.trim().toUpperCase(),
        utNo: utNo.trim().toUpperCase(),
        type: recordType || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(utNo) ? 'CT' : 'UT'),
        recordType: recordType || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(utNo) ? 'CT' : 'UT'),
        aadharNo: aadharNo.trim(),
        date: date,
        remark: remark.trim()
      });

      if (res && res.success) {
        showToast(res.message || 'Record added successfully!', 'success');
        resetForm();
        onClose();
        if (onRecordAdded) onRecordAdded(res.data);
      } else {
        showToast(res.message || 'Failed to add record.', 'danger');
        submittingLockRef.current = false;
        setIsSubmitting(false);
      }
    } catch (err) {
      showToast(err.message || 'Error saving record.', 'danger');
      submittingLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-plus-circle-fill text-cyan"></i> Add New Data Record
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={isSubmitting}></button>
          </div>
          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
            <div className="modal-body p-4">
              <div className="row g-3">
                {/* PID with Debounced Realtime Availability Check */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">
                    PID <span className="text-danger">*</span>
                  </label>
                  <div className="position-relative">
                    <input
                      type="text"
                      className={`form-control ${pidCheck.exists === true ? 'is-invalid border-danger' : pidCheck.exists === false ? 'is-valid border-success' : ''}`}
                      placeholder="PID (e.g. 1001)"
                      value={pid}
                      onChange={(e) => setPid(e.target.value)}
                      required
                      disabled={isSubmitting}
                      autoFocus
                    />
                    {pidCheck.checking && (
                      <span className="position-absolute end-0 top-50 translate-middle-y me-3 spinner-border spinner-border-sm text-cyan" role="status"></span>
                    )}
                  </div>
                  {pidCheck.checking && (
                    <small className="text-info d-flex align-items-center gap-1 mt-1">
                      <span className="spinner-border spinner-border-sm" style={{ width: '12px', height: '12px' }}></span>
                      Checking PID availability...
                    </small>
                  )}
                  {!pidCheck.checking && pidCheck.exists === true && (
                    <div className="text-danger small mt-1 fw-bold d-flex align-items-center gap-1">
                      <i className="bi bi-exclamation-triangle-fill"></i> {pidCheck.message}
                    </div>
                  )}
                  {!pidCheck.checking && pidCheck.exists === false && (
                    <div className="text-success small mt-1 fw-semibold d-flex align-items-center gap-1">
                      <i className="bi bi-check-circle-fill"></i> {pidCheck.message}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {/* Father's Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Father's Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Father's Name"
                    value={father}
                    onChange={(e) => setFather(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* UT No. and Type */}
                <div className="col-12 col-md-6">
                  <div className="row g-2">
                    <div className="col-8">
                      <label className="form-label small fw-semibold">UT No.</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="UT Number"
                        value={utNo}
                        onChange={(e) => handleUtNoChange(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small fw-semibold">Type</label>
                      <select
                        className="form-select"
                        value={recordType}
                        onChange={(e) => setRecordType(e.target.value)}
                        disabled={isSubmitting}
                      >
                        <option value="">Select</option>
                        <option value="UT">UT</option>
                        <option value="CT">CT</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Aadhar No. */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">
                    Aadhar No. <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="12 digit Aadhar number"
                    value={aadharNo}
                    onChange={(e) => handleAadharChange(e.target.value)}
                    disabled={isAadharDisabled || isSubmitting}
                    required={!isAadharDisabled}
                  />
                </div>

                {/* Date */}
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Remark Dropdown */}
                <div className="col-12">
                  <label className="form-label small fw-semibold">
                    Remark <span className="text-muted">(Select from List)</span>
                  </label>
                  <select
                    className="form-select custom-modern-dropdown"
                    value={remark}
                    onChange={(e) => handleRemarkChange(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">-- Select Remark --</option>
                    {remarkOptions.map((opt, idx) => {
                      const val = typeof opt === 'object' ? opt.optionValue : opt;
                      return (
                        <option key={idx} value={val}>
                          {val}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-3">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                id="modal-record-save-btn"
                className="btn btn-primary btn-sm px-4 fw-semibold shadow-sm"
                disabled={isSubmitting}
                title="Keyboard shortcut: Ctrl + Enter"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle me-1"></i> Save Record <small className="opacity-75 ms-1 fw-normal">(Ctrl+Enter)</small>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

