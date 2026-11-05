/**
 * client/src/components/modals/TotalUsersModal.jsx
 * Dedicated Modal for Portal User Accounts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function TotalUsersModal({ isOpen, onClose }) {
  const { user: currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/users?t=${Date.now()}`);
      if (res && res.success) {
        setUsers(res.data || []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchUsername('');
      setStatusFilter('Active');
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  const filteredUsers = (Array.isArray(users) ? users : []).filter(u => {
    if (!u) return false;
    if (statusFilter !== 'All' && String(u.status || 'Active').toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchUsername.trim() && !String(u.username || '').toLowerCase().includes(searchUsername.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg" style={{ background: 'var(--card-bg, #0b1329)' }}>
          {/* Header */}
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className="stat-icon bg-info-subtle-custom text-cyan rounded-3 p-2 d-flex align-items-center justify-content-center"
                style={{ width: '42px', height: '42px' }}
              >
                <i className="bi bi-people fs-5"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white mb-0">Portal User Accounts</h5>
                <span className="text-muted small">
                  Manage and view system users (<span className="badge bg-info text-white fw-bold">{filteredUsers.length}</span>)
                </span>
              </div>
            </div>

            {/* Filters */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="position-relative" style={{ width: '180px' }}>
                <input
                  type="text"
                  className="form-control form-control-sm text-white"
                  placeholder="Search user..."
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                />
                {searchUsername && (
                  <button
                    type="button"
                    className="btn btn-sm text-muted position-absolute end-0 top-50 translate-middle-y border-0 p-1"
                    onClick={() => setSearchUsername('')}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>

              <div className="d-flex align-items-center gap-1">
                <label className="small text-muted mb-0">Status:</label>
                <select
                  className="form-select form-select-sm text-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ width: '100px' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="All">All</option>
                </select>
              </div>

              <button
                type="button"
                className="btn-close btn-close-white ms-1"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-0">
            <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="sticky-top shadow-sm" style={{ zIndex: 10, background: 'rgba(10, 16, 36, 0.95)' }}>
                  <tr className="text-uppercase small text-muted">
                    <th className="ps-4">User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Permissions</th>
                    {isAdmin && <th className="text-end pe-4">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="text-center py-5 text-muted">
                        <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                        Loading user accounts...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="text-center py-5 text-muted">
                        <i className="bi bi-person-x fs-2 d-block mb-2 text-secondary"></i>
                        No users found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u, idx) => {
                      const isSelf = currentUser && (currentUser.username === u.username);
                      const roleBadgeClass =
                        u.role === 'Admin'
                          ? 'bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25'
                          : u.role === 'Add'
                          ? 'bg-primary bg-opacity-25 text-cyan border border-cyan border-opacity-25'
                          : 'bg-secondary bg-opacity-25 text-muted border border-secondary border-opacity-25';

                      const statusBadgeClass =
                        u.status === 'Active'
                          ? 'bg-success bg-opacity-25 text-success border border-success border-opacity-25'
                          : 'bg-secondary bg-opacity-25 text-muted border border-secondary border-opacity-25';

                      return (
                        <tr key={u.id || idx}>
                          <td className="ps-4">
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center bg-dark text-cyan fw-bold"
                                style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}
                              >
                                {u.username?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <span className="fw-semibold text-white d-block">{u.username}</span>
                                {isSelf && <span className="badge bg-info text-dark x-small py-0 px-1">You</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${roleBadgeClass} py-1 px-2 fw-semibold`}>
                              {u.role || 'Viewer'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${statusBadgeClass} py-1 px-2`}>
                              {u.status || 'Active'}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              {u.canImport && (
                                <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 small">
                                  Import
                                </span>
                              )}
                              {u.canDeleteRequest && (
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 small">
                                  Delete
                                </span>
                              )}
                              {u.fullAccess && (
                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 small">
                                  Full
                                </span>
                              )}
                              {!u.canImport && !u.canDeleteRequest && !u.fullAccess && (
                                <span className="text-muted small">Standard</span>
                              )}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="text-end pe-4">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-cyan px-2 py-1"
                                onClick={() => {
                                  onClose();
                                  navigate('/users');
                                }}
                                title="Manage this user in User Management"
                              >
                                <i className="bi bi-gear me-1"></i> Manage
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-2 d-flex justify-content-between align-items-center">
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm px-3"
                onClick={() => {
                  onClose();
                  navigate('/users');
                }}
              >
                <i className="bi bi-box-arrow-up-right me-1.5"></i> Full User Management
              </button>
            ) : (
              <span className="small text-muted">Portal User Directory</span>
            )}
            <button type="button" className="btn btn-secondary btn-sm px-4" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

