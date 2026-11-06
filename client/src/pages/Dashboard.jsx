/**
 * client/src/pages/Dashboard.jsx
 * Dashboard Overview with Stat Cards & Recent Activities
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddRecordModal from '../components/modals/AddRecordModal';
import ViewRecordModal from '../components/modals/ViewRecordModal';
import EditRecordModal from '../components/modals/EditRecordModal';
import RequestEditModal from '../components/modals/RequestEditModal';
import DeleteRecordModal from '../components/modals/DeleteRecordModal';
import RequestDeleteModal from '../components/modals/RequestDeleteModal';
import TodayRecordsModal from '../components/modals/TodayRecordsModal';
import TotalUsersModal from '../components/modals/TotalUsersModal';

export default function Dashboard() {
  const { user, isAdmin, canImport } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRecords: 0,
    todayRecords: 0,
    totalUsers: 0,
    todayImports: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);

  // Modals state
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [reqEditRecord, setReqEditRecord] = useState(null);
  const [delRecord, setDelRecord] = useState(null);
  const [reqDelRecord, setReqDelRecord] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/api/records/dashboard');
      if (res && res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Optimistic Dashboard Updates (Instant table refresh without reloading)
  const handleRecordAdded = (newRecord) => {
    if (newRecord) {
      setStats(prev => ({
        ...prev,
        totalRecords: (prev.totalRecords || 0) + 1,
        todayRecords: (prev.todayRecords || 0) + 1,
        recentActivities: [newRecord, ...(prev.recentActivities || []).slice(0, 9)]
      }));
    }
    fetchDashboardData();
  };

  const handleRecordUpdated = (updatedRecord) => {
    if (updatedRecord) {
      setStats(prev => ({
        ...prev,
        recentActivities: (prev.recentActivities || []).map(r =>
          (String(r.id) === String(updatedRecord.id) || String(r.pid) === String(updatedRecord.pid) || String(r.rowIndex) === String(updatedRecord.rowIndex))
            ? { ...r, ...updatedRecord }
            : r
        )
      }));
    }
    fetchDashboardData();
  };

  const handleRecordDeleted = (deletedRecord) => {
    if (deletedRecord) {
      const delId = deletedRecord.id || deletedRecord.rowIndex || deletedRecord.pid;
      setStats(prev => ({
        ...prev,
        totalRecords: Math.max(0, (prev.totalRecords || 0) - 1),
        recentActivities: (prev.recentActivities || []).filter(r =>
          String(r.id) !== String(delId) &&
          String(r.rowIndex) !== String(delId) &&
          String(r.pid) !== String(delId)
        )
      }));
    }
    fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div id="dashboard-view" className="view-section">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold page-title-text mb-1">Welcome Back, {user?.username}!</h3>
          <p className="text-muted small mb-0">Overview of portal activity and metrics</p>
        </div>
        <div className="mt-3 mt-md-0 d-flex gap-2">
          <button
            className="btn btn-primary btn-sm rounded-2 shadow-sm d-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
            onClick={() => setAddRecordOpen(true)}
          >
            <i className="bi bi-plus-lg"></i> Add Record
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        {/* Total Records */}
        <div className={isAdmin ? "col-12 col-sm-6 col-xl-3" : "col-12 col-sm-6 col-xl-4"}>
          <div
            className="card stat-card h-100 p-3"
            onClick={() => navigate('/records')}
            style={{ cursor: 'pointer' }}
            title="Click to view all records"
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Total Records</span>
                <h2 className="fw-bold text-white mb-0 mt-1">{loading ? '...' : stats.totalRecords}</h2>
              </div>
              <div className="stat-icon bg-primary-subtle-custom">
                <i className="bi bi-database"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Records */}
        <div className={isAdmin ? "col-12 col-sm-6 col-xl-3" : "col-12 col-sm-6 col-xl-4"}>
          <div
            className="card stat-card h-100 p-3"
            onClick={() => setTodayModalOpen(true)}
            style={{ cursor: 'pointer' }}
            title="Click to view today's records popup"
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Today's Records</span>
                <h2 className="fw-bold text-white mb-0 mt-1">{loading ? '...' : stats.todayRecords}</h2>
              </div>
              <div className="stat-icon bg-success-subtle-custom">
                <i className="bi bi-calendar-check"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Total Users (Admin Only) */}
        {isAdmin && (
          <div className="col-12 col-sm-6 col-xl-3">
            <div
              className="card stat-card h-100 p-3"
              onClick={() => setUsersModalOpen(true)}
              style={{ cursor: 'pointer' }}
              title="Click to view user accounts popup"
            >
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted small fw-semibold text-uppercase">Total Users</span>
                  <h2 className="fw-bold text-white mb-0 mt-1">{loading ? '...' : stats.totalUsers}</h2>
                </div>
                <div className="stat-icon bg-info-subtle-custom">
                  <i className="bi bi-people"></i>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Today's Imports */}
        <div className={isAdmin ? "col-12 col-sm-6 col-xl-3" : "col-12 col-sm-6 col-xl-4"}>
          <div
            className="card stat-card h-100 p-3"
            onClick={() => canImport && navigate('/import')}
            style={{ cursor: canImport ? 'pointer' : 'default' }}
            title={canImport ? 'Click to import data' : 'Import today'}
          >
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold text-uppercase">Import Today</span>
                <h2 className="fw-bold text-white mb-0 mt-1">{loading ? '...' : stats.todayImports}</h2>
              </div>
              <div className="stat-icon bg-warning-subtle-custom">
                <i className="bi bi-file-earmark-arrow-up"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="custom-table-card p-3 rounded-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="fw-bold card-title-text mb-0 d-flex align-items-center gap-2">
            <i className="bi bi-clock-history text-cyan"></i> Recent Activity Log
          </h6>
          <button className="btn btn-link btn-sm text-cyan text-decoration-none p-0 fw-semibold" onClick={() => navigate('/records')}>
            View All Records &rarr;
          </button>
        </div>

        <div className="table-responsive table-scroll-container">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small">
                <th>PID</th>
                <th>Name</th>
                <th>Father</th>
                <th>UT No</th>
                <th>Aadhar</th>
                <th>Date</th>
                <th>Created By</th>
                <th>Timestamp</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-4 text-muted">
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Loading activities...
                  </td>
                </tr>
              ) : stats.recentActivities.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-4 text-muted">No records found.</td>
                </tr>
              ) : (
                stats.recentActivities.map((rec, idx) => (
                  <tr key={rec.id || idx}>
                    <td className="fw-bold font-monospace">
                      <button
                        type="button"
                        className="btn btn-link p-0 text-cyan fw-bold font-monospace text-decoration-none pid-link"
                        onClick={() => setViewRecord(rec)}
                        title="Click to view record details"
                        style={{ fontSize: 'inherit', letterSpacing: '0.05em' }}
                      >
                        {rec.pid}
                      </button>
                    </td>
                    <td className="fw-semibold table-text-main">{rec.name}</td>
                    <td className="text-muted">{rec.father || '-'}</td>
                    <td><span className="badge badge-ut-pill font-monospace">{rec.utNo || '-'}</span></td>
                    <td className="font-monospace small table-text-main">{rec.aadharNo || '#N/A'}</td>
                    <td className="small text-muted">{rec.date || '-'}</td>
                    <td className="small table-text-main">{rec.createdBy || '-'}</td>
                    <td className="small text-muted">{rec.createdDate} {rec.createdTime}</td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary p-1 px-2"
                          onClick={() => {
                            if (isAdmin || rec.canEdit) setEditRecord(rec);
                            else setReqEditRecord(rec);
                          }}
                          title="Edit Record"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger p-1 px-2"
                          onClick={() => {
                            if (isAdmin || rec.canDelete) setDelRecord(rec);
                            else setReqDelRecord(rec);
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

      {/* Modals */}
      <AddRecordModal
        isOpen={addRecordOpen}
        onClose={() => setAddRecordOpen(false)}
        onRecordAdded={handleRecordAdded}
      />
      <ViewRecordModal
        isOpen={!!viewRecord}
        record={viewRecord}
        onClose={() => setViewRecord(null)}
      />
      <EditRecordModal
        isOpen={!!editRecord}
        record={editRecord}
        onClose={() => setEditRecord(null)}
        onRecordUpdated={handleRecordUpdated}
        onOpenRequestEdit={(rec) => setReqEditRecord(rec)}
      />
      <RequestEditModal
        isOpen={!!reqEditRecord}
        record={reqEditRecord}
        onClose={() => setReqEditRecord(null)}
        onRequestSubmitted={() => fetchDashboardData()}
      />
      <DeleteRecordModal
        isOpen={!!delRecord}
        record={delRecord}
        onClose={() => setDelRecord(null)}
        onRecordDeleted={handleRecordDeleted}
        onOpenRequestDelete={(rec) => setReqDelRecord(rec)}
      />
      <RequestDeleteModal
        isOpen={!!reqDelRecord}
        record={reqDelRecord}
        onClose={() => setReqDelRecord(null)}
        onRequestSubmitted={() => fetchDashboardData()}
      />
      <TodayRecordsModal
        isOpen={todayModalOpen}
        onClose={() => setTodayModalOpen(false)}
        onViewRecord={(rec) => setViewRecord(rec)}
        onEditRecord={(rec) => setEditRecord(rec)}
        onRequestEdit={(rec) => setReqEditRecord(rec)}
        onDeleteRecord={(rec) => setDelRecord(rec)}
        onRequestDelete={(rec) => setReqDelRecord(rec)}
      />
      <TotalUsersModal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
      />
    </div>
  );
}

