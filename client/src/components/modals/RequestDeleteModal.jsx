/**
 * client/src/components/modals/RequestDeleteModal.jsx
 * Submit Delete Request Modal for records older than 12 hours
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
      showToast('कृपया डिलीट करने का कारण चुनें या दर्ज करें।', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/delete-requests', {
        recordId: record.id || record.rowIndex,
        reason: finalReason
      });

      if (res && res.success) {
        showToast(res.message || 'डिलीट अनुरोध सफलतापूर्वक एडमिन को भेज दिया गया!', 'success');
        onClose();
        if (onRequestSubmitted) onRequestSubmitted(res.data);
      } else {
        showToast(res.message || 'डिलीट अनुरोध भेजने में विफलता।', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'डिलीट अनुरोध भेजने में त्रुटि आई।', 'danger');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !record) return null;

  return createPortal(
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-trash3 text-danger"></i> Request Record Deletion
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="modal-notice-banner d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-info-circle-fill fs-6 flex-shrink-0"></i>
                <span>This record is older than 12 hours. Deletion requires Admin review and confirmation.</span>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Target Record</label>
                <div className="modal-target-record-box small">
                  <div className="mb-1"><strong>PID:</strong> <span className="font-monospace text-cyan fw-bold">{record.pid}</span> | <strong>Name:</strong> {record.name}</div>
                  <div><strong>UT No:</strong> {record.utNo || '-'} | <strong>Aadhar:</strong> {record.aadharNo || '-'}</div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">
                  Reason for Deletion <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select custom-modern-dropdown"
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
                  <label className="form-label small fw-semibold">
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
            <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-3">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger btn-sm px-4 fw-semibold shadow-sm"
                disabled={loading}
                title="Keyboard shortcut: Ctrl + Enter"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash3 me-1"></i> Submit Delete Request <small className="opacity-75 ms-1 fw-normal">(Ctrl+Enter)</small>
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

