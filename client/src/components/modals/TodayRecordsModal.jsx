/**
 * client/src/components/modals/TodayRecordsModal.jsx
 * Dedicated Modal for Today's Uploaded Records with Date Picker Filter
 */

import React, { useState, useEffect, useCallback } from 'react';
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

  const fetchRecordsForDate = useCallback(async (date) => {
    setLoading(true);
    try {
      const target = (date && date.trim()) || todayStr;
      const res = await api.get(`/api/records?uploadDate=${encodeURIComponent(target)}&pageSize=All&t=${Date.now()}`);
      if (res && res.success) {
        const list = res.data?.records || (Array.isArray(res.data) ? res.data : []);
        setRecords(list);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error('Error fetching today records:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(todayStr);
      fetchRecordsForDate(todayStr);
    }
  }, [isOpen, todayStr, fetchRecordsForDate]);

  if (!isOpen) return null;

  const isToday = selectedDate === todayStr;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg" style={{ background: 'var(--card-bg, #0b1329)' }}>
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
                <h5 className="modal-title fw-bold text-white mb-0">
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
              <div className="d-flex align-items-center bg-dark bg-opacity-50 border border-secondary border-opacity-50 rounded-2 px-2 py-1">
                <label className="small fw-semibold text-cyan mb-0 me-2 d-flex align-items-center gap-1" style={{ whiteSpace: 'nowrap' }}>
                  <i className="bi bi-calendar3"></i> Date:
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm text-white compact-date-input border-0 bg-transparent"
                  value={selectedDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDate(val);
                    fetchRecordsForDate(val);
                  }}
                  style={{ width: '135px' }}
                />
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
                className="btn-close btn-close-white ms-2"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-0">
            <div className="table-responsive" style={{ maxHeight: '480px', overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="sticky-top shadow-sm" style={{ zIndex: 10, background: 'rgba(10, 16, 36, 0.95)' }}>
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
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5 text-muted">
                        <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                        Loading records for {selectedDate}...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5 text-muted">
                        <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                        {isToday ? 'No records uploaded today yet.' : `No records uploaded on ${selectedDate}.`}
                      </td>
                    </tr>
                  ) : (
                    records.map((rec, idx) => (
                      <tr key={rec.id || idx}>
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
                        <td className="fw-semibold text-white">{rec.name}</td>
                        <td className="text-muted">{rec.father || '-'}</td>
                        <td>
                          <span className="badge badge-ut-pill font-monospace">{rec.utNo || '-'}</span>
                        </td>
                        <td className="font-monospace small text-white">{rec.aadharNo || '#N/A'}</td>
                        <td className="small text-muted">{rec.date || '-'}</td>
                        <td>
                          <span className="badge bg-primary bg-opacity-25 text-cyan border border-cyan border-opacity-25 py-1 px-2">
                            {rec.remark || 'None'}
                          </span>
                        </td>
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
              Showing <strong className="text-white">{records.length}</strong> record{records.length === 1 ? '' : 's'}
            </span>
            <button type="button" className="btn btn-secondary btn-sm px-4" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

