/**
 * client/src/pages/AllRequests.jsx
 * Admin Requests Management Hub (Edit, Delete, and List-Add Requests)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ReviewEditRequestModal from '../components/modals/ReviewEditRequestModal';
import ReviewDeleteRequestModal from '../components/modals/ReviewDeleteRequestModal';
import ReviewListAddRequestModal from '../components/modals/ReviewListAddRequestModal';

export default function AllRequests() {
  const { isAdmin, showToast } = useAuth();
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
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

  const fetchAllRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
      showToast('Error loading requests: ' + (err.message || 'Error'), 'danger');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  // Instant real-time update when an individual request is reviewed
  const handleActionCompleted = (actionResult) => {
    if (actionResult && actionResult.id && actionResult.requestType) {
      setRequests(prev => prev.map(r => 
        (r.id === actionResult.id && r.requestType === actionResult.requestType)
          ? { ...r, status: actionResult.status, actionBy: 'Admin' }
          : r
      ));
    }
    fetchAllRequests(true);
  };

  if (!isAdmin) {
    return (
      <div className="alert alert-danger p-4 rounded-3 text-center">
        <i className="bi bi-shield-lock-fill fs-2 d-block mb-2"></i>
        <h5>Admin Access Required</h5>
        <p className="small mb-0">Only Administrators are allowed to review, approve, or reject requests.</p>
      </div>
    );
  }

  // Filter logic
  const filtered = (Array.isArray(requests) ? requests : []).filter(req => {
    if (!req) return false;
    
    // Type Filter
    if (typeFilter !== 'All') {
      const cleanType = String(typeFilter).toLowerCase().replace(/[^a-z0-9]/g, '');
      const reqType = String(req.requestType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanType !== reqType) return false;
    }

    // Status Filter
    if (statusFilter !== 'All') {
      const cleanStatus = String(statusFilter).toLowerCase().trim();
      const reqStatus = String(req.status || 'Pending').toLowerCase().trim();
      if (cleanStatus !== reqStatus) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const pidMatch = String(req.pid || '').toLowerCase().includes(q);
      const nameMatch = String(req.name || '').toLowerCase().includes(q);
      const userMatch = String(req.requestedBy || '').toLowerCase().includes(q);
      const optionMatch = String(req.optionValue || '').toLowerCase().includes(q);
      const reasonMatch = String(req.reason || req.remark || '').toLowerCase().includes(q);
      if (!pidMatch && !nameMatch && !userMatch && !optionMatch && !reasonMatch) return false;
    }

    return true;
  });

  // Selection state for all currently filtered requests
  const isAllSelected = filtered.length > 0 && filtered.every(r => selectedRequests.has(`${r.requestType}_${r.id}`));
  const isIndeterminate = !isAllSelected && filtered.some(r => selectedRequests.has(`${r.requestType}_${r.id}`));

  const headerCheckboxRef = useRef(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

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
      setSelectedRequests(prev => {
        const next = new Map(prev);
        filtered.forEach(r => next.delete(`${r.requestType}_${r.id}`));
        return next;
      });
    } else {
      setSelectedRequests(prev => {
        const next = new Map(prev);
        filtered.forEach(r => next.set(`${r.requestType}_${r.id}`, r));
        return next;
      });
    }
  };

  const handleBulkApprove = async () => {
    const items = Array.from(selectedRequests.values()).filter(r => (r.status || 'Pending') === 'Pending');
    if (items.length === 0) return;
    if (!window.confirm(`Are you sure you want to approve the selected ${items.length} pending request(s)?`)) return;

    // Real-time optimistic update
    const selectedKeys = new Set(items.map(item => `${item.requestType}_${item.id}`));
    setRequests(prev => prev.map(r => 
      selectedKeys.has(`${r.requestType}_${r.id}`)
        ? { ...r, status: 'Approved', actionBy: 'Admin' }
        : r
    ));
    setSelectedRequests(prev => {
      const next = new Map(prev);
      selectedKeys.forEach(k => next.delete(k));
      return next;
    });

    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    const results = await Promise.allSettled(items.map(item => {
      let url = '';
      if (item.requestType === 'Edit') url = `/api/edit-requests/${item.id}/approve`;
      else if (item.requestType === 'Delete') url = `/api/delete-requests/${item.id}/approve`;
      else if (item.requestType === 'List Add') url = `/api/list-add-requests/${item.id}/approve`;
      return url ? api.post(url) : Promise.reject(new Error('Invalid request type'));
    }));

    results.forEach(res => {
      if (res.status === 'fulfilled' && res.value && res.value.success) successCount++;
      else failCount++;
    });

    setBulkProcessing(false);
    showToast(`Bulk approval completed: ${successCount} request(s) approved${failCount > 0 ? `, ${failCount} failed` : ''}.`, successCount > 0 ? 'success' : 'danger');
    fetchAllRequests(true);
  };

  const handleBulkReject = async () => {
    const items = Array.from(selectedRequests.values()).filter(r => (r.status || 'Pending') === 'Pending');
    if (items.length === 0) return;
    if (!window.confirm(`Are you sure you want to reject the selected ${items.length} pending request(s)?`)) return;

    // Real-time optimistic update
    const selectedKeys = new Set(items.map(item => `${item.requestType}_${item.id}`));
    setRequests(prev => prev.map(r => 
      selectedKeys.has(`${r.requestType}_${r.id}`)
        ? { ...r, status: 'Rejected', actionBy: 'Admin' }
        : r
    ));
    setSelectedRequests(prev => {
      const next = new Map(prev);
      selectedKeys.forEach(k => next.delete(k));
      return next;
    });

    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    const results = await Promise.allSettled(items.map(item => {
      let url = '';
      if (item.requestType === 'Edit') url = `/api/edit-requests/${item.id}/reject`;
      else if (item.requestType === 'Delete') url = `/api/delete-requests/${item.id}/reject`;
      else if (item.requestType === 'List Add') url = `/api/list-add-requests/${item.id}/reject`;
      return url ? api.post(url) : Promise.reject(new Error('Invalid request type'));
    }));

    results.forEach(res => {
      if (res.status === 'fulfilled' && res.value && res.value.success) successCount++;
      else failCount++;
    });

    setBulkProcessing(false);
    showToast(`Bulk rejection completed: ${successCount} request(s) rejected${failCount > 0 ? `, ${failCount} failed` : ''}.`, successCount > 0 ? 'warning' : 'danger');
    fetchAllRequests(true);
  };

  // Permanent Delete for single Approved Delete Request (Admin Only)
  const handlePermanentDeleteSingle = async (req) => {
    if (!window.confirm(`Are you sure you want to permanently delete record PID: ${req.pid} (${req.name}) from the database? This cannot be undone.`)) return;

    const key = `${req.requestType}_${req.id}`;
    setRequests(prev => prev.filter(r => !(r.id === req.id && r.requestType === req.requestType)));
    setSelectedRequests(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

    try {
      const res = await api.delete(`/api/delete-requests/${req.id}/permanent`);
      showToast(res.message || `Record PID ${req.pid} permanently deleted from the database.`, 'success');
    } catch (err) {
      showToast('Error permanently deleting record: ' + (err.message || 'Error'), 'danger');
      fetchAllRequests(true);
    }
  };

  // Restore single Approved Delete Request back to active records (Admin Only)
  const handleRestoreSingle = async (req) => {
    if (!window.confirm(`Are you sure you want to restore record PID: ${req.pid} (${req.name}) to active data?`)) return;

    const key = `${req.requestType}_${req.id}`;
    setRequests(prev => prev.filter(r => !(r.id === req.id && r.requestType === req.requestType)));
    setSelectedRequests(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

    try {
      const res = await api.post(`/api/delete-requests/${req.id}/restore`);
      showToast(res.message || `Record PID ${req.pid} restored to active data successfully.`, 'success');
    } catch (err) {
      showToast('Error restoring record: ' + (err.message || 'Error'), 'danger');
      fetchAllRequests(true);
    }
  };

  // Bulk Permanent Delete for selected Approved Delete Requests (Admin Only)
  const handleBulkPermanentDelete = async () => {
    const items = Array.from(selectedRequests.values()).filter(r => r.requestType === 'Delete' && r.status === 'Approved');
    if (items.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete the selected ${items.length} record(s) from the database? This cannot be undone.`)) return;

    const selectedKeys = new Set(items.map(item => `${item.requestType}_${item.id}`));
    setRequests(prev => prev.filter(r => !selectedKeys.has(`${r.requestType}_${r.id}`)));
    setSelectedRequests(prev => {
      const next = new Map(prev);
      selectedKeys.forEach(k => next.delete(k));
      return next;
    });

    setBulkProcessing(true);
    try {
      const res = await api.post('/api/delete-requests/bulk-permanent', { ids: items.map(i => i.id) });
      showToast(res.message || `Selected ${items.length} record(s) permanently deleted from the database.`, 'success');
    } catch (err) {
      showToast('Error permanently deleting records: ' + (err.message || 'Error'), 'danger');
      fetchAllRequests(true);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Bulk Restore for selected Approved Delete Requests (Admin Only)
  const handleBulkRestore = async () => {
    const items = Array.from(selectedRequests.values()).filter(r => r.requestType === 'Delete' && r.status === 'Approved');
    if (items.length === 0) return;
    if (!window.confirm(`Are you sure you want to restore the selected ${items.length} record(s) back to active data?`)) return;

    const selectedKeys = new Set(items.map(item => `${item.requestType}_${item.id}`));
    setRequests(prev => prev.filter(r => !selectedKeys.has(`${r.requestType}_${r.id}`)));
    setSelectedRequests(prev => {
      const next = new Map(prev);
      selectedKeys.forEach(k => next.delete(k));
      return next;
    });

    setBulkProcessing(true);
    try {
      const res = await api.post('/api/delete-requests/bulk-restore', { ids: items.map(i => i.id) });
      showToast(res.message || `Selected ${items.length} record(s) restored to active data successfully.`, 'success');
    } catch (err) {
      showToast('Error restoring records: ' + (err.message || 'Error'), 'danger');
      fetchAllRequests(true);
    } finally {
      setBulkProcessing(false);
    }
  };

  // KPI counts
  const totalPending = requests.filter(r => (r.status || 'Pending') === 'Pending').length;
  const editPending = requests.filter(r => r.requestType === 'Edit' && (r.status || 'Pending') === 'Pending').length;
  const editApproved = requests.filter(r => r.requestType === 'Edit' && r.status === 'Approved').length;
  const delPending = requests.filter(r => r.requestType === 'Delete' && (r.status || 'Pending') === 'Pending').length;
  const delApproved = requests.filter(r => r.requestType === 'Delete' && r.status === 'Approved').length;
  const listPending = requests.filter(r => r.requestType === 'List Add' && (r.status || 'Pending') === 'Pending').length;
  const listApproved = requests.filter(r => r.requestType === 'List Add' && r.status === 'Approved').length;

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

      {/* KPI Cards (Clickable to Filter Requests) */}
      <div className="row g-3 mb-4">
        {/* Total Pending */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className={`card stat-card h-100 p-3 ${typeFilter === 'All' && statusFilter === 'Pending' ? 'border-primary border-2 shadow-sm' : ''}`}
            onClick={() => {
              if (typeFilter === 'All' && statusFilter === 'Pending') {
                setStatusFilter('All');
              } else {
                setTypeFilter('All');
                setStatusFilter('Pending');
              }
            }}
            style={{ cursor: 'pointer' }}
            title="Click to filter All Pending requests (Click again to show all statuses)"
          >
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

        {/* Edit Requests */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className={`card stat-card h-100 p-3 ${typeFilter === 'Edit' ? 'border-cyan border-2 shadow-sm' : ''}`}
            onClick={() => {
              if (typeFilter === 'Edit' && statusFilter === 'All') {
                setTypeFilter('All');
              } else {
                setTypeFilter('Edit');
                setStatusFilter('All');
              }
            }}
            style={{ cursor: 'pointer' }}
            title="Click to view all Edit requests (Click again to show all types)"
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Edit Requests</span>
                <div 
                  className="d-flex align-items-baseline gap-2 mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTypeFilter('Edit');
                    setStatusFilter('Pending');
                  }}
                  title="Click to filter Pending Edit requests"
                >
                  <h2 className="fw-bold text-cyan mb-0">{editPending}</h2>
                  <span className="small text-muted">Pending</span>
                </div>
                {editApproved > 0 && (
                  <div className="mt-1">
                    <span 
                      className="badge bg-cyan bg-opacity-25 text-cyan border border-cyan border-opacity-25 px-1.5 py-0.5"
                      style={{ cursor: 'pointer', fontSize: '0.72rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTypeFilter('Edit');
                        setStatusFilter('Approved');
                      }}
                      title="Click to view Approved Edit requests"
                    >
                      {editApproved} Approved
                    </span>
                  </div>
                )}
              </div>
              <div className="stat-icon bg-info-subtle-custom">
                <i className="bi bi-pencil-square"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Requests */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className={`card stat-card h-100 p-3 ${typeFilter === 'Delete' ? 'border-danger border-2 shadow-sm' : ''}`}
            onClick={() => {
              if (typeFilter === 'Delete' && statusFilter === 'All') {
                setTypeFilter('All');
              } else {
                setTypeFilter('Delete');
                setStatusFilter('All');
              }
            }}
            style={{ cursor: 'pointer' }}
            title="Click to view all Delete requests (Click again to show all types)"
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Delete Requests</span>
                <div 
                  className="d-flex align-items-baseline gap-2 mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTypeFilter('Delete');
                    setStatusFilter('Pending');
                  }}
                  title="Click to filter Pending Delete requests"
                >
                  <h2 className="fw-bold text-danger mb-0">{delPending}</h2>
                  <span className="small text-muted">Pending</span>
                </div>
                {delApproved > 0 && (
                  <div className="mt-1">
                    <span 
                      className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 px-1.5 py-0.5"
                      style={{ cursor: 'pointer', fontSize: '0.72rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTypeFilter('Delete');
                        setStatusFilter('Approved');
                      }}
                      title="Click to view Approved Delete requests"
                    >
                      {delApproved} Approved for Delete
                    </span>
                  </div>
                )}
              </div>
              <div className="stat-icon bg-danger-subtle-custom">
                <i className="bi bi-trash3"></i>
              </div>
            </div>
          </div>
        </div>

        {/* List Add Requests */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div
            className={`card stat-card h-100 p-3 ${typeFilter === 'List Add' ? 'border-success border-2 shadow-sm' : ''}`}
            onClick={() => {
              if (typeFilter === 'List Add' && statusFilter === 'All') {
                setTypeFilter('All');
              } else {
                setTypeFilter('List Add');
                setStatusFilter('All');
              }
            }}
            style={{ cursor: 'pointer' }}
            title="Click to view all List Add requests (Click again to show all types)"
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">List Add Requests</span>
                <div 
                  className="d-flex align-items-baseline gap-2 mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTypeFilter('List Add');
                    setStatusFilter('Pending');
                  }}
                  title="Click to filter Pending List Add requests"
                >
                  <h2 className="fw-bold text-success mb-0">{listPending}</h2>
                  <span className="small text-muted">Pending</span>
                </div>
                {listApproved > 0 && (
                  <div className="mt-1">
                    <span 
                      className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-1.5 py-0.5"
                      style={{ cursor: 'pointer', fontSize: '0.72rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTypeFilter('List Add');
                        setStatusFilter('Approved');
                      }}
                      title="Click to view Approved List Add requests"
                    >
                      {listApproved} Approved
                    </span>
                  </div>
                )}
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
                <option value="All">All Statuses</option>
                <option value="Pending">Pending Only</option>
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
              title="Reset all filters"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Active Filter Indicator */}
        {(typeFilter !== 'All' || statusFilter !== 'All' || searchQuery.trim()) && (
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2 pt-2 border-top border-secondary border-opacity-25 small text-muted">
            <div className="d-flex align-items-center gap-1.5 flex-wrap">
              <span>Active Filters:</span>
              {typeFilter !== 'All' && (
                <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 d-inline-flex align-items-center gap-1">
                  Type: {typeFilter}
                  <i className="bi bi-x" style={{ cursor: 'pointer' }} onClick={() => setTypeFilter('All')}></i>
                </span>
              )}
              {statusFilter !== 'All' && (
                <span className="badge bg-info bg-opacity-25 text-cyan border border-cyan border-opacity-25 d-inline-flex align-items-center gap-1">
                  Status: {statusFilter}
                  <i className="bi bi-x" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('All')}></i>
                </span>
              )}
              {searchQuery.trim() && (
                <span className="badge bg-secondary bg-opacity-25 text-light border border-secondary border-opacity-25 d-inline-flex align-items-center gap-1">
                  Search: "{searchQuery.trim()}"
                  <i className="bi bi-x" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')}></i>
                </span>
              )}
            </div>
            <span>Showing <strong className="text-cyan">{filtered.length}</strong> of <strong>{requests.length}</strong> requests</span>
          </div>
        )}
      </div>

      {/* Bulk Action Banner */}
      {selectedRequests.size > 0 && (() => {
        const selectedItems = Array.from(selectedRequests.values());
        const pendingItems = selectedItems.filter(r => (r.status || 'Pending') === 'Pending');
        const approvedDelItems = selectedItems.filter(r => r.requestType === 'Delete' && r.status === 'Approved');

        return (
          <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between p-2.5 px-3 mb-3 rounded-3 shadow-sm border border-info border-opacity-50">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <i className="bi bi-check2-square fs-5 text-cyan"></i>
              <span className="fw-bold">{selectedRequests.size}</span> item{selectedRequests.size === 1 ? '' : 's'} selected
              {pendingItems.length > 0 && (
                <span className="badge bg-warning text-dark">{pendingItems.length} Pending</span>
              )}
              {approvedDelItems.length > 0 && (
                <span className="badge bg-danger text-white">{approvedDelItems.length} Approved for Deletion</span>
              )}
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap mt-2 mt-sm-0">
              {pendingItems.length > 0 && (
                <>
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
                    Approve Selected ({pendingItems.length})
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
                    Reject Selected ({pendingItems.length})
                  </button>
                </>
              )}

              {approvedDelItems.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm px-3 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
                    onClick={handleBulkPermanentDelete}
                    disabled={bulkProcessing}
                    title="Permanently remove selected records from database"
                  >
                    {bulkProcessing ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    ) : (
                      <i className="bi bi-trash3-fill"></i>
                    )}
                    Permanently Delete Selected ({approvedDelItems.length})
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm px-3 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
                    onClick={handleBulkRestore}
                    disabled={bulkProcessing}
                    title="Restore selected records back to active records"
                  >
                    {bulkProcessing ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    ) : (
                      <i className="bi bi-arrow-counterclockwise"></i>
                    )}
                    Restore to Main Data ({approvedDelItems.length})
                  </button>
                </>
              )}

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
        );
      })()}

      {/* Requests Table */}
      <div className="custom-table-card p-3 rounded-3">
        <div className="table-responsive table-scroll-container">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small">
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    className="form-check-input"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={filtered.length === 0}
                    title={isAllSelected ? "Deselect all visible requests" : "Select all visible requests"}
                    aria-label="Select all requests"
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
                    <i className="bi bi-funnel fs-2 d-block mb-2 text-secondary"></i>
                    <div className="fw-semibold">No requests match the current filters.</div>
                    <div className="small text-muted mt-1">
                      Type: <span className="badge bg-secondary me-1">{typeFilter}</span>
                      Status: <span className="badge bg-secondary me-1">{statusFilter}</span>
                      {searchQuery && <span className="badge bg-secondary">Search: "{searchQuery}"</span>}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-cyan btn-sm mt-3 px-3 py-1.5 fw-semibold"
                      onClick={() => {
                        setSearchQuery('');
                        setTypeFilter('All');
                        setStatusFilter('All');
                      }}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1"></i> Reset All Filters
                    </button>
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
                  const isApprovedDelete = req.requestType === 'Delete' && req.status === 'Approved';
                  const isSelected = selectedRequests.has(`${req.requestType}_${req.id}`);

                  return (
                    <tr 
                      key={`${req.requestType}_${req.id || idx}`} 
                      className={isSelected ? 'table-active' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        if (e.target.closest('button, a, input, select, .badge[onClick]')) return;
                        toggleSelect(req);
                      }}
                      title="Click anywhere on the row to toggle selection"
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={isSelected}
                          onChange={() => toggleSelect(req)}
                          aria-label={`Select ${req.requestType} request #${req.id}`}
                        />
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
                        {isPending ? (
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
                        ) : isApprovedDelete ? (
                          <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                              onClick={() => handlePermanentDeleteSingle(req)}
                              title="Permanently Delete this record from Database"
                            >
                              <i className="bi bi-trash3-fill"></i> Permanently Delete
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                              onClick={() => handleRestoreSingle(req)}
                              title="Restore Record back to Main Active Data Records"
                            >
                              <i className="bi bi-arrow-counterclockwise"></i> Restore to Main Data
                            </button>
                          </div>
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
        onActionCompleted={handleActionCompleted}
      />
      <ReviewDeleteRequestModal
        isOpen={!!reviewDelReq}
        request={reviewDelReq}
        onClose={() => setReviewDelReq(null)}
        onActionCompleted={handleActionCompleted}
      />
      <ReviewListAddRequestModal
        isOpen={!!reviewListReq}
        request={reviewListReq}
        onClose={() => setReviewListReq(null)}
        onActionCompleted={handleActionCompleted}
      />
    </div>
  );
}

