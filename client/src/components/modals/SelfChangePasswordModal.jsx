/**
 * client/src/components/modals/SelfChangePasswordModal.jsx
 * Modal for user self password change
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function SelfChangePasswordModal({ isOpen, onClose }) {
  const { showToast } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentPassword) {
      showToast('Please enter your current password.', 'warning');
      return;
    }
    if (!newPassword || newPassword.trim().length < 6) {
      showToast('New password must be at least 6 characters long.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirm password do not match.', 'danger');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/change-password', {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim()
      });
      if (res && res.success) {
        showToast(res.message || 'Password changed successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        showToast((res && res.message) || 'Could not change password.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Failed to change password.', 'danger');
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
              <i className="bi bi-shield-lock-fill text-warning fs-5"></i> Change Password
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
              {/* Current Password */}
              <div className="mb-3">
                <label className="form-label card-title-text small fw-semibold">
                  Current Password <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    className="form-control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowCurrentPass(p => !p)}
                    tabIndex="-1"
                    title={showCurrentPass ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showCurrentPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="mb-3">
                <label className="form-label card-title-text small fw-semibold">
                  New Password (Min 6 chars) <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowNewPass(p => !p)}
                    tabIndex="-1"
                    title={showNewPass ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showNewPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="mb-2">
                <label className="form-label card-title-text small fw-semibold">
                  Confirm New Password <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowConfirmPass(p => !p)}
                    tabIndex="-1"
                    title={showConfirmPass ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi ${showConfirmPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
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
                className="btn btn-primary btn-sm px-4 fw-semibold"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Updating...
                  </>
                ) : (
                  'Update Password'
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
