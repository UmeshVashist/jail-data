/**
 * client/src/components/modals/DeleteRecordModal.jsx
 * Confirm Direct Deletion Modal (for Admin or records within 12 hours)
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DeleteRecordModal({ isOpen, onClose, record, onRecordDeleted, onOpenRequestDelete }) {
  const { showToast, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !record) return null;

  // If not admin and record is older than 12 hours, divert to RequestDeleteModal
  if (!isAdmin && !record.canDelete) {
    onClose();
    if (onOpenRequestDelete) onOpenRequestDelete(record);
    return null;
  }

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await api.delete(`/api/records/${record.id || record.rowIndex}`);
      if (res && res.success) {
        showToast(res.message || 'Record deleted successfully!', 'success');
        onClose();
        if (onRecordDeleted) onRecordDeleted(record);
      } else {
        showToast(res.message || 'Failed to delete record.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error deleting record.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-trash3-fill"></i> Delete Record
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <div className="modal-body p-4 text-center">
            <div className="text-danger mb-3" style={{ fontSize: '3rem' }}>
              <i className="bi bi-exclamation-circle"></i>
            </div>
            <h5 className="table-text-main fw-bold mb-2">Are you sure?</h5>
            <p className="text-muted small mb-0">
              You are about to permanently delete record for PID: <strong>{record.pid}</strong> ({record.name}). This action cannot be undone.
            </p>
          </div>
          <div className="modal-footer border-top border-secondary border-opacity-25 justify-content-center">
            <button type="button" className="btn btn-secondary btn-sm px-3" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger btn-sm px-4 fw-semibold" onClick={handleDelete} disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span> Deleting...
                </>
              ) : (
                'Yes, Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

