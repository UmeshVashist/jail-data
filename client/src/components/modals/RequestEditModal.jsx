/**
 * client/src/components/modals/RequestEditModal.jsx
 * Submit Edit Request modal for records older than 12 hours
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function RequestEditModal({ isOpen, onClose, record, onRequestSubmitted }) {
  const { showToast } = useAuth();
  const [remarkOptions, setRemarkOptions] = useState([]);
  const [name, setName] = useState('');
  const [father, setFather] = useState('');
  const [utNo, setUtNo] = useState('');
  const [aadharNo, setAadharNo] = useState('');
  const [date, setDate] = useState('');
  const [remark, setRemark] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !record) return;
    setName(record.name || '');
    setFather(record.father || '');
    setUtNo(record.utNo || '');
    setAadharNo(record.aadharNo || '');
    setDate(record.date || '');
    setRemark(record.remark || '');
    setReason('');
    setIsSubmitting(false);

    api.get('/api/records/remark-options')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setRemarkOptions(res.data);
        }
      })
      .catch(() => {});
  }, [isOpen, record]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !record) return;

    if (!reason.trim()) {
      showToast('Please provide a reason for editing this record.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/api/edit-requests', {
        recordId: record.id || record.rowIndex,
        pid: record.pid,
        name: record.name,
        father: record.father,
        utNo: record.utNo,
        aadharNo: record.aadharNo,
        date: record.date,
        remark: record.remark,
        proposedData: {
          name: name.trim().toUpperCase(),
          father: father.trim().toUpperCase(),
          utNo: utNo.trim().toUpperCase(),
          aadharNo: aadharNo.trim(),
          date: date,
          remark: remark.trim()
        },
        reason: reason.trim()
      });

      if (res && res.success) {
        showToast(res.message || 'Edit request submitted to Admin for review!', 'success');
        onClose();
        if (onRequestSubmitted) onRequestSubmitted(res.data);
      } else {
        showToast(res.message || 'Failed to submit edit request.', 'danger');
        setIsSubmitting(false);
      }
    } catch (err) {
      showToast(err.message || 'Error submitting edit request.', 'danger');
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
              <i className="bi bi-send-check text-cyan"></i> Request Record Edit (PID: {record.pid})
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={isSubmitting}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="modal-notice-banner d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-info-circle-fill fs-6 flex-shrink-0"></i>
                <span>This record was created more than 12 hours ago. Modifications require Admin approval.</span>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Proposed Name</label>
                  <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Proposed Father's Name</label>
                  <input type="text" className="form-control" value={father} onChange={(e) => setFather(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Proposed UT No.</label>
                  <input type="text" className="form-control" value={utNo} onChange={(e) => setUtNo(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Proposed Aadhar No.</label>
                  <input type="text" className="form-control" value={aadharNo} onChange={(e) => setAadharNo(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Proposed Date</label>
                  <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small fw-semibold">Proposed Remark</label>
                  <select className="form-select custom-modern-dropdown" value={remark} onChange={(e) => setRemark(e.target.value)} disabled={isSubmitting}>
                    <option value="">-- Select Remark --</option>
                    {remarkOptions.map((opt, idx) => {
                      const val = typeof opt === 'object' ? opt.optionValue : opt;
                      return <option key={idx} value={val}>{val}</option>;
                    })}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">
                    Reason for Edit Request <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Describe why this record needs to be updated..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    disabled={isSubmitting}
                  ></textarea>
                </div>
              </div>
            </div>
            <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-3">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Submitting...
                  </>
                ) : (
                  'Submit Edit Request'
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

