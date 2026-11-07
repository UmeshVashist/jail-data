/**
 * client/src/pages/MyRequests.jsx
 * User Sent Requests Tracker with Request New Option modal and 10-row scrollable list
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RequestListAddModal from '../components/modals/RequestListAddModal';

export default function MyRequests() {
  const { user, showToast } = useAuth();
  const [requests, setRequests] = useState([]);
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestOptionOpen, setRequestOptionOpen] = useState(false);

  const fetchMyRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [editRes, delRes, listRes] = await Promise.all([
        api.get('/api/edit-requests').catch(() => ({ data: [] })),
        api.get('/api/delete-requests').catch(() => ({ data: [] })),
        api.get('/api/list-add-requests').catch(() => ({ data: [] }))
      ]);

      const currentUsername = (user?.username || '').toLowerCase();

      // Filter only requests created by current user (or all if admin)
      const editItems = (Array.isArray(editRes?.data) ? editRes.data : [])
        .filter(r => r && String(r.requestedBy || '').toLowerCase() === currentUsername)
        .map(r => ({ ...r, requestType: 'Edit' }));

      const delItems = (Array.isArray(delRes?.data) ? delRes.data : [])
        .filter(r => r && String(r.requestedBy || '').toLowerCase() === currentUsername)
        .map(r => ({ ...r, requestType: 'Delete' }));

      const listItems = (Array.isArray(listRes?.data) ? listRes.data : [])
        .filter(r => r && String(r.requestedBy || '').toLowerCase() === currentUsername)
        .map(r => ({ ...r, requestType: 'List Add' }));

      setRequests([...editItems, ...delItems, ...listItems]);
    } catch (err) {
      showToast('Error loading your requests: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  // Withdraw pending request by user
  const handleWithdrawRequest = async (req) => {
    const targetLabel = req.pid ? `PID ${req.pid}${req.name ? ` (${req.name})` : ''}` : `Option "${req.optionValue || ''}"`;
    if (!window.confirm(`Are you sure you want to WITHDRAW your ${req.requestType} request for ${targetLabel}?`)) {
      return;
    }

    // Optimistic UI removal
    setRequests(prev => prev.filter(r => !(r.id === req.id && r.requestType === req.requestType)));

    try {
      let url = '';
      if (req.requestType === 'Edit') url = `/api/edit-requests/${req.id}/cancel`;
      else if (req.requestType === 'Delete') url = `/api/delete-requests/${req.id}/cancel`;
      else if (req.requestType === 'List Add') url = `/api/list-add-requests/${req.id}/cancel`;

      const res = await api.delete(url);
      if (res && res.success) {
        showToast(res.message || `${req.requestType} request withdrawn successfully.`, 'info');
      } else {
        showToast(res?.message || 'Failed to withdraw request.', 'danger');
        fetchMyRequests();
      }
    } catch (err) {
      showToast('Error withdrawing request: ' + err.message, 'danger');
      fetchMyRequests();
    }
  };

  // Filter
  const filtered = (Array.isArray(requests) ? requests : []).filter(req => {
    if (!req) return false;
    if (typeFilter !== 'All' && req.requestType !== typeFilter) return false;
    if (statusFilter !== 'All' && String(req.status || 'Pending').toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const pidMatch = String(req.pid || '').toLowerCase().includes(q);
      const nameMatch = String(req.name || '').toLowerCase().includes(q);
      const optMatch = String(req.optionValue || '').toLowerCase().includes(q);
      const utMatch = String(req.utNo || '').toLowerCase().includes(q);
      if (!pidMatch && !nameMatch && !optMatch && !utMatch) return false;
    }
    return true;
  });

  return (
    <div id="my-requests-view" className="view-section">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold page-title-text mb-1">My Sent Requests</h3>
          <p className="text-muted small mb-0">Track all deletion, edit, and dropdown list addition requests you have submitted to Admin</p>
        </div>
        <div className="mt-3 mt-md-0 d-flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
            onClick={() => setRequestOptionOpen(true)}
          >
            <i className="bi bi-plus-circle-fill"></i> Request New Dropdown Option
          </button>
          <button
            type="button"
            className="btn btn-outline-cyan btn-sm px-3 py-2 fw-semibold"
            onClick={fetchMyRequests}
          >
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar p-3 rounded-3 mb-4 custom-table-card">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="position-relative">
              <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
              <input
                type="text"
                data-search-slash="true"
                className="form-control ps-5 pe-5 search-slash-input"
                placeholder="Search by PID, Name, UT No..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="search-shortcut-kbd-wrap position-absolute top-50 end-0 translate-middle-y me-2">
                <kbd className="search-slash-kbd">/</kbd>
              </span>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small fw-semibold text-nowrap">Type:</span>
              <select
                id="filter-my-requests-type"
                className="form-select custom-modern-dropdown"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="All">All Types (Edit, Delete & List Add)</option>
                <option value="Edit">Edit Requests</option>
                <option value="Delete">Delete Requests</option>
                <option value="List Add">List Add Requests</option>
              </select>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small fw-semibold text-nowrap">Status:</span>
              <select
                id="filter-my-requests-status"
                className="form-select custom-modern-dropdown"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="col-12 col-md-1 text-end">
            <button
              type="button"
              className="btn btn-outline-danger w-100"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('All');
                setStatusFilter('All');
              }}
              title="Reset filters"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table with 10-row scroll container */}
      <div className="custom-table-card p-3 rounded-3">
        <div
          className="table-responsive my-requests-scroll-container"
          style={{ maxHeight: filtered.length > 10 ? '550px' : 'auto', overflowY: filtered.length > 10 ? 'auto' : 'visible' }}
        >
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small">
                <th>Type</th>
                <th>PID / Target</th>
                <th>Name / Option Value</th>
                <th>UT No</th>
                <th>Reason / Remark</th>
                <th>Request Date/Time</th>
                <th>Status</th>
                <th>Action By</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                    Loading your requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                    You have not submitted any requests matching the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((req, idx) => {
                  const statusClass =
                    req.status === 'Approved'
                      ? 'bg-success text-white'
                      : req.status === 'Rejected'
                      ? 'bg-danger text-white'
                      : 'bg-warning text-dark';

                  const typeBadgeClass =
                    req.requestType === 'Edit'
                      ? 'bg-cyan bg-opacity-25 text-cyan border border-cyan border-opacity-25'
                      : req.requestType === 'Delete'
                      ? 'bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25'
                      : 'bg-success bg-opacity-25 text-success border border-success border-opacity-25';

                  const isPending = (req.status || 'Pending') === 'Pending';

                  return (
                    <tr key={req.id || idx}>
                      <td>
                        <span className={`badge py-1 px-2 fw-semibold ${typeBadgeClass}`}>
                          {req.requestType}
                        </span>
                      </td>
                      <td className="fw-bold text-cyan font-monospace">{req.pid || '-'}</td>
                      <td className="fw-semibold table-text-main">{req.name || req.optionValue || '-'}</td>
                      <td className="font-monospace small table-text-main">{req.utNo || '-'}</td>
                      <td className="small text-muted text-truncate" style={{ maxWidth: '200px' }}>
                        {req.reason || req.remark || '-'}
                      </td>
                      <td className="small text-muted">{req.requestedDate} {req.requestedTime}</td>
                      <td>
                        <span className={`badge py-1 px-2 fw-bold ${statusClass}`}>
                          {req.status || 'Pending'}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {req.actionBy ? `Reviewed by ${req.actionBy}` : 'Pending Admin Review'}
                      </td>
                      <td className="text-end">
                        {isPending ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                            onClick={() => handleWithdrawRequest(req)}
                            title="Withdraw this pending request if sent by mistake"
                          >
                            <i className="bi bi-x-circle"></i> Withdraw
                          </button>
                        ) : (
                          <span className="small text-muted fst-italic">
                            {req.status === 'Approved' ? 'Approved (Locked)' : 'Processed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request New Option Modal */}
      <RequestListAddModal
        isOpen={requestOptionOpen}
        onClose={() => setRequestOptionOpen(false)}
        onRequestAdded={() => fetchMyRequests()}
      />
    </div>
  );
}

