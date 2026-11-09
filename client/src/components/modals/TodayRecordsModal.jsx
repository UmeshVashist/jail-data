/**
 * client/src/components/modals/TodayRecordsModal.jsx
 * Dedicated Modal for Today's Uploaded Records with In-Place Smooth Data Refresh
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function TodayRecordsModal({
  isOpen,
  onClose,
  onViewRecord,
  onEditRecord,
  onRequestEdit,
  onDeleteRecord,
  onRequestDelete
}) {
  const { isAdmin } = useAuth();
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const activeFetchIdRef = useRef(0);

  const fetchRecordsForDate = useCallback(async (date) => {
    const fetchId = ++activeFetchIdRef.current;
    setLoading(true);
    try {
      const target = (date && date.trim()) || todayStr;
      const res = await api.get(`/api/records?uploadDate=${encodeURIComponent(target)}&pageSize=All&t=${Date.now()}`);
      if (fetchId === activeFetchIdRef.current) {
        if (res && res.success) {
          const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
          setRecords(list);
        } else {
          setRecords([]);
        }
      }
    } catch (err) {
      console.error('Error fetching today records:', err);
      if (fetchId === activeFetchIdRef.current) {
        setRecords([]);
      }
    } finally {
      if (fetchId === activeFetchIdRef.current) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    }
  }, [todayStr]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(todayStr);
      fetchRecordsForDate(todayStr);
    } else {
      setHasLoadedOnce(false);
    }
  }, [isOpen, todayStr, fetchRecordsForDate]);

  if (!isOpen) return null;

  const isToday = selectedDate === todayStr;

  return createPortal(
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg" style={{ minHeight: '440px' }}>
          {/* Header */}
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className="stat-icon bg-success-subtle-custom text-success rounded-3 p-2 d-flex align-items-center justify-content-center"
                style={{ width: '42px', height: '42px' }}
              >
                <i className="bi bi-calendar-check fs-5"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold card-title-text mb-0">
                  {isToday ? "Today's Uploaded Records" : `Uploaded Records (${selectedDate})`}
                </h5>
                <span className="text-muted small">
                  {isToday ? "Records uploaded or added today" : `Records uploaded or added on ${selectedDate}`}{' '}
                  (<span className="badge bg-success text-white fw-bold">{records.length}</span>)
                </span>
              </div>
            </div>

            {/* Date Filter & Close */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="d-flex align-items-center today-date-filter-box rounded-2 px-2 py-1">
                <label className="small fw-semibold text-cyan mb-0 me-2 d-flex align-items-center gap-1" style={{ whiteSpace: 'nowrap' }}>
                  <i className="bi bi-calendar3"></i> Date:
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm compact-date-input border-0 bg-transparent text-white"
                  value={selectedDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDate(val);
                    if (val) fetchRecordsForDate(val);
                  }}
                  style={{ width: '135px' }}
                />
                {loading && (
                  <span className="spinner-border spinner-border-sm text-cyan ms-1" role="status" title="Loading data..."></span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info ms-1 px-2 py-1 rounded-2 fw-semibold"
                  onClick={() => {
                    setSelectedDate(todayStr);
                    fetchRecordsForDate(todayStr);
                  }}
                  title="Reset to Today"
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>Today
                </button>
              </div>

              <button
                type="button"
                className="btn-close ms-2"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-0 position-relative" style={{ minHeight: '340px' }}>
            {/* Top Loading Progress Line */}
            {loading && (
              <div
                className="position-absolute top-0 start-0 end-0"
                style={{
                  height: '3px',
                  background: 'linear-gradient(90deg, #0dcaf0, #20c997, #0dcaf0)',
                  zIndex: 20,
                  animation: 'shimmerBar 1.2s infinite'
                }}
              />
            )}

            <div className="table-responsive" style={{ maxHeight: '480px', minHeight: '340px', overflowY: 'auto' }}>
              <table
                className="table table-hover align-middle mb-0"
                style={{
                  transition: 'opacity 0.2s ease',
                  opacity: loading ? 0.6 : 1
                }}
              >
                <thead className="modal-table-thead sticky-top shadow-sm" style={{ zIndex: 10 }}>
                  <tr className="text-uppercase small text-muted">
                    <th className="ps-4">PID</th>
                    <th>Name</th>
                    <th>Father</th>
                    <th>UT No</th>
                    <th>Aadhar</th>
                    <th>Record Date</th>
                    <th>Remark</th>
                    <th className="text-end pe-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasLoadedOnce && loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5 text-muted" style={{ height: '280px' }}>
                        <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                        Loading ({selectedDate})...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5 text-muted" style={{ height: '280px' }}>
                        <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                        {isToday ? 'No records uploaded today yet.' : `No records uploaded on ${selectedDate}.`}
                      </td>
                    </tr>
                  ) : (
                    records.map((rec, idx) => (
                      <tr key={rec.id || rec.pid || idx}>
                        <td className="ps-4 fw-bold font-monospace">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-cyan fw-bold font-monospace text-decoration-none pid-link"
                            onClick={() => onViewRecord && onViewRecord(rec)}
                            title="Click to view details"
                          >
                            {rec.pid}
                          </button>
                        </td>
                        <td className="fw-semibold table-text-main">{rec.name}</td>
                        <td className="text-muted">{rec.father || '-'}</td>
                        <td className="font-monospace small table-text-main">{rec.utNo || '-'}</td>
                        <td className="font-monospace small table-text-main">{rec.aadharNo || '#N/A'}</td>
                        <td className="small text-muted">{rec.date || '-'}</td>
                        <td className="small table-text-main">{rec.remark || '-'}</td>
                        <td className="text-end pe-4">
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary p-1 px-2"
                              onClick={() => {
                                if (isAdmin || rec.canEdit) onEditRecord && onEditRecord(rec);
                                else onRequestEdit && onRequestEdit(rec);
                              }}
                              title="Edit Record"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger p-1 px-2"
                              onClick={() => {
                                if (isAdmin || rec.canDelete) onDeleteRecord && onDeleteRecord(rec);
                                else onRequestDelete && onRequestDelete(rec);
                              }}
                              title="Delete Record"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-2 d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Showing <strong className="table-text-main">{records.length}</strong> record(s)
            </span>
            <button type="button" className="btn btn-secondary btn-sm px-4" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
