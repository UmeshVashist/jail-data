/**
 * client/src/pages/UserManagement.jsx
 * Admin User Accounts & Permissions Management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddUserModal from '../components/modals/AddUserModal';
import EditUserModal from '../components/modals/EditUserModal';
import ChangePasswordModal from '../components/modals/ChangePasswordModal';

export default function UserManagement() {
  const { isAdmin, showToast } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/users');
      if (res && res.success) {
        setUsers(res.data || []);
      }
    } catch (err) {
      showToast('Error loading users: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!isAdmin) {
    return (
      <div className="alert alert-danger p-4 rounded-3 text-center">
        <i className="bi bi-shield-lock-fill fs-2 d-block mb-2"></i>
        <h5>Admin Access Required</h5>
        <p className="small mb-0">Only administrators have permission to manage portal user accounts.</p>
      </div>
    );
  }

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${u.username}"?`)) {
      return;
    }

    try {
      const res = await api.delete(`/api/users/${u.id}`);
      if (res && res.success) {
        showToast(res.message || `User "${u.username}" deleted.`, 'success');
        fetchUsers();
      } else {
        showToast(res.message || 'Failed to delete user.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error deleting user.', 'danger');
    }
  };

  const filtered = users.filter(u => {
    if (statusFilter !== 'All' && (u.status || 'Active').toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchUsername.trim() && !(u.username || '').toLowerCase().includes(searchUsername.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="view-section">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold text-white mb-1">User Management</h3>
          <p className="text-muted small mb-0">Manage portal user accounts, assign roles, grant permissions, and configure delete request access</p>
        </div>
        <div className="mt-3 mt-md-0 d-flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
            onClick={() => setAddUserOpen(true)}
          >
            <i className="bi bi-person-plus-fill"></i> Add New User
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar p-3 rounded-3 mb-4 custom-table-card">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-6">
            <div className="position-relative">
              <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
              <input
                type="text"
                data-search-slash="true"
                className="form-control ps-5 pe-5 search-slash-input"
                placeholder="Search user by username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
              />
              <span className="search-shortcut-kbd-wrap position-absolute top-50 end-0 translate-middle-y me-2">
                <kbd className="search-slash-kbd">/</kbd>
              </span>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small fw-semibold text-nowrap">Status:</span>
              <select
                className="form-select custom-modern-dropdown"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="col-12 col-md-2 text-end">
            <button
              type="button"
              className="btn btn-outline-cyan w-100"
              onClick={fetchUsers}
            >
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="custom-table-card p-3 rounded-3">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small">
                <th>Username</th>
                <th>Role</th>
                <th>Import Permission</th>
                <th>Full Access</th>
                <th>Delete Request Access</th>
                <th>PS List Access</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                    Loading users...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <i className="bi bi-people fs-2 d-block mb-2 text-secondary"></i>
                    No users match the search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((u, idx) => {
                  const roleBadge =
                    u.role === 'Admin'
                      ? 'bg-danger text-white'
                      : u.role === 'Add'
                      ? 'bg-primary text-white'
                      : 'bg-secondary text-white';

                  return (
                    <tr key={u.id || idx}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-person-circle fs-5 text-cyan"></i>
                          <span className="fw-bold text-white">{u.username}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge py-1 px-2 fw-semibold ${roleBadge}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge py-1 px-2 ${u.importPermission ? 'bg-success' : 'bg-dark text-muted border border-secondary border-opacity-25'}`}>
                          {u.importPermission ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge py-1 px-2 ${u.fullAccess ? 'bg-primary' : 'bg-dark text-muted border border-secondary border-opacity-25'}`}>
                          {u.fullAccess ? 'Granted' : 'Standard'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge py-1 px-2 ${u.deleteRequestPermission ? 'bg-warning text-dark' : 'bg-dark text-muted border border-secondary border-opacity-25'}`}>
                          {u.deleteRequestPermission ? 'Granted' : 'None'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge py-1 px-2 ${u.psListPermission ? 'bg-info text-dark' : 'bg-dark text-muted border border-secondary border-opacity-25'}`}>
                          {u.psListPermission ? 'Granted' : 'None'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge py-1 px-2 ${u.status === 'Active' ? 'bg-success' : 'bg-danger'}`}>
                          {u.status || 'Active'}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning p-1 px-2"
                            onClick={() => setPasswordUser(u)}
                            title="Reset Password"
                          >
                            <i className="bi bi-key"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary p-1 px-2"
                            onClick={() => setEditUser(u)}
                            title="Edit Permissions"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger p-1 px-2"
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User Account"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onUserAdded={() => fetchUsers()}
      />
      <EditUserModal
        isOpen={!!editUser}
        targetUser={editUser}
        onClose={() => setEditUser(null)}
        onUserUpdated={() => fetchUsers()}
      />
      <ChangePasswordModal
        isOpen={!!passwordUser}
        targetUser={passwordUser}
        onClose={() => setPasswordUser(null)}
      />
    </div>
  );
}
