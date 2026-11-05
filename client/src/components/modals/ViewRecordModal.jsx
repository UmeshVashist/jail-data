/**
 * client/src/components/modals/ViewRecordModal.jsx
 * View Full Record Details Modal
 */

import React from 'react';

export default function ViewRecordModal({ isOpen, onClose, record }) {
  if (!isOpen || !record) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25">
            <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-person-badge-fill text-cyan"></i> Record Details - PID: {record.pid}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body p-4">
            <div className="row g-3">
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">PID</span>
                <span className="fw-bold text-white fs-6">{record.pid || '-'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Full Name</span>
                <span className="fw-bold text-white fs-6">{record.name || '-'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Father's Name</span>
                <span className="text-white">{record.father || '-'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">UT No.</span>
                <span className="text-white">{record.utNo || '-'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Record Type</span>
                <span className="badge bg-secondary">{record.type || record.recordType || 'UT'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Aadhar No.</span>
                <span className="fw-bold text-cyan font-monospace">{record.aadharNo || '#N/A'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Record Date</span>
                <span className="text-white">{record.date || '-'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Remark</span>
                <span className="badge bg-primary bg-opacity-25 text-cyan border border-cyan border-opacity-25 py-1 px-2">
                  {record.remark || 'None'}
                </span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Created By</span>
                <span className="text-white">{record.createdBy || '-'}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted small fw-semibold text-uppercase d-block">Created Date & Time</span>
                <span className="text-white">{(record.createdDate || '') + ' ' + (record.createdTime || '')}</span>
              </div>
              {record.updatedDate && (
                <div className="col-12 border-top border-secondary border-opacity-25 pt-2">
                  <span className="text-muted small fw-semibold text-uppercase d-block">Last Updated</span>
                  <span className="text-white small">{(record.updatedDate || '') + ' ' + (record.updatedTime || '')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer border-top border-secondary border-opacity-25">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
