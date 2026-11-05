/**
 * client/src/pages/AllRequests.jsx
 * Admin Requests Management Hub (Edit, Delete, and List-Add Requests)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ReviewEditRequestModal from '../components/modals/ReviewEditRequestModal';
import ReviewDeleteRequestModal from '../components/modals/ReviewDeleteRequestModal';
import ReviewListAddRequestModal from '../components/modals/ReviewListAddRequestModal';

export default function AllRequests() {
  const { isAdmin, showToast } = useAuth();
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [reviewEditReq, setReviewEditReq] = useState(null);
  const [reviewDelReq, setReviewDelReq] = useState(null);
  const [reviewListReq, setReviewListReq] = useState(null);

  const fetchAllRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [editRes, delRes, listRes] = await Promise.all([
        api.get('/api/edit-requests').catch(() => ({ data: [] })),
        api.get('/api/delete-requests').catch(() => ({ data: [] })),
        api.get('/api/list-add-requests').catch(() => ({ data: [] }))
      ]);

      const editItems = (editRes.data || []).map(r => ({ ...r, requestType: 'Edit' }));
      const delItems = (delRes.data || []).map(r => ({ ...r, requestType: 'Delete' }));
      const listItems = (listRes.data || []).map(r => ({ ...r, requestType: 'List Add' }));

      setRequests([...editItems, ...delItems, ...listItems]);
    } catch (err) {
      showToast('Error loading requests: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  if (!isAdmin) {
    return (
      <div className="alert alert-danger p-4 rounded-3 text-center">
        <i className="bi bi-shield-lock-fill fs-2 d-block mb-2"></i>
        <h5>Admin Access Required</h5>
        <p className="small mb-0">Only administrators have permission to review and process requests.</p>
      </div>
    );
  }

  // Filter logic
  const filtered = requests.filter(req => {
    if (typeFilter !== 'All' && req.requestType !== typeFilter) return false;
    if (statusFilter !== 'All' && (req.status || 'Pending').toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const pidMatch = (req.pid || '').toLowerCase().includes(q);
      const nameMatch = (req.name || '').toLowerCase().includes(q);
      const userMatch = (req.requestedBy || '').toLowerCase().includes(q);
      const optionMatch = (req.optionValue || '').toLowerCase().includes(q);
      if (!pidMatch && !nameMatch && !userMatch && !optionMatch) return false;
    }
    return true;
  });

  // KPI counts
  const totalPending = requests.filter(r => (r.status || 'Pending') === 'Pending').length;
  const editPending = requests.filter(r => r.requestType === 'Edit' && (r.status || 'Pending') === 'Pending').length;
  const delPending = requests.filter(r => r.requestType === 'Delete' && (r.status || 'Pending') === 'Pending').length;
  const listPending = requests.filter(r => r.requestType === 'List Add' && (r.status || 'Pending') === 'Pending').length;

  return (
    <div id="all-requests-view" className="view-section">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold text-white mb-1">Requests Management Hub</h3>
          <p className="text-muted small mb-0">Review, compare, approve, or reject user Edit, Delete, and List Add requests</p>
        </div>
        <div className="mt-3 mt-md-0">
          <button
            type="button"
            className="btn btn-outline-cyan btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2"
            onClick={fetchAllRequests}
          >
            <i className="bi bi-arrow-clockwise"></i> Refresh Requests
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card stat-card h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Total Pending</span>
                <h2 className="fw-bold text-warning mb-0 mt-1">{totalPending}</h2>
              </div>
              <div className="stat-icon bg-warning-subtle-custom">
                <i className="bi bi-clock-history"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card stat-card h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Edit Requests</span>
                <h2 className="fw-bold text-cyan mb-0 mt-1">{editPending}</h2>
              </div>
              <div className="stat-icon bg-info-subtle-custom">
                <i className="bi bi-pencil-square"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card stat-card h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Delete Requests</span>
                <h2 className="fw-bold text-danger mb-0 mt-1">{delPending}</h2>
              </div>
              <div className="stat-icon bg-danger-subtle-custom">
                <i className="bi bi-trash3"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card stat-card h-100 p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">List Add Requests</span>
                <h2 className="fw-bold text-success mb-0 mt-1">{listPending}</h2>
              </div>
              <div className="stat-icon bg-success-subtle-custom">
                <i className="bi bi-plus-square"></i>
              </div>
            </div>
          </div>
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
                placeholder="Search by PID, Name, User, Option..."
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
                id="filter-all-requests-type"
                className="form-select custom-modern-dropdown"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="All">All Request Types</option>
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
                id="filter-all-requests-status"
                className="form-select custom-modern-dropdown"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Pending">Pending Only</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="All">All Statuses</option>
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
                setStatusFilter('Pending');
              }}
              title="Reset filters"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="custom-table-card p-3 rounded-3">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small">
                <th>Type</th>
                <th>PID / Target</th>
                <th>Name / Option Value</th>
                <th>Requested By</th>
                <th>Reason / Remark</th>
                <th>Request Date/Time</th>
                <th>Status</th>
                <th className="text-end">Actions / Review</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                    Loading requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                    No requests match the current filters.
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

                  return (
                    <tr key={req.id || idx}>
                      <td>
                        <span className={`badge py-1 px-2 fw-semibold ${typeBadgeClass}`}>
                          {req.requestType}
                        </span>
                      </td>
                      <td className="fw-bold text-cyan font-monospace">{req.pid || '-'}</td>
                      <td className="fw-semibold text-white">{req.name || req.optionValue || '-'}</td>
                      <td><span className="badge bg-secondary">{req.requestedBy || '-'}</span></td>
                      <td className="small text-muted text-truncate" style={{ maxWidth: '200px' }}>
                        {req.reason || req.remark || '-'}
                      </td>
                      <td className="small text-muted">{req.requestedDate} {req.requestedTime}</td>
                      <td>
                        <span className={`badge py-1 px-2 fw-bold ${statusClass}`}>
                          {req.status || 'Pending'}
                        </span>
                      </td>
                      <td className="text-end">
                        {req.status === 'Pending' ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary px-3 py-1 fw-semibold"
                            onClick={() => {
                              if (req.requestType === 'Edit') setReviewEditReq(req);
                              else if (req.requestType === 'Delete') setReviewDelReq(req);
                              else if (req.requestType === 'List Add') setReviewListReq(req);
                            }}
                          >
                            Review &rarr;
                          </button>
                        ) : (
                          <span className="small text-muted">
                            Action by {req.actionBy || 'Admin'}
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

      {/* Review Modals */}
      <ReviewEditRequestModal
        isOpen={!!reviewEditReq}
        request={reviewEditReq}
        onClose={() => setReviewEditReq(null)}
        onActionCompleted={() => fetchAllRequests()}
      />
      <ReviewDeleteRequestModal
        isOpen={!!reviewDelReq}
        request={reviewDelReq}
        onClose={() => setReviewDelReq(null)}
        onActionCompleted={() => fetchAllRequests()}
      />
      <ReviewListAddRequestModal
        isOpen={!!reviewListReq}
        request={reviewListReq}
        onClose={() => setReviewListReq(null)}
        onActionCompleted={() => fetchAllRequests()}
      />
    </div>
  );
}

