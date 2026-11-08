/**
 * client/src/components/modals/AddUserModal.jsx
 * Admin Add New User Modal
 */

import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AddUserModal({ isOpen, onClose, onUserAdded }) {
  const { showToast } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Add');
  const [importPermission, setImportPermission] = useState(false);
  const [fullAccess, setFullAccess] = useState(false);
  const [deleteRequestPermission, setDeleteRequestPermission] = useState(false);
  const [psListPermission, setPsListPermission] = useState(false);
  const [status, setStatus] = useState('Active');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showToast('यूज़रनेम और पासवर्ड दोनों आवश्यक हैं।', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/users', {
        username: username.trim(),
        password: password.trim(),
        role,
        importPermission,
        fullAccess,
        deleteRequestPermission,
        psListPermission,
        status
      });

      if (res && res.success) {
        showToast(res.message || 'नया यूज़र सफलतापूर्वक बनाया गया!', 'success');
        setUsername('');
        setPassword('');
        setRole('Add');
        setImportPermission(false);
        setFullAccess(false);
        setDeleteRequestPermission(false);
        setPsListPermission(false);
        setStatus('Active');
        onClose();
        if (onUserAdded) onUserAdded(res.data);
      } else {
        showToast(res.message || 'यूज़र बनाने में विफलता।', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'यूज़र बनाने में त्रुटि आई।', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25">
            <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-person-plus-fill text-cyan"></i> Add New User Account
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">
                    Username <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">
                    Password <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">Role</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Add">Add (Standard User)</option>
                    <option value="View">View Only</option>
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label text-white small fw-semibold">Account Status</label>
                  <select
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={loading}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="col-12 border-top border-secondary border-opacity-25 pt-3">
                  <h6 className="text-cyan small fw-bold text-uppercase mb-3">Permissions</h6>
                  <div className="row g-3">
                    <div className="col-12 col-sm-6">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="add-import-perm"
                          checked={importPermission}
                          onChange={(e) => setImportPermission(e.target.checked)}
                          disabled={loading}
                        />
                        <label className="form-check-label text-white small" htmlFor="add-import-perm">
                          Import Permission (Upload Excel/CSV)
                        </label>
                      </div>
                    </div>
                    <div className="col-12 col-sm-6">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="add-full-access"
                          checked={fullAccess}
                          onChange={(e) => setFullAccess(e.target.checked)}
                          disabled={loading}
                        />
                        <label className="form-check-label text-white small" htmlFor="add-full-access">
                          Full Access (Edit/Delete Records anytime)
                        </label>
                      </div>
                    </div>
                    <div className="col-12 col-sm-6">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="add-del-req-perm"
                          checked={deleteRequestPermission}
                          onChange={(e) => setDeleteRequestPermission(e.target.checked)}
                          disabled={loading}
                        />
                        <label className="form-check-label text-white small" htmlFor="add-del-req-perm">
                          Delete Request Access
                        </label>
                      </div>
                    </div>
                    <div className="col-12 col-sm-6">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="add-ps-perm"
                          checked={psListPermission}
                          onChange={(e) => setPsListPermission(e.target.checked)}
                          disabled={loading}
                        />
                        <label className="form-check-label text-white small" htmlFor="add-ps-perm">
                          PS List Access (Search Police Stations)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer border-top border-secondary border-opacity-25">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

