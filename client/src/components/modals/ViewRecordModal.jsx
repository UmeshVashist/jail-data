/**
 * client/src/components/modals/ViewRecordModal.jsx
 * View Full Record Details Modal in Structured Table Format
 */

import React from 'react';
import { createPortal } from 'react-dom';

export default function ViewRecordModal({ isOpen, onClose, record }) {
  if (!isOpen || !record) return null;

  return createPortal(
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          {/* Header */}
          <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
            <h5 className="modal-title fw-bold card-title-text d-flex align-items-center gap-2 mb-0">
              <i className="bi bi-person-badge text-cyan"></i> Record Details &mdash; PID: {record.pid}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>

          {/* Body: Structured Table Format */}
          <div className="modal-body p-4">
            <div className="table-responsive rounded-3 overflow-hidden border border-secondary border-opacity-25">
              <table className="table table-bordered align-middle mb-0 view-record-table">
                <tbody>
                  <tr>
                    <th className="view-th">
                      <i className="bi bi-hash text-cyan me-1.5"></i> PID
                    </th>
                    <td className="view-td">
                      <span className="fw-bold text-cyan font-monospace fs-6">{record.pid || '-'}</span>
                    </td>
                    <th className="view-th">
                      <i className="bi bi-person text-cyan me-1.5"></i> Full Name
                    </th>
                    <td className="view-td">
                      <span className="fw-bold table-text-main">{record.name || '-'}</span>
                    </td>
                  </tr>
                  <tr>
                    <th className="view-th">
                      <i className="bi bi-person-heart text-cyan me-1.5"></i> Father's Name
                    </th>
                    <td className="view-td">
                      <span className="table-text-main">{record.father || '-'}</span>
                    </td>
                    <th className="view-th">
                      <i className="bi bi-card-text text-cyan me-1.5"></i> UT No.
                    </th>
                    <td className="view-td">
                      <span className="badge badge-ut-pill font-monospace">{record.utNo || '-'}</span>
                    </td>
                  </tr>
                  <tr>
                    <th className="view-th">
                      <i className="bi bi-tag text-cyan me-1.5"></i> Record Type
                    </th>
                    <td className="view-td">
                      <span className="badge bg-secondary font-monospace px-2 py-1">
                        {record.type || record.recordType || 'UT'}
                      </span>
                    </td>
                    <th className="view-th">
                      <i className="bi bi-shield-lock text-cyan me-1.5"></i> Aadhar No.
                    </th>
                    <td className="view-td">
                      <span className="fw-bold text-cyan font-monospace">{record.aadharNo || '#N/A'}</span>
                    </td>
                  </tr>
                  <tr>
                    <th className="view-th">
                      <i className="bi bi-calendar3 text-cyan me-1.5"></i> Record Date
                    </th>
                    <td className="view-td">
                      <span className="table-text-main">{record.date || '-'}</span>
                    </td>
                    <th className="view-th">
                      <i className="bi bi-chat-left-dots text-cyan me-1.5"></i> Remark
                    </th>
                    <td className="view-td">
                      <span className="badge bg-primary bg-opacity-25 text-cyan border border-cyan border-opacity-25 py-1 px-2">
                        {record.remark || 'None'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th className="view-th">
                      <i className="bi bi-person-check text-cyan me-1.5"></i> Created By
                    </th>
                    <td className="view-td">
                      <span className="table-text-main">{record.createdBy || '-'}</span>
                    </td>
                    <th className="view-th">
                      <i className="bi bi-clock-history text-cyan me-1.5"></i> Created At
                    </th>
                    <td className="view-td">
                      <span className="table-text-main small">
                        {(record.createdDate || '') + ' ' + (record.createdTime || '')}
                      </span>
                    </td>
                  </tr>
                  {record.updatedDate && (
                    <tr>
                      <th className="view-th">
                        <i className="bi bi-arrow-repeat text-cyan me-1.5"></i> Last Updated
                      </th>
                      <td className="view-td" colSpan="3">
                        <span className="table-text-main small">
                          {(record.updatedDate || '') + ' ' + (record.updatedTime || '')}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-2">
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
