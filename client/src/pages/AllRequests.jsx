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

  // Bulk Selection State
  const [selectedRequests, setSelectedRequests] = useState(new Map());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modals state
  const [reviewEditReq, setReviewEditReq] = useState(null);
  const [reviewDelReq, setReviewDelReq] = useState(null);
  const [reviewListReq, setReviewListReq] = useState(null);

  const fetchAllRequests = useCallback(async () => {
    setLoading(true);
    setSelectedRequests(new Map());
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
  const filtered = (Array.isArray(requests) ? requests : []).filter(req => {
    if (!req) return false;
    if (typeFilter !== 'All' && req.requestType !== typeFilter) return false;
    if (statusFilter !== 'All' && String(req.status || 'Pending').toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const pidMatch = String(req.pid || '').toLowerCase().includes(q);
      const nameMatch = String(req.name || '').toLowerCase().includes(q);
      const userMatch = String(req.requestedBy || '').toLowerCase().includes(q);
      const optionMatch = String(req.optionValue || '').toLowerCase().includes(q);
      if (!pidMatch && !nameMatch && !userMatch && !optionMatch) return false;
    }
    return true;
  });

  // Filtered Pending items for bulk selection
  const pendingFiltered = filtered.filter(r => (r.status || 'Pending') === 'Pending');
  const isAllSelected = pendingFiltered.length > 0 && pendingFiltered.every(r => selectedRequests.has(`${r.requestType}_${r.id}`));

  const toggleSelect = (req) => {
    const key = `${req.requestType}_${req.id}`;
    setSelectedRequests(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, req);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRequests(new Map());
    } else {
      const next = new Map();
      pendingFiltered.forEach(r => next.set(`${r.requestType}_${r.id}`, r));
      setSelectedRequests(next);
    }
  };

  const handleBulkApprove = async () => {
    const items = Array.from(selectedRequests.values());
    if (items.length === 0) return;
    if (!window.confirm(`Are you sure you want to APPROVE ${items.length} selected request(s)?`)) return;

    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        let url = '';
        if (item.requestType === 'Edit') url = `/api/edit-requests/${item.id}/approve`;
        else if (item.requestType === 'Delete') url = `/api/delete-requests/${item.id}/approve`;
        else if (item.requestType === 'List Add') url = `/api/list-add-requests/${item.id}/approve`;

        if (url) {
          const res = await api.post(url);
          if (res && res.success) successCount++;
          else failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setBulkProcessing(false);
    setSelectedRequests(new Map());
    showToast(`Bulk Approval complete: ${successCount} approved${failCount > 0 ? `, ${failCount} failed` : ''}.`, successCount > 0 ? 'success' : 'danger');
    fetchAllRequests();
  };

  const handleBulkReject = async () => {
    const items = Array.from(selectedRequests.values());
    if (items.length === 0) return;
    if (!window.confirm(`Are you sure you want to REJECT ${items.length} selected request(s)?`)) return;

    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        let url = '';
        if (item.requestType === 'Edit') url = `/api/edit-requests/${item.id}/reject`;
        else if (item.requestType === 'Delete') url = `/api/delete-requests/${item.id}/reject`;
        else if (item.requestType === 'List Add') url = `/api/list-add-requests/${item.id}/reject`;

        if (url) {
          const res = await api.post(url);
          if (res && res.success) successCount++;
          else failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setBulkProcessing(false);
    setSelectedRequests(new Map());
    showToast(`Bulk Rejection complete: ${successCount} rejected${failCount > 0 ? `, ${failCount} failed` : ''}.`, successCount > 0 ? 'warning' : 'danger');
    fetchAllRequests();
  };

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
          <h3 className="fw-bold page-title-text mb-1">Requests Management Hub</h3>
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

      {/* Bulk Action Banner */}
      {selectedRequests.size > 0 && (
        <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between p-2.5 px-3 mb-3 rounded-3 shadow-sm border border-info border-opacity-50">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-check2-square fs-5 text-cyan"></i>
            <span className="fw-bold">{selectedRequests.size}</span> pending request{selectedRequests.size === 1 ? '' : 's'} selected
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap mt-2 mt-sm-0">
            <button
              type="button"
              className="btn btn-success btn-sm px-3 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? (
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              ) : (
                <i className="bi bi-check-circle-fill"></i>
              )}
              Approve Selected ({selectedRequests.size})
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm px-3 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
              onClick={handleBulkReject}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? (
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              ) : (
                <i className="bi bi-x-circle-fill"></i>
              )}
              Reject Selected ({selectedRequests.size})
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm px-2.5"
              onClick={() => setSelectedRequests(new Map())}
              disabled={bulkProcessing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="custom-table-card p-3 rounded-3">
        <div className="table-responsive table-scroll-container">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small">
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={pendingFiltered.length === 0}
                    title="Select all pending requests"
                  />
                </th>
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
                  <td colSpan="9" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                    Loading requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-5 text-muted">
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

                  const isPending = (req.status || 'Pending') === 'Pending';
                  const isSelected = selectedRequests.has(`${req.requestType}_${req.id}`);

                  return (
                    <tr key={req.id || idx} className={isSelected ? 'table-active' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        {isPending ? (
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={isSelected}
                            onChange={() => toggleSelect(req)}
                          />
                        ) : (
                          <span className="text-muted opacity-50">&bull;</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge py-1 px-2 fw-semibold ${typeBadgeClass}`}>
                          {req.requestType}
                        </span>
                      </td>
                      <td className="fw-bold text-cyan font-monospace">{req.pid || '-'}</td>
                      <td className="fw-semibold table-text-main">{req.name || req.optionValue || '-'}</td>
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

