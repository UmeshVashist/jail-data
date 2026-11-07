/**
 * client/src/components/modals/ReviewDeleteRequestModal.jsx
 * Admin Review Delete Request Modal (Approve or Reject)
 */

import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ReviewDeleteRequestModal({ isOpen, onClose, request, onActionCompleted }) {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !request) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await api.put(`/api/delete-requests/${request.id}/approve`);
      if (res && res.success) {
        showToast(res.message || 'Delete request approved and record permanently deleted!', 'success');
        onClose();
        if (onActionCompleted) onActionCompleted({ id: request.id, requestType: 'Delete', status: 'Approved' });
      } else {
        showToast(res.message || 'Failed to approve delete request.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error approving delete request.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const res = await api.put(`/api/delete-requests/${request.id}/reject`);
      if (res && res.success) {
        showToast(res.message || 'Delete request rejected.', 'info');
        onClose();
        if (onActionCompleted) onActionCompleted({ id: request.id, requestType: 'Delete', status: 'Rejected' });
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
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-trash3-fill"></i> Review Delete Request
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <div className="modal-body p-4">
            <div className="p-3 rounded-3 modal-target-record-box mb-3 small shadow-sm">
              <div className="mb-2"><strong>Target PID:</strong> <span className="text-cyan fw-bold font-monospace ms-1">{request.pid}</span></div>
              <div className="mb-2"><strong>Name:</strong> <span className="fw-semibold table-text-main ms-1">{request.name}</span></div>
              <div className="mb-2"><strong>Requested By:</strong> <span className="badge bg-secondary ms-1">{request.requestedBy}</span></div>
              <div className="mb-2"><strong>Request Time:</strong> <span className="text-muted ms-1">{request.requestedDate} {request.requestedTime}</span></div>
              <div><strong>Reason:</strong> <span className="text-primary fw-semibold fst-italic ms-1">"{request.reason || request.remark || '-'}"</span></div>
            </div>
            <p className="text-danger small mb-0 d-flex align-items-center gap-1.5">
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i> Approving this request will immediately and permanently delete this record from the database.
            </p>
          </div>
          <div className="modal-footer border-top border-secondary border-opacity-25 justify-content-between px-4 py-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm px-3" onClick={handleReject} disabled={loading}>
                <i className="bi bi-x-circle me-1"></i> Reject
              </button>
              <button type="button" className="btn btn-danger btn-sm px-4 fw-semibold" onClick={handleApprove} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Processing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash3 me-1"></i> Approve & Delete Record
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

