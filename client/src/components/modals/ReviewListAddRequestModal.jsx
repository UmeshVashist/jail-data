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
        showToast(res.message || 'ड्रॉपडाउन विकल्प स्वीकृत किया गया और स्थायी रूप से जोड़ दिया गया!', 'success');
        onClose();
        if (onActionCompleted) onActionCompleted({ id: request.id, requestType: 'List Add', status: 'Approved' });
      } else {
        showToast(res.message || 'अनुरोध स्वीकृत करने में विफलता।', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'अनुरोध स्वीकृत करने में त्रुटि आई।', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const res = await api.put(`/api/list-add-requests/${request.id}/reject`);
      if (res && res.success) {
        showToast(res.message || 'ड्रॉपडाउन विकल्प अनुरोध अस्वीकृत (Reject) कर दिया गया।', 'info');
        onClose();
        if (onActionCompleted) onActionCompleted({ id: request.id, requestType: 'List Add', status: 'Rejected' });
      } else {
        showToast(res.message || 'अनुरोध अस्वीकृत करने में विफलता।', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'अनुरोध अस्वीकृत करने में त्रुटि आई।', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-ui-checks text-cyan"></i> Review Dropdown Option Request
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <div className="modal-body p-4">
            <div className="p-3 rounded-3 modal-target-record-box mb-3 small shadow-sm">
              <div className="mb-2"><strong>Proposed Value:</strong> <span className="table-text-main fw-bold fs-6 ms-1">{request.optionValue}</span></div>
              <div className="mb-2"><strong>Disable Aadhar:</strong> {request.disableAadhar ? <span className="badge bg-warning text-dark ms-1">Yes</span> : <span className="badge bg-secondary ms-1">No</span>}</div>
              <div className="mb-2"><strong>Requested By:</strong> <span className="badge bg-secondary ms-1">{request.requestedBy}</span></div>
              <div className="mb-2"><strong>Request Time:</strong> <span className="text-muted ms-1">{request.requestedDate} {request.requestedTime}</span></div>
              <div><strong>Reason:</strong> <span className="text-primary fw-semibold fst-italic ms-1">"{request.reason || 'None specified'}"</span></div>
            </div>
            <p className="table-text-main small mb-0">
              Approving will permanently register this option in the Remark Dropdowns across the entire portal.
            </p>
          </div>
          <div className="modal-footer border-top border-secondary border-opacity-25 justify-content-between px-4 py-3">
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

