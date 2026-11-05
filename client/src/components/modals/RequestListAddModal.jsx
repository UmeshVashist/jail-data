/**
 * client/src/components/modals/RequestListAddModal.jsx
 * Request New Dropdown Option Modal
 */

import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function RequestListAddModal({ isOpen, onClose, onRequestAdded }) {
  const { showToast } = useAuth();
  const [optionValue, setOptionValue] = useState('');
  const [reason, setReason] = useState('');
  const [disableAadhar, setDisableAadhar] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!optionValue.trim()) {
      showToast('Option value is required.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/list-add-requests', {
        optionValue: optionValue.trim(),
        reason: reason.trim(),
        disableAadhar
      });

      if (res && res.success) {
        showToast(res.message || 'New dropdown option request submitted to Admin!', 'success');
        setOptionValue('');
        setReason('');
        setDisableAadhar(false);
        onClose();
        if (onRequestAdded) onRequestAdded(res.data);
      } else {
        showToast(res.message || 'Failed to submit request.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error submitting dropdown option request.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25">
            <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-plus-square-fill text-cyan"></i> Request New Dropdown Option
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label text-white small fw-semibold">
                  New Option Name / Value <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Biometric Block"
                  value={optionValue}
                  onChange={(e) => setOptionValue(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="request-disable-aadhar"
                    checked={disableAadhar}
                    onChange={(e) => setDisableAadhar(e.target.checked)}
                    disabled={loading}
                  />
                  <label className="form-check-label text-white small" htmlFor="request-disable-aadhar">
                    Disable Aadhar No. requirement when this option is selected
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label text-white small fw-semibold">Reason for Request</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Optional reason for adding this dropdown option..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={loading}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer border-top border-secondary border-opacity-25">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

