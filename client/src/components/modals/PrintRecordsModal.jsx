/**
 * client/src/components/modals/PrintRecordsModal.jsx
 * Interactive Column & Scope Selection Modal for Direct Table Printing
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const ALL_COLUMNS = [
  { key: 'pid', label: 'PID', width: '10%' },
  { key: 'name', label: 'Full Name', width: '15%' },
  { key: 'father', label: "Father's Name", width: '15%' },
  { key: 'utNo', label: 'UT No.', width: '13%' },
  { key: 'aadharNo', label: 'Aadhar No.', width: '13%' },
  { key: 'date', label: 'Record Date', width: '10%' },
  { key: 'remark', label: 'Remark', width: '12%' },
  { key: 'createdBy', label: 'Created By', width: '10%' },
  { key: 'createdDate', label: 'Created Date/Time', width: '12%' }
];

export default function PrintRecordsModal({
  isOpen,
  onClose,
  records = [],
  totalCount = 0,
  query = '',
  recordType = 'all',
  remarkFilter = 'all',
  startDate = '',
  endDate = ''
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
  const [printScope, setPrintScope] = useState('current'); // 'current' or 'all'
  const [isFetchingAll, setIsFetchingAll] = useState(false);

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

  const handlePrint = async () => {
    const activeCols = ALL_COLUMNS.filter(c => selectedCols[c.key]);
    if (activeCols.length === 0) {
      alert('Please select at least one column to print.');
      return;
    }

    let recordsToPrint = records;

    // If printing all records matching current filters
    if (printScope === 'all') {
      setIsFetchingAll(true);
      try {
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
          recordsToPrint = data.records;
        }
      } catch (err) {
        console.warn('Failed to fetch all records for printing, falling back to current page:', err);
      } finally {
        setIsFetchingAll(false);
      }
    }

    const printWindow = window.open('', '_blank', 'width=1150,height=850');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site to print.');
      return;
    }

    const theadHtml = activeCols.map(c => `<th>${c.label}</th>`).join('');

    const tbodyHtml = (recordsToPrint || []).map(r => {
      const cells = activeCols.map(c => {
        let val = r[c.key] || '';
        if (c.key === 'pid') {
          return `<td style="font-family: monospace; font-weight: bold;">${val}</td>`;
        }
        if (c.key === 'createdDate' && r.createdTime) {
          val = `${val} ${r.createdTime}`;
        }
        return `<td>${val}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const filterSummary = [
      query ? `Search: "${query}"` : '',
      recordType !== 'all' ? `Type: ${recordType}` : '',
      remarkFilter !== 'all' ? `Remark: ${remarkFilter}` : '',
      startDate || endDate ? `Date: ${startDate || 'Start'} to ${endDate || 'Now'}` : ''
    ].filter(Boolean).join(' | ');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>JAM Portal - Data Records Report</title>
          <style>
            @page {
              size: landscape;
              margin: 8mm;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
              padding: 15px;
              color: #0f172a;
              background: #fff;
              margin: 0;
            }
            .header-bar {
              border-bottom: 2px solid #1e3a8a;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            h2 {
              margin: 0 0 4px 0;
              color: #1e3a8a;
              font-size: 18px;
            }
            .meta {
              font-size: 11px;
              color: #475569;
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10.5px;
              margin-top: 8px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 5px 7px;
              text-align: left;
              vertical-align: middle;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 700;
              color: #1e293b;
              text-transform: uppercase;
              font-size: 9.5px;
              letter-spacing: 0.3px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @media print {
              body { padding: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              th { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <h2>JAM Portal - Data Records Report</h2>
            <div class="meta">
              <div>
                <strong>Generated:</strong> ${new Date().toLocaleString()} | 
                <strong>Records:</strong> ${recordsToPrint.length} of ${totalCount}
              </div>
              <div>${filterSummary || 'All Records (No Filters)'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>${theadHtml}</tr>
            </thead>
            <tbody>
              ${tbodyHtml || '<tr><td colspan="' + activeCols.length + '" style="text-align: center; padding: 20px;">No records found.</td></tr>'}
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
    onClose();
  };

  const selectedCount = ALL_COLUMNS.filter(c => selectedCols[c.key]).length;

  return createPortal(
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-printer text-info"></i> Print Data Records
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" disabled={isFetchingAll}></button>
          </div>

          <div className="modal-body p-4">
            <div className="modal-notice-banner d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-info-circle-fill fs-6 flex-shrink-0"></i>
              <span>Select the columns you want to include in the printed report.</span>
            </div>

            {/* Scope Selection */}
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>
                Print Scope
              </label>
              <div className="d-flex gap-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="printScope"
                    id="scopeCurrent"
                    value="current"
                    checked={printScope === 'current'}
                    onChange={() => setPrintScope('current')}
                  />
                  <label className="form-check-label small" htmlFor="scopeCurrent">
                    Current Page ({records.length} records)
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="printScope"
                    id="scopeAll"
                    value="all"
                    checked={printScope === 'all'}
                    onChange={() => setPrintScope('all')}
                  />
                  <label className="form-check-label small" htmlFor="scopeAll">
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
                        id={`print-col-${col.key}`}
                        checked={!!selectedCols[col.key]}
                        onChange={() => handleToggleCol(col.key)}
                      />
                      <label
                        className="form-check-label small cursor-pointer"
                        htmlFor={`print-col-${col.key}`}
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isFetchingAll}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm px-4 fw-semibold shadow-sm d-flex align-items-center gap-1.5"
              onClick={handlePrint}
              disabled={isFetchingAll || selectedCount === 0}
            >
              {isFetchingAll ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span> Preparing...
                </>
              ) : (
                <>
                  <i className="bi bi-printer"></i> Print Report
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
