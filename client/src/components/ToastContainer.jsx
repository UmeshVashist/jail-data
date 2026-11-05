/**
 * client/src/components/ToastContainer.jsx
 * Global Bootstrap Toast notifications
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useAuth();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="toast-container position-fixed top-0 end-0 p-3"
      style={{ zIndex: 9999 }}
    >
      {toasts.map(toast => {
        const bgClass =
          toast.type === 'success'
            ? 'bg-success text-white'
            : toast.type === 'danger' || toast.type === 'error'
            ? 'bg-danger text-white'
            : toast.type === 'warning'
            ? 'bg-warning text-dark'
            : 'bg-primary text-white';

        return (
          <div
            key={toast.id}
            className={`toast show align-items-center ${bgClass} border-0 mb-2 shadow`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="d-flex">
              <div className="toast-body d-flex align-items-center gap-2">
                {toast.type === 'success' && <i className="bi bi-check-circle-fill"></i>}
                {toast.type === 'danger' && <i className="bi bi-exclamation-triangle-fill"></i>}
                {toast.type === 'warning' && <i className="bi bi-exclamation-circle-fill"></i>}
                {toast.type === 'info' && <i className="bi bi-info-circle-fill"></i>}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                className={`btn-close ${toast.type === 'warning' ? '' : 'btn-close-white'} me-2 m-auto`}
                onClick={() => removeToast(toast.id)}
                aria-label="Close"
              ></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
