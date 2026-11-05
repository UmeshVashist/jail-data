/**
 * client/src/components/modals/ReviewListAddRequestModal.jsx
 * Admin Review List Add (Dropdown Option) Request Modal
 */

import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ReviewListAddRequestModal({ isOpen, onClose, request, onActionCompleted }) {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !request) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await api.put(`/api/list-add-requests/${request.id}/approve`);
      if (res && res.success) {
        showToast(res.message || 'Dropdown option approved and added permanently!', 'success');
        onClose();
        if (onActionCompleted) onActionCompleted();
      } else {
        showToast(res.message || 'Failed to approve request.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error approving request.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const res = await api.put(`/api/list-add-requests/${request.id}/reject`);
      if (res && res.success) {
        showToast(res.message || 'Dropdown option request rejected.', 'info');
        onClose();
        if (onActionCompleted) onActionCompleted();
      } else {
        showToast(res.message || 'Failed to reject request.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error rejecting request.', 'danger');
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
              <i className="bi bi-ui-checks text-cyan"></i> Review Dropdown Option Request
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <div className="modal-body p-4">
            <div className="p-3 rounded-3 bg-dark border border-secondary border-opacity-25 mb-3 text-white small">
              <div className="mb-2"><strong>Proposed Value:</strong> <span className="badge bg-primary bg-opacity-25 text-cyan fs-6 py-1 px-2">{request.optionValue}</span></div>
              <div className="mb-2"><strong>Disable Aadhar:</strong> {request.disableAadhar ? <span className="badge bg-warning text-dark">Yes</span> : <span className="badge bg-secondary">No</span>}</div>
              <div className="mb-2"><strong>Requested By:</strong> <span className="badge bg-secondary">{request.requestedBy}</span></div>
              <div className="mb-2"><strong>Request Time:</strong> {request.requestedDate} {request.requestedTime}</div>
              <div><strong>Reason:</strong> <span className="text-muted fst-italic">"{request.reason || 'None specified'}"</span></div>
            </div>
            <p className="text-white small mb-0">
              Approving will permanently register this option in the Remark Dropdowns across the entire portal.
            </p>
          </div>
          <div className="modal-footer border-top border-secondary border-opacity-25 justify-content-between">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-danger btn-sm px-3" onClick={handleReject} disabled={loading}>
                <i className="bi bi-x-circle me-1"></i> Reject
              </button>
              <button type="button" className="btn btn-success btn-sm px-4 fw-semibold" onClick={handleApprove} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Adding...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill me-1"></i> Approve & Add Option
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
