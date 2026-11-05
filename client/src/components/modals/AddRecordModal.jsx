/**
 * client/src/components/modals/AddRecordModal.jsx
 * Add Record Modal with Single-Click Protection & Dynamic Remark Options
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AddRecordModal({ isOpen, onClose, onRecordAdded }) {
  const { showToast } = useAuth();
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
    setIsSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!pid.trim()) {
      showToast('PID is required.', 'warning');
      return;
    }
    if (!name.trim()) {
      showToast('Name is required.', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check PID duplicate first
      const checkRes = await api.get(`/api/records/check-pid/${encodeURIComponent(pid.trim())}`);
      if (checkRes.exists) {
        showToast(`Record with PID "${pid.trim()}" already exists!`, 'danger');
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
        setIsSubmitting(false);
      }
    } catch (err) {
      showToast(err.message || 'Error saving record.', 'danger');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25">
            <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-plus-circle-fill text-cyan"></i> Add New Data Record
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" disabled={isSubmitting}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="row g-3">
                {/* PID */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">
                    PID <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="PID (e.g. 1001)"
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {/* Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">
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
                  <label className="form-label text-white small fw-semibold">Father's Name</label>
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
                      <label className="form-label text-white small fw-semibold">UT No.</label>
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
                      <label className="form-label text-white small fw-semibold">Type</label>
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
                  <label className="form-label text-white small fw-semibold">
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
                  <label className="form-label text-white small fw-semibold">Date</label>
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
                  <label className="form-label text-white small fw-semibold">
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
            <div className="modal-footer border-top border-secondary border-opacity-25">
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
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    Saving...
                  </>
                ) : (
                  'Save Record'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

