/**
 * client/src/pages/PSList.jsx
 * Police Stations (PS List) Directory with 3-Way Search, Pagination & Admin Controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddPSModal from '../components/modals/AddPSModal';

export default function PSList() {
  const { isAdmin, canAccessPS, showToast } = useAuth();
  const [psQuery, setPsQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');
  const [stateQuery, setStateQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [stations, setStations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addPSOpen, setAddPSOpen] = useState(false);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ps', {
        ps: psQuery.trim(),
        district: districtQuery.trim(),
        state: stateQuery.trim(),
        page,
        pageSize
      });

      if (res && res.success) {
        setStations(res.data || []);
        if (res.pagination) {
          setTotalCount(res.pagination.total || 0);
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      showToast('Error loading Police Stations: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [psQuery, districtQuery, stateQuery, page, pageSize, showToast]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  if (!canAccessPS) {
    return (
      <div className="alert alert-danger p-4 rounded-3 text-center">
        <i className="bi bi-shield-lock-fill fs-2 d-block mb-2"></i>
        <h5>Access Denied</h5>
        <p className="small mb-0">You do not have permission to view the Police Stations list. Contact Admin.</p>
      </div>
    );
  }

  const handleDeletePS = async (item) => {
    if (!window.confirm(`Are you sure you want to delete police station "${item.psName || item.ps}"?`)) {
      return;
    }

    try {
      const res = await api.delete(`/api/ps/${item.id}`);
      if (res && res.success) {
        showToast(res.message || 'Police station deleted.', 'success');
        fetchStations();
      } else {
        showToast(res.message || 'Failed to delete police station.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error deleting police station.', 'danger');
    }
  };

  return (
    <div id="ps-list-view" className="view-section">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold page-title-text mb-1">Police Stations (PS List)</h3>
          <p className="text-muted small mb-0">Search, verify, and manage 15,000+ Police Stations across India</p>
        </div>
        <div className="mt-3 mt-md-0 d-flex align-items-center gap-2">
          <span className="badge rounded-pill px-3 py-2 bg-info bg-opacity-25 text-cyan border border-info border-opacity-25 fs-6 fw-bold">
            <i className="bi bi-shield-check me-1"></i> Found: {totalCount}
          </span>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
              onClick={() => setAddPSOpen(true)}
            >
              <i className="bi bi-plus-lg"></i> Add Police Station
            </button>
          )}
        </div>
      </div>

      {/* 3-Way Search Filter Bar */}
      <div className="filter-bar p-3 rounded-3 mb-4 custom-table-card">
        <div className="row g-2 align-items-center">
          {/* PS Name search with '/' shortcut */}
          <div className="col-12 col-md-4">
            <div className="position-relative">
              <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
              <input
                type="text"
                data-search-slash="true"
                className="form-control ps-5 pe-5 search-slash-input"
                placeholder="Search Police Station..."
                value={psQuery}
                onChange={(e) => {
                  setPsQuery(e.target.value);
                  setPage(1);
                }}
              />
              <span className="search-shortcut-kbd-wrap position-absolute top-50 end-0 translate-middle-y me-2">
                <kbd className="search-slash-kbd">/</kbd>
              </span>
            </div>
          </div>

          {/* District search */}
          <div className="col-6 col-md-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search District..."
              value={districtQuery}
              onChange={(e) => {
                setDistrictQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* State search */}
          <div className="col-6 col-md-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search State..."
              value={stateQuery}
              onChange={(e) => {
                setStateQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Reset button */}
          <div className="col-12 col-md-2 text-end">
            <button
              type="button"
              className="btn btn-outline-danger w-100"
              onClick={() => {
                setPsQuery('');
                setDistrictQuery('');
                setStateQuery('');
                setPage(1);
              }}
              title="Reset search filters"
            >
              <i className="bi bi-x-lg me-1"></i> Reset
            </button>
          </div>
        </div>
      </div>

      {/* PS Table */}
      <div className="custom-table-card p-3 rounded-3">
        <div className="table-responsive table-scroll-container">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small">
                <th style={{ width: '10%' }}>ID</th>
                <th style={{ width: '30%' }}>Police Station</th>
                <th style={{ width: '25%' }}>District</th>
                <th style={{ width: '25%' }}>State</th>
                {isAdmin && <th className="text-end" style={{ width: '10%' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                    Loading police stations...
                  </td>
                </tr>
              ) : !Array.isArray(stations) || stations.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center py-5 text-muted">
                    <i className="bi bi-shield-x fs-2 d-block mb-2 text-secondary"></i>
                    No police stations matched your search.
                  </td>
                </tr>
              ) : (
                (stations || []).map((st, idx) => (
                  <tr key={st.id || idx}>
                    <td className="text-muted font-monospace">{st.id}</td>
                    <td className="fw-bold table-text-main">{st.psName || st.ps}</td>
                    <td className="text-muted">{st.district || '-'}</td>
                    <td className="text-muted">{st.state || '-'}</td>
                    {isAdmin && (
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger p-1 px-2"
                          onClick={() => handleDeletePS(st)}
                          title="Delete Police Station"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between pt-3 mt-2 border-top border-secondary border-opacity-25 gap-2">
          <div className="d-flex align-items-center gap-2 text-muted small">
            <span>Show:</span>
            <select
              className="form-select form-select-sm w-auto custom-modern-dropdown"
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === 'All' ? 'All' : parseInt(e.target.value, 10));
                setPage(1);
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="All">All</option>
            </select>
            <span>stations per page</span>
          </div>

          <div className="d-flex align-items-center gap-1">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="text-white small px-2">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Police Station Modal */}
      <AddPSModal
        isOpen={addPSOpen}
        onClose={() => setAddPSOpen(false)}
        onPSAdded={() => fetchStations()}
      />
    </div>
  );
}

