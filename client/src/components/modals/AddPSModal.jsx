/**
 * client/src/components/modals/AddPSModal.jsx
 * Admin Add New Police Station Modal
 */

import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AddPSModal({ isOpen, onClose, onPSAdded }) {
  const { showToast } = useAuth();
  const [psName, setPsName] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!psName.trim()) {
      showToast('थाने (PS) का नाम दर्ज करना आवश्यक है।', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/ps', {
        psName: psName.trim().toUpperCase(),
        district: district.trim().toUpperCase(),
        state: state.trim().toUpperCase()
      });

      if (res && res.success) {
        showToast(res.message || 'थाना सफलतापूर्वक जोड़ा गया!', 'success');
        setPsName('');
        setDistrict('');
        setState('');
        onClose();
        if (onPSAdded) onPSAdded(res.data);
      } else {
        showToast(res.message || 'थाना जोड़ने में विफलता।', 'danger');
      }
    } catch (err) {
      showToast(err.message || 'थाना जोड़ने में त्रुटि आई।', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header border-bottom border-secondary border-opacity-25">
            <h5 className="modal-title fw-bold text-white d-flex align-items-center gap-2">
              <i className="bi bi-shield-plus text-cyan"></i> Add New Police Station
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" disabled={loading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label text-white small fw-semibold">
                  Police Station (PS Name) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. SADAR BAZAR"
                  value={psName}
                  onChange={(e) => setPsName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-white small fw-semibold">District</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. CENTRAL"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-white small fw-semibold">State</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. DELHI"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="modal-footer border-top border-secondary border-opacity-25">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm px-4 fw-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Adding...
                  </>
                ) : (
                  'Add Police Station'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

