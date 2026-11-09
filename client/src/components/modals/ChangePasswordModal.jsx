/**
 * client/src/components/modals/ChangePasswordModal.jsx
 * Admin Reset User Password Modal
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ChangePasswordModal({ isOpen, onClose, targetUser }) {
  const { showToast } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setShowPass(false);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPass = newPassword.trim();
    if (!cleanPass || cleanPass.length < 6) {
      showToast('Password must be at least 6 characters long.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const targetId = targetUser.id || targetUser.rowIndex || targetUser.username;
      const res = await api.put(`/api/users/${targetId}/password`, {
        newPassword: cleanPass
      });

      if (res && res.success) {
        showToast(res.message || `Password for ${targetUser.username} updated successfully!`, 'success');
        setNewPassword('');
        onClose();
      } else {
        showToast((res && res.message) || 'Failed to update password.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error updating password.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg custom-table-card">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-key-fill text-warning fs-5"></i> Reset Password for: {targetUser.username}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
              disabled={loading}
            ></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label card-title-text small fw-semibold">
                  New Password (Min 6 characters) <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPass(p => !p)}
                    tabIndex="-1"
                    title={showPass ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-3">
              <button
                type="button"
                className="btn btn-secondary btn-sm px-3"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-warning btn-sm px-4 fw-semibold text-dark"
                disabled={loading || !newPassword.trim() || newPassword.trim().length < 6}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Updating...
                  </>
                ) : (
                  'Reset Password'
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
