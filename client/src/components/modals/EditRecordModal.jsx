/**
 * client/src/components/modals/EditRecordModal.jsx
 * Edit Record Modal (for Admin or records created within 12 hours)
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function EditRecordModal({ isOpen, onClose, record, onRecordUpdated, onOpenRequestEdit }) {
  const { showToast, isAdmin } = useAuth();
  const [remarkOptions, setRemarkOptions] = useState([]);
  const [name, setName] = useState('');
  const [father, setFather] = useState('');
  const [utNo, setUtNo] = useState('');
  const [recordType, setRecordType] = useState('');
  const [aadharNo, setAadharNo] = useState('');
  const [date, setDate] = useState('');
  const [remark, setRemark] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAadharDisabled, setIsAadharDisabled] = useState(false);

  useEffect(() => {
    if (!isOpen || !record) return;

    // Check 12-hour permission: If not admin and canEdit is false, divert to RequestEditModal
    if (!isAdmin && !record.canEdit) {
      onClose();
      if (onOpenRequestEdit) onOpenRequestEdit(record);
      return;
    }

    setName(record.name || '');
    setFather(record.father || '');
    setUtNo(record.utNo || '');
    setRecordType(record.type || record.recordType || (/\b(CT|CP|DT|DP)\b|CT|CP|DT|DP/i.test(record.utNo) ? 'CT' : 'UT'));
    setAadharNo(record.aadharNo || '');
    setDate(record.date || '');
    setRemark(record.remark || '');
    setIsSubmitting(false);

    api.get('/api/records/remark-options')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setRemarkOptions(res.data);
          const matched = res.data.find(opt => (opt.optionValue || opt).toLowerCase() === (record.remark || '').toLowerCase());
          if (matched && matched.disableAadhar) {
            setIsAadharDisabled(true);
          }
        }
      })
      .catch(() => {});
  }, [isOpen, record, isAdmin, onClose, onOpenRequestEdit]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !record) return;

    if (!name.trim()) {
      showToast('Name is required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.put(`/api/records/${record.id || record.rowIndex}`, {
        pid: record.pid,
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
        showToast(res.message || 'Record updated successfully!', 'success');
        onClose();
        if (onRecordUpdated) onRecordUpdated(res.data);
      } else {
        showToast(res.message || 'Failed to update record.', 'danger');
        setIsSubmitting(false);
      }
    } catch (err) {
      showToast(err.message || 'Error updating record.', 'danger');
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !record) return null;

  return createPortal(
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-pencil-square text-cyan"></i> Edit Record - PID: {record.pid}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={isSubmitting}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="row g-3">
                {/* PID (Readonly) */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">PID</label>
                  <input type="text" className="form-control" value={record.pid || ''} disabled readOnly />
                </div>

                {/* Name */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
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
                    value={father}
                    onChange={(e) => setFather(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* UT No & Type */}
                <div className="col-12 col-md-6">
                  <div className="row g-2">
                    <div className="col-8">
                      <label className="form-label text-white small fw-semibold">UT No.</label>
                      <input
                        type="text"
                        className="form-control"
                        value={utNo}
                        onChange={(e) => setUtNo(e.target.value)}
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

                {/* Aadhar No */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">Aadhar No.</label>
                  <input
                    type="text"
                    className="form-control"
                    value={aadharNo}
                    onChange={(e) => handleAadharChange(e.target.value)}
                    disabled={isAadharDisabled || isSubmitting}
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

                {/* Remark */}
                <div className="col-12">
                  <label className="form-label text-white small fw-semibold">Remark</label>
                  <select
                    className="form-select"
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Updating...
                  </>
                ) : (
                  'Update Record'
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

