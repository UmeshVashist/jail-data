/**
 * client/src/components/modals/ReviewEditRequestModal.jsx
 * Admin Side-by-Side Comparison Modal with Precise [Changed] Diff Badges
 */

import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ReviewEditRequestModal({ isOpen, onClose, request, onActionCompleted }) {
  const { showToast } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !request) return null;

  const prop = request.proposedData || {};

  // Normalize comparisons
  const normAadhar = (val) => (val || '').toString().replace(/\D/g, '').slice(0, 12);
  const normDate = (val) => {
    if (!val) return '';
    const s = String(val).trim();
    const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const m2 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    return s;
  };
  const normStr = (val) => (val || '').toString().trim().toLowerCase();

  const isNameChanged = prop.name !== undefined && normStr(prop.name) !== normStr(request.name);
  const isFatherChanged = prop.father !== undefined && normStr(prop.father) !== normStr(request.father);
  const isUtChanged = prop.utNo !== undefined && normStr(prop.utNo) !== normStr(request.utNo);
  const isAadharChanged = prop.aadharNo !== undefined && normAadhar(prop.aadharNo) !== normAadhar(request.aadharNo);
  const isDateChanged = prop.date !== undefined && normDate(prop.date) !== normDate(request.date);
  const isRemarkChanged = prop.remark !== undefined && normStr(prop.remark) !== normStr(request.remark);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await api.put(`/api/edit-requests/${request.id}/approve`);
      if (res && res.success) {
        showToast(res.message || 'Edit request approved and record updated!', 'success');
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
      const res = await api.put(`/api/edit-requests/${request.id}/reject`);
      if (res && res.success) {
        showToast(res.message || 'Edit request rejected.', 'info');
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
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25">
            <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-arrow-left-right text-cyan"></i> Review Edit Request Comparison
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <div className="modal-body p-4">
            {/* Meta Header Box */}
            <div className="p-3 rounded-3 bg-dark border border-secondary border-opacity-25 mb-4 text-white small">
              <div className="d-flex flex-wrap gap-3">
                <div><strong>Requested By:</strong> <span className="badge bg-secondary">{request.requestedBy}</span></div>
                <div><strong>Request Date:</strong> {request.requestedDate} {request.requestedTime}</div>
                <div><strong>Reason:</strong> <span className="text-warning fst-italic">"{request.reason || 'None specified'}"</span></div>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="table-responsive">
              <table className="table table-bordered table-dark align-middle mb-0">
                <thead>
                  <tr className="text-uppercase text-cyan small">
                    <th style={{ width: '25%' }}>Field</th>
                    <th style={{ width: '37.5%' }}>Original Value</th>
                    <th style={{ width: '37.5%' }}>Proposed Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-semibold text-white">PID</td>
                    <td className="text-white">{request.pid || '-'}</td>
                    <td className="text-white">{prop.pid || request.pid || '-'}</td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-white">Name</td>
                    <td className="text-white">{request.name || '-'}</td>
                    <td>
                      <span className="text-white">{prop.name || request.name || '-'}</span>
                      {isNameChanged && <span className="badge bg-warning text-dark ms-2 fw-semibold">Changed</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-white">Father Name</td>
                    <td className="text-white">{request.father || '-'}</td>
                    <td>
                      <span className="text-white">{prop.father || request.father || '-'}</span>
                      {isFatherChanged && <span className="badge bg-warning text-dark ms-2 fw-semibold">Changed</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-white">UT No</td>
                    <td className="text-white">{request.utNo || '-'}</td>
                    <td>
                      <span className="text-white">{prop.utNo || request.utNo || '-'}</span>
                      {isUtChanged && <span className="badge bg-warning text-dark ms-2 fw-semibold">Changed</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-white">Aadhar No</td>
                    <td className="text-white font-monospace">{request.aadharNo || '#N/A'}</td>
                    <td>
                      <span className="text-white font-monospace">{prop.aadharNo || request.aadharNo || '#N/A'}</span>
                      {isAadharChanged && <span className="badge bg-warning text-dark ms-2 fw-semibold">Changed</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-white">Record Date</td>
                    <td className="text-white">{request.date || '-'}</td>
                    <td>
                      <span className="text-white">{prop.date || request.date || '-'}</span>
                      {isDateChanged && <span className="badge bg-warning text-dark ms-2 fw-semibold">Changed</span>}
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-semibold text-white">Remark</td>
                    <td className="text-white">{request.remark || '-'}</td>
                    <td>
                      <span className="text-white">{prop.remark || request.remark || '-'}</span>
                      {isRemarkChanged && <span className="badge bg-warning text-dark ms-2 fw-semibold">Changed</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer border-top border-secondary border-opacity-25 justify-content-between">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
              Close
            </button>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-danger btn-sm px-3" onClick={handleReject} disabled={loading}>
                <i className="bi bi-x-circle me-1"></i> Reject
              </button>
              <button type="button" className="btn btn-success btn-sm px-4 fw-semibold shadow-sm" onClick={handleApprove} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Updating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle-fill me-1"></i> Approve & Update Data
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

