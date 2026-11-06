/**
 * client/src/pages/DataRecords.jsx
 * Data Records Table with 5-Way Filtering, Column Sorting, Pagination & Record Actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddRecordModal from '../components/modals/AddRecordModal';
import ViewRecordModal from '../components/modals/ViewRecordModal';
import EditRecordModal from '../components/modals/EditRecordModal';
import RequestEditModal from '../components/modals/RequestEditModal';
import DeleteRecordModal from '../components/modals/DeleteRecordModal';
import RequestDeleteModal from '../components/modals/RequestDeleteModal';
import PrintRecordsModal from '../components/modals/PrintRecordsModal';

export default function DataRecords() {
  const { user, isAdmin, showToast } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [recordType, setRecordType] = useState(searchParams.get('recordType') || 'all');
  const [remarkFilter, setRemarkFilter] = useState(searchParams.get('remark') || 'all');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [todayOnly, setTodayOnly] = useState(searchParams.get('today') === 'true');

  // Sorting & Pagination
  const [sortColumn, setSortColumn] = useState('createdDate');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Data & State
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [remarkOptions, setRemarkOptions] = useState([]);

  // Modals state
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [reqEditRecord, setReqEditRecord] = useState(null);
  const [delRecord, setDelRecord] = useState(null);
  const [reqDelRecord, setReqDelRecord] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Fetch Remark options for dropdown
  useEffect(() => {
    api.get('/api/records/remark-options')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setRemarkOptions(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {
        query: query.trim(),
        recordType,
        remark: remarkFilter === 'all' ? '' : remarkFilter,
        startDate,
        endDate,
        today: todayOnly ? 'true' : '',
        page,
        pageSize,
        sortColumn,
        sortDirection
      };

      const res = await api.get('/api/records', params);
      if (res && res.success) {
        const recordsList = Array.isArray(res.data) 
          ? res.data 
          : (res.data?.records || res.records || []);
        
        const total = typeof res.data?.totalRecords === 'number'
          ? res.data.totalRecords
          : (typeof res.totalCount === 'number'
            ? res.totalCount
            : (res.pagination?.total ?? recordsList.length));
        
        const effectivePageSize = pageSize === 'All' ? total : Number(pageSize || 25);
        const pages = effectivePageSize > 0 ? Math.max(1, Math.ceil(total / effectivePageSize)) : 1;

        setRecords(recordsList);
        setTotalCount(total);
        setTotalPages(res.pagination?.totalPages || pages);
      }
    } catch (err) {
      showToast('Error loading records: ' + err.message, 'danger');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [query, recordType, remarkFilter, startDate, endDate, todayOnly, page, pageSize, sortColumn, sortDirection, showToast]);

  // Optimistic Instant State Updates (0ms latency, no full page reload)
  const handleRecordAdded = (newRecord) => {
    if (newRecord) {
      setRecords(prev => {
        const cleanPid = String(newRecord.pid || '').trim();
        const exists = prev.some(r => String(r.pid).trim() === cleanPid);
        return exists ? prev : [newRecord, ...prev];
      });
      setTotalCount(prev => prev + 1);
    }
    setPage(1);
    fetchRecords(true);
  };

  const handleRecordUpdated = (updatedRecord) => {
    if (updatedRecord) {
      setRecords(prev => prev.map(r => 
        (String(r.id) === String(updatedRecord.id) || String(r.pid) === String(updatedRecord.pid) || String(r.rowIndex) === String(updatedRecord.rowIndex))
          ? { ...r, ...updatedRecord }
          : r
      ));
    }
    fetchRecords(true);
  };

  const handleRecordDeleted = (deletedRecord) => {
    if (deletedRecord) {
      const delId = String(deletedRecord.id || deletedRecord.rowIndex || deletedRecord.pid || '');
      setRecords(prev => prev.filter(r => 
        String(r.id) !== delId &&
        String(r.rowIndex) !== delId &&
        String(r.pid) !== delId
      ));
      setTotalCount(prev => Math.max(0, prev - 1));
    }
    fetchRecords(true);
  };

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Handle Sort Click
  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
    setPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setQuery('');
    setRecordType('all');
    setRemarkFilter('all');
    setStartDate('');
    setEndDate('');
    setTodayOnly(false);
    setPage(1);
    setSearchParams({});
  };

  const [isExporting, setIsExporting] = useState(false);

  // Export to Excel / CSV with Direct Blob Download and Error Handling
  const handleExport = async (format = 'xlsx') => {
    setIsExporting(true);
    try {
      const q = new URLSearchParams({
        format,
        query: query.trim(),
        recordType,
        remark: remarkFilter === 'all' ? '' : remarkFilter,
        startDate,
        endDate
      });

      const res = await fetch(`/api/export?${q.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'x-no-compression': '1'
        }
      });

      if (!res.ok) {
        let errorMsg = 'Failed to export records';
        try {
          const errData = await res.json();
          if (errData && errData.message) errorMsg = errData.message;
        } catch (_) {}
        showToast(errorMsg, 'danger');
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const contentDisposition = res.headers.get('Content-Disposition') || '';
      let filename = `JAM_Data_Records_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].trim();
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 200);

      showToast(`Exported ${format.toUpperCase()} successfully!`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Error exporting file: ' + err.message, 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Print Table Data (Opens dedicated clean print document - 100% reliable, never blank)
  const handleDirectPrint = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    const rowsHtml = (records || []).map(r => `
      <tr>
        <td style="font-family: monospace; font-weight: bold;">${r.pid || ''}</td>
        <td>${r.name || ''}</td>
        <td>${r.father || ''}</td>
        <td>${r.utNo || ''}</td>
        <td>${r.aadharNo || ''}</td>
        <td>${r.date || ''}</td>
        <td>${r.remark || ''}</td>
        <td>${r.createdBy || ''}</td>
        <td>${r.createdDate || ''}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>JAM Portal - Data Records Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #000; }
            h2 { margin-bottom: 4px; color: #1e3a8a; }
            .meta { font-size: 11px; color: #475569; margin-bottom: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #94a3b8; padding: 5px 7px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; text-transform: uppercase; }
            tr:nth-child(even) { background-color: #f8fafc; }
            @media print {
              body { padding: 0; }
              @page { size: landscape; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <h2>JAM Portal - Data Records Report</h2>
          <div class="meta">
            <strong>Generated:</strong> ${new Date().toLocaleString()} | 
            <strong>Showing Records:</strong> ${records.length} of ${totalCount} | 
            <strong>Filter:</strong> ${query.trim() || 'All'}
          </div>
          <table>
            <thead>
              <tr>
                <th>PID</th>
                <th>Name</th>
                <th>Father</th>
                <th>UT No</th>
                <th>Aadhar</th>
                <th>Record Date</th>
                <th>Remark</th>
                <th>Created By</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="9" style="text-align: center; padding: 20px;">No records found.</td></tr>'}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div id="records-view" className="view-section">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold page-title-text mb-1">Data Records</h3>
          <p className="text-muted small mb-0">Search, filter, view, edit, and export database entries</p>
        </div>
        <div className="mt-3 mt-md-0 d-flex align-items-center gap-2 flex-wrap">
          {/* Found Records Pill */}
          <span className="badge rounded-pill px-3 py-2 bg-info bg-opacity-25 text-cyan border border-info border-opacity-25 fs-6 fw-bold">
            <i className="bi bi-database me-1"></i> Found Records: {totalCount}
          </span>
          <button
            className="btn btn-primary btn-sm rounded-2 shadow-sm d-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
            onClick={() => setAddRecordOpen(true)}
          >
            <i className="bi bi-plus-lg"></i> Add Record
          </button>
          {/* Print Button (Opens Column Selection Popup) */}
          <button
            type="button"
            className="btn btn-outline-info btn-sm rounded-2 d-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
            onClick={() => setIsPrintModalOpen(true)}
            title="Print Data Records with Column Selection"
          >
            <i className="bi bi-printer"></i> Print
          </button>
          {/* Single Direct Excel Download Button */}
          <button
            type="button"
            className="btn btn-outline-success btn-sm rounded-2 d-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            title="Download records as Excel (.xlsx)"
          >
            {isExporting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Downloading...
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-excel"></i> Download Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5-Way Filter Bar */}
      <div className="filter-bar p-3 rounded-3 mb-4 custom-table-card">
        <div className="row g-2 align-items-center">
          {/* 1. Search Query Input with '/' shortcut badge */}
          <div className="col-12 col-md-5 col-xl-3">
            <div className="position-relative">
              <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
              <input
                type="text"
                data-search-slash="true"
                className="form-control ps-5 pe-5 search-slash-input"
                placeholder="Search PID, Name, Father, UT No, Aadhar..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <span className="search-shortcut-kbd-wrap position-absolute top-50 end-0 translate-middle-y me-2">
                <kbd className="search-slash-kbd">/</kbd>
              </span>
            </div>
          </div>

          {/* 2. Type Filter (All, UT, CT) */}
          <div className="col-6 col-sm-3 col-md-3 col-xl-2">
            <select
              id="filter-record-type"
              className="form-select custom-modern-dropdown"
              value={recordType}
              onChange={(e) => {
                setRecordType(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All (UT / CT)</option>
              <option value="UT">UT</option>
              <option value="CT">CT</option>
            </select>
          </div>

          {/* 3. Remark Filter */}
          <div className="col-6 col-sm-3 col-md-4 col-xl-2">
            <select
              id="filter-record-remark"
              className="form-select custom-modern-dropdown"
              value={remarkFilter}
              onChange={(e) => {
                setRemarkFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Remarks</option>
              {Array.isArray(remarkOptions) && remarkOptions.map((opt, idx) => {
                const val = opt && typeof opt === 'object' ? opt.optionValue : opt;
                return (
                  <option key={idx} value={val}>
                    {val}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 4. Date Range: From */}
          <div className="col-6 col-sm-3 col-md-5 col-xl-2">
            <input
              type="date"
              className="form-control compact-date-input"
              title="From Date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* 5. Date Range: To */}
          <div className="col-6 col-sm-3 col-md-5 col-xl-2">
            <input
              type="date"
              className="form-control compact-date-input"
              title="To Date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Reset Filters Button */}
          <div className="col-12 col-sm-12 col-md-2 col-xl-1 text-end">
            <button
              type="button"
              className="btn btn-outline-danger w-100"
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="custom-table-card p-3 rounded-3">
        <div id="data-records-table-container" className="table-responsive table-scroll-container">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr className="text-uppercase small user-select-none">
                <th onClick={() => handleSort('pid')} style={{ cursor: 'pointer', width: '7%' }}>
                  PID {sortColumn === 'pid' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', width: '15%' }}>
                  Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('father')} style={{ cursor: 'pointer', width: '14%' }}>
                  Father {sortColumn === 'father' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('utNo')} style={{ cursor: 'pointer', width: '13%' }}>
                  UT No {sortColumn === 'utNo' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ width: '9%' }}>Aadhar No</th>
                <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', width: '9%' }}>
                  Record Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{ width: '11%' }}>Remark</th>
                <th style={{ width: '7%' }}>Created By</th>
                <th onClick={() => handleSort('createdDate')} style={{ cursor: 'pointer', width: '9%' }}>
                  Created Date {sortColumn === 'createdDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-end" style={{ width: '6%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-5 text-muted">
                    <span className="spinner-border spinner-border-sm me-2 text-cyan" role="status"></span>
                    Loading records...
                  </td>
                </tr>
              ) : !Array.isArray(records) || records.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
                    No data records matched your filter criteria.
                  </td>
                </tr>
              ) : (
                (records || []).map((rec, idx) => (
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
                    <td className="fw-semibold table-text-main">
                      {rec.name}
                      {rec.hasPendingEditRequest && (
                        <span className="badge bg-warning text-dark ms-2 small" title="Edit request is pending approval">
                          Pending Edit
                        </span>
                      )}
                      {rec.hasPendingDeleteRequest && (
                        <span className="badge bg-danger text-white ms-2 small" title="Delete request is pending approval">
                          Pending Delete
                        </span>
                      )}
                    </td>
                    <td className="text-muted">{rec.father || '-'}</td>
                    <td>
                      <span className="badge badge-ut-pill font-monospace">{rec.utNo || '-'}</span>
                    </td>
                    <td className="font-monospace small table-text-main">{rec.aadharNo || '#N/A'}</td>
                    <td className="small text-muted">{rec.date || '-'}</td>
                    <td>
                      <span className="badge bg-primary bg-opacity-25 text-cyan border border-cyan border-opacity-25 py-1 px-2">
                        {rec.remark || 'None'}
                      </span>
                    </td>
                    <td className="small table-text-main">{rec.createdBy || '-'}</td>
                    <td className="small text-muted">{rec.createdDate}</td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary p-1 px-2"
                          onClick={() => {
                            if (isAdmin || rec.canEdit) setEditRecord(rec);
                            else setReqEditRecord(rec);
                          }}
                          title={isAdmin || rec.canEdit ? 'Edit Record' : 'Request Record Edit'}
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
                          title={isAdmin || rec.canDelete ? 'Delete Record' : 'Request Record Deletion'}
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
            <span>records per page</span>
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
        onRequestSubmitted={() => fetchRecords(true)}
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
        onRequestSubmitted={() => fetchRecords(true)}
      />
      <PrintRecordsModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        records={records}
        totalCount={totalCount}
        query={query}
        recordType={recordType}
        remarkFilter={remarkFilter}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

