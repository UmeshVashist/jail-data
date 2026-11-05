/**
 * client/src/pages/ImportData.jsx
 * Excel & CSV Batch Data Import with Progress Logs & Template Download
 */

import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ImportData() {
  const { showToast, canImport } = useAuth();
  const [file, setFile] = useState(null);
  const [duplicateMode, setDuplicateMode] = useState('skip'); // 'skip' or 'overwrite'
  const [uploading, setUploading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  if (!canImport) {
    return (
      <div className="alert alert-danger p-4 rounded-3 text-center">
        <i className="bi bi-shield-lock-fill fs-2 d-block mb-2"></i>
        <h5>Access Denied</h5>
        <p className="small mb-0">You do not have permission to import data. Please contact an administrator.</p>
      </div>
    );
  }

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      showToast('Please select an Excel or CSV file to import.', 'warning');
      return;
    }

    setUploading(true);
    setImportSummary(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('duplicateMode', duplicateMode);

    try {
      const res = await api.post('/api/import', formData);
      if (res && res.success) {
        showToast(res.message || 'Data imported successfully!', 'success');
        setImportSummary(res.summary || res);
        setFile(null);
      } else {
        showToast(res.message || 'Import failed.', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'Error uploading file.', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/import/template', '_blank');
  };

  return (
    <div className="view-section">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold text-white mb-1">Import Data</h3>
          <p className="text-muted small mb-0">Upload Excel (.xlsx, .xls) or CSV spreadsheet to batch import records</p>
        </div>
        <div className="mt-3 mt-md-0">
          <button
            type="button"
            className="btn btn-outline-cyan btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2"
            onClick={handleDownloadTemplate}
          >
            <i className="bi bi-file-earmark-arrow-down"></i> Download Sample Template
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Upload Form Box */}
        <div className="col-12 col-lg-7">
          <div className="custom-table-card p-4 rounded-3 h-100">
            <h5 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-cloud-arrow-up-fill text-cyan"></i> Upload Spreadsheet
            </h5>

            <form onSubmit={handleUpload}>
              {/* Dropzone */}
              <div
                className="border border-2 border-dashed border-secondary border-opacity-50 rounded-3 p-5 text-center mb-4 user-select-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('import-file-input').click()}
              >
                <i className="bi bi-file-earmark-excel-fill text-success fs-1 d-block mb-3"></i>
                <h6 className="text-white fw-bold mb-1">
                  {file ? file.name : 'Click to Browse or Drag & Drop File'}
                </h6>
                <p className="text-muted small mb-0">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB - Ready to import`
                    : 'Supports Excel (.xlsx, .xls) and CSV (.csv) files'}
                </p>
                <input
                  id="import-file-input"
                  type="file"
                  className="d-none"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
                  }}
                />
              </div>

              {/* Duplicate Handling Mode */}
              <div className="mb-4">
                <label className="form-label text-white small fw-semibold">Duplicate PID Handling:</label>
                <div className="d-flex gap-4">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="dupMode"
                      id="dup-skip"
                      value="skip"
                      checked={duplicateMode === 'skip'}
                      onChange={() => setDuplicateMode('skip')}
                    />
                    <label className="form-check-label text-white small" htmlFor="dup-skip">
                      Skip Duplicates (Recommended)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="dupMode"
                      id="dup-overwrite"
                      value="overwrite"
                      checked={duplicateMode === 'overwrite'}
                      onChange={() => setDuplicateMode('overwrite')}
                    />
                    <label className="form-check-label text-white small" htmlFor="dup-overwrite">
                      Overwrite Existing Records
                    </label>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary w-100 py-3 fw-bold rounded-3 shadow d-flex align-items-center justify-content-center gap-2"
                disabled={!file || uploading}
              >
                {uploading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Importing Records into Database...
                  </>
                ) : (
                  <>
                    <i className="bi bi-file-earmark-check-fill"></i> Start Data Import
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Instructions & Summary Box */}
        <div className="col-12 col-lg-5">
          <div className="custom-table-card p-4 rounded-3 h-100">
            <h5 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle-fill text-warning"></i> Guidelines & Instructions
            </h5>
            <ul className="text-muted small ps-3 mb-4 d-flex flex-column gap-2">
              <li>Columns required: <strong>PID, Name, Father's Name, UT No., Aadhar No., Date, Remark</strong>.</li>
              <li>Aadhar numbers must be 12 digits or formatted as <code>XXXX XXXX XXXX</code>.</li>
              <li>Remark options can be custom or chosen from approved dropdown values.</li>
              <li>Files with up to 50,000 rows can be uploaded in a single batch.</li>
            </ul>

            {importSummary && (
              <div className="p-3 rounded-3 bg-dark border border-secondary border-opacity-25 mt-4">
                <h6 className="fw-bold text-success mb-2">
                  <i className="bi bi-check-circle-fill me-1"></i> Import Completed!
                </h6>
                <div className="small text-white d-flex flex-column gap-1">
                  <div><strong>Total Rows Processed:</strong> {importSummary.totalRows || importSummary.total || 0}</div>
                  <div><strong>Successfully Inserted:</strong> {importSummary.inserted || 0}</div>
                  <div><strong>Duplicates Skipped:</strong> {importSummary.skipped || 0}</div>
                  {importSummary.errors && importSummary.errors.length > 0 && (
                    <div className="text-danger mt-2">
                      <strong>Errors:</strong> {importSummary.errors.length} rows encountered issues.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

