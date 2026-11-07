/**
 * client/src/components/modals/ExportExcelModal.jsx
 * Interactive Column & Scope Selection Modal for Direct Excel (.xlsx) Download
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const ALL_COLUMNS = [
  { key: 'pid', label: 'PID', width: 14 },
  { key: 'name', label: 'Full Name', width: 26 },
  { key: 'father', label: "Father's Name", width: 26 },
  { key: 'utNo', label: 'UT No.', width: 22 },
  { key: 'aadharNo', label: 'Aadhar No.', width: 20 },
  { key: 'date', label: 'Record Date', width: 14 },
  { key: 'remark', label: 'Remark', width: 22 },
  { key: 'createdBy', label: 'Created By', width: 16 },
  { key: 'createdDate', label: 'Created Date/Time', width: 20 }
];

export default function ExportExcelModal({
  isOpen,
  onClose,
  records = [],
  totalCount = 0,
  query = '',
  recordType = 'all',
  remarkFilter = 'all',
  startDate = '',
  endDate = '',
  onSuccess
}) {
  const [selectedCols, setSelectedCols] = useState({
    pid: true,
    name: true,
    father: true,
    utNo: true,
    aadharNo: true,
    date: true,
    remark: true,
    createdBy: true,
    createdDate: true
  });
  const [exportScope, setExportScope] = useState('current'); // 'current' or 'all'
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleToggleCol = (key) => {
    setSelectedCols(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = (select) => {
    const updated = {};
    ALL_COLUMNS.forEach(c => {
      updated[c.key] = select;
    });
    setSelectedCols(updated);
  };

  const handleDownload = async () => {
    const activeCols = ALL_COLUMNS.filter(c => selectedCols[c.key]);
    if (activeCols.length === 0) {
      alert('Please select at least one column to export.');
      return;
    }

    setIsExporting(true);
    try {
      let recordsToExport = records;

      // 1. If user selected all matching records, fetch with current filters
      if (exportScope === 'all') {
        const q = new URLSearchParams({
          page: 1,
          pageSize: 'All',
          query: query.trim(),
          recordType,
          remark: remarkFilter === 'all' ? '' : remarkFilter,
          startDate,
          endDate
        });
        const res = await fetch(`/api/records?${q.toString()}`, {
          credentials: 'include'
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.records)) {
          recordsToExport = data.records;
        }
      }

      const todayDateStr = new Date().toISOString().slice(0, 10);
      const filename = `JAM_Data_Records_${todayDateStr}.xlsx`;

      // 2. Client-side SheetJS generation (instant, verified uncorrupted, offline-safe)
      if (window.XLSX) {
        const XLSX = window.XLSX;

        // Build array of objects with only selected columns
        const exportRows = (recordsToExport || []).map(r => {
          const rowObj = {};
          activeCols.forEach(col => {
            let val = r[col.key];
            if (val === undefined || val === null) val = '';
            if (col.key === 'createdDate') {
              const dateVal = r.createdDate || '';
              const timeVal = r.createdTime || '';
              val = `${dateVal} ${timeVal}`.trim();
            }
            if (col.key === 'date' && !val) {
              val = r.recordDate || '';
            }
            rowObj[col.label] = String(val);
          });
          return rowObj;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows);

        // Set column widths
        worksheet['!cols'] = activeCols.map(col => ({
          wch: Math.max(col.label.length + 4, col.width || 15)
        }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Records');

        // Write and trigger genuine .xlsx download
        XLSX.writeFile(workbook, filename, { bookType: 'xlsx', type: 'binary' });

        if (typeof onSuccess === 'function') {
          onSuccess(`Successfully exported ${recordsToExport.length} records to Excel.`);
        }
        onClose();
        return;
      }

      // 3. Server-side fallback via /api/export if window.XLSX is not yet available
      const activeColKeys = activeCols.map(c => c.key).join(',');
      const q = new URLSearchParams({
        format: 'xlsx',
        cols: activeColKeys,
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
        alert(errorMsg);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (typeof onSuccess === 'function') {
        onSuccess(`Successfully exported records to Excel.`);
      }
      onClose();
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert('Error generating Excel file: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCount = ALL_COLUMNS.filter(c => selectedCols[c.key]).length;

  return createPortal(
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-file-earmark-excel text-success"></i> Download Data in Excel (.xlsx)
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
              disabled={isExporting}
            ></button>
          </div>

          <div className="modal-body p-4">
            <div className="modal-notice-banner d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-info-circle-fill fs-6 flex-shrink-0 text-success"></i>
              <span>Select the columns and scope you want to include in the downloaded Excel file.</span>
            </div>

            {/* Scope Selection */}
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>
                Export Scope
              </label>
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="excelExportScope"
                    id="excelScopeCurrent"
                    value="current"
                    checked={exportScope === 'current'}
                    onChange={() => setExportScope('current')}
                  />
                  <label className="form-check-label small" htmlFor="excelScopeCurrent">
                    Current Page ({records.length} records)
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="excelExportScope"
                    id="excelScopeAll"
                    value="all"
                    checked={exportScope === 'all'}
                    onChange={() => setExportScope('all')}
                  />
                  <label className="form-check-label small" htmlFor="excelScopeAll">
                    All Matching Records ({totalCount} records)
                  </label>
                </div>
              </div>
            </div>

            {/* Column Options Header with Select All / Deselect All */}
            <div className="d-flex align-items-center justify-content-between mb-2">
              <label className="form-label small fw-bold text-muted text-uppercase mb-0" style={{ letterSpacing: '0.5px' }}>
                Select Columns ({selectedCount} of {ALL_COLUMNS.length})
              </label>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-decoration-none small text-primary"
                  onClick={() => handleSelectAll(true)}
                >
                  Select All
                </button>
                <span className="text-muted">|</span>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-decoration-none small text-secondary"
                  onClick={() => handleSelectAll(false)}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Column Checkboxes Grid */}
            <div className="p-3 rounded border border-secondary border-opacity-25 bg-light bg-opacity-25">
              <div className="row g-2">
                {ALL_COLUMNS.map(col => (
                  <div key={col.key} className="col-6 col-sm-4">
                    <div className="form-check mb-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`excel-col-${col.key}`}
                        checked={!!selectedCols[col.key]}
                        onChange={() => handleToggleCol(col.key)}
                      />
                      <label
                        className="form-check-label small cursor-pointer"
                        htmlFor={`excel-col-${col.key}`}
                        style={{ cursor: 'pointer' }}
                      >
                        {col.label}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-3">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm px-4 fw-semibold shadow-sm d-flex align-items-center gap-1.5"
              onClick={handleDownload}
              disabled={isExporting || selectedCount === 0}
              title="Keyboard shortcut: Ctrl + Enter"
            >
              {isExporting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span> Generating Excel...
                </>
              ) : (
                <>
                  <i className="bi bi-download"></i> Download Excel <small className="opacity-75 ms-1 fw-normal">(Ctrl+Enter)</small>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

