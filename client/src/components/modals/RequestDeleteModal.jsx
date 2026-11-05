/**
 * client/src/components/modals/RequestDeleteModal.jsx
 * Submit Delete Request Modal for records older than 12 hours
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function RequestDeleteModal({ isOpen, onClose, record, onRequestSubmitted }) {
  const { showToast } = useAuth();
  const [deleteOptions, setDeleteOptions] = useState([]);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedReason('');
    setCustomReason('');
    setLoading(false);

    api.get('/api/records/delete-options')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setDeleteOptions(res.data);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !record) return;

    const finalReason = selectedReason === 'Other' ? customReason.trim() : (selectedReason || customReason.trim());
    if (!finalReason) {
      showToast('Please select or specify a reason for deletion.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/delete-requests', {
        recordId: record.id || record.rowIndex,
        reason: finalReason
      });

      if (res && res.success) {
        showToast(res.message || 'Delete request submitted to Admin for approval!', 'success');
        onClose();
        if (onRequestSubmitted) onRequestSubmitted(res.data);
      } else {
        showToast(res.message || 'Failed to submit delete request.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error submitting delete request.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !record) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25">
            <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-trash3 text-warning"></i> Request Record Deletion
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="alert alert-warning small rounded-3 border-0 bg-warning bg-opacity-15 text-warning mb-3">
                <i className="bi bi-info-circle-fill me-1"></i> This record is older than 12 hours. Deletion requires Admin review and confirmation.
              </div>

              <div className="mb-3">
                <label className="form-label text-white small fw-semibold">Target Record</label>
                <div className="p-2 rounded bg-dark border border-secondary border-opacity-25 text-white small">
                  <div><strong>PID:</strong> {record.pid} | <strong>Name:</strong> {record.name}</div>
                  <div><strong>UT No:</strong> {record.utNo || '-'} | <strong>Aadhar:</strong> {record.aadharNo || '-'}</div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label text-white small fw-semibold">
                  Reason for Deletion <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  required
                  disabled={loading}
                >
                  <option value="">-- Select Deletion Reason --</option>
                  {deleteOptions.map((opt, idx) => {
                    const val = typeof opt === 'object' ? opt.optionValue : opt;
                    return <option key={idx} value={val}>{val}</option>;
                  })}
                  <option value="Other">Other (Custom Reason)</option>
                </select>
              </div>

              {selectedReason === 'Other' && (
                <div className="mb-3">
                  <label className="form-label text-white small fw-semibold">
                    Custom Reason <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Enter reason for deleting this record..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    required
                    disabled={loading}
                  ></textarea>
                </div>
              )}
            </div>
            <div className="modal-footer border-top border-secondary border-opacity-25">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-warning btn-sm px-4 fw-semibold text-dark" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Submitting...
                  </>
                ) : (
                  'Submit Delete Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
