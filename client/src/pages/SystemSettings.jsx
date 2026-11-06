/**
 * client/src/pages/SystemSettings.jsx
 * Admin System Settings, Remark Options & Delete Options Management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SystemSettings() {
  const { isAdmin, showToast } = useAuth();
  const [aadharMandatory, setAadharMandatory] = useState(false);
  const [remarkOptions, setRemarkOptions] = useState([]);
  const [deleteOptions, setDeleteOptions] = useState([]);
  const [newRemark, setNewRemark] = useState('');
  const [newRemarkDisableAadhar, setNewRemarkDisableAadhar] = useState(false);
  const [newDeleteOption, setNewDeleteOption] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, remarkRes, delRes] = await Promise.all([
        api.get('/api/records/settings').catch(() => ({ data: { aadharMandatory: false } })),
        api.get('/api/records/remark-options?permanentOnly=true').catch(() => ({ data: [] })),
        api.get('/api/records/delete-options').catch(() => ({ data: [] }))
      ]);

      if (settingsRes && settingsRes.data) {
        setAadharMandatory(!!settingsRes.data.aadharMandatory);
      }
      if (remarkRes && remarkRes.data) {
        setRemarkOptions(remarkRes.data);
      }
      if (delRes && delRes.data) {
        setDeleteOptions(delRes.data);
      }
    } catch (err) {
      showToast('Error loading system settings: ' + err.message, 'danger');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (!isAdmin) {
    return (
      <div className="alert alert-danger p-4 rounded-3 text-center">
        <i className="bi bi-shield-lock-fill fs-2 d-block mb-2"></i>
        <h5>Admin Access Required</h5>
        <p className="small mb-0">Only administrators have permission to access portal system settings.</p>
      </div>
    );
  }

  // Toggle Mandatory Aadhar Setting
  const handleToggleAadharMandatory = async (newVal) => {
    try {
      const res = await api.put('/api/records/settings', {
        key: 'aadhar_mandatory',
        value: newVal ? 'true' : 'false'
      });
      if (res && res.success) {
        setAadharMandatory(newVal);
        showToast(`Mandatory Aadhar enforcement ${newVal ? 'Enabled' : 'Disabled'}.`, 'success');
      }
    } catch (err) {
      showToast('Error updating Aadhar setting: ' + err.message, 'danger');
    }
  };

  // Add Remark Option
  const handleAddRemark = async (e) => {
    e.preventDefault();
    if (!newRemark.trim()) return;

    try {
      const res = await api.post('/api/records/remark-options', {
        optionValue: newRemark.trim(),
        disableAadhar: newRemarkDisableAadhar
      });
      if (res && res.success) {
        showToast(`Remark option "${newRemark}" added!`, 'success');
        setNewRemark('');
        setNewRemarkDisableAadhar(false);
        fetchSettings();
      }
    } catch (err) {
      showToast('Error adding remark option: ' + err.message, 'danger');
    }
  };

  // Toggle Disable Aadhar on Remark Option
  const handleToggleRemarkAadhar = async (opt, newVal) => {
    try {
      const val = typeof opt === 'object' ? opt.optionValue : opt;
      const res = await api.put('/api/records/remark-options/toggle-aadhar', {
        optionValue: val,
        disableAadhar: newVal
      });
      if (res && res.success) {
        showToast(`Aadhar requirement updated for "${val}".`, 'success');
        fetchSettings();
      }
    } catch (err) {
      showToast('Error updating remark option: ' + err.message, 'danger');
    }
  };

  // Delete Remark Option
  const handleDeleteRemark = async (opt) => {
    const val = typeof opt === 'object' ? opt.optionValue : opt;
    if (!window.confirm(`Delete remark option "${val}"?`)) return;

    try {
      const res = await api.delete('/api/records/remark-options', {
        optionValue: val
      });
      if (res && res.success) {
        showToast(`Remark option "${val}" deleted.`, 'info');
        fetchSettings();
      }
    } catch (err) {
      showToast('Error deleting remark option: ' + err.message, 'danger');
    }
  };

  // Add Delete Option
  const handleAddDeleteOption = async (e) => {
    e.preventDefault();
    if (!newDeleteOption.trim()) return;

    try {
      const res = await api.post('/api/records/delete-options', {
        optionValue: newDeleteOption.trim()
      });
      if (res && res.success) {
        showToast(`Delete reason "${newDeleteOption}" added!`, 'success');
        setNewDeleteOption('');
        fetchSettings();
      }
    } catch (err) {
      showToast('Error adding delete option: ' + err.message, 'danger');
    }
  };

  // Delete Delete Option
  const handleDeleteDeleteOption = async (opt) => {
    const val = typeof opt === 'object' ? opt.optionValue : opt;
    if (!window.confirm(`Delete reason option "${val}"?`)) return;

    try {
      const res = await api.delete('/api/records/delete-options', {
        optionValue: val
      });
      if (res && res.success) {
        showToast(`Delete reason "${val}" deleted.`, 'info');
        fetchSettings();
      }
    } catch (err) {
      showToast('Error deleting delete reason: ' + err.message, 'danger');
    }
  };

  return (
    <div id="dropdowns-view" className="view-section">
      {/* Top Banner Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h3 className="fw-bold page-title-text mb-1">System Settings</h3>
          <p className="text-muted small mb-0">Configure system-wide portal policies, validation rules, and dynamic dropdown options</p>
        </div>
      </div>

      <div className="row g-4">
        {/* Global Validation Card */}
        <div className="col-12">
          <div className="custom-table-card p-4 rounded-3">
            <h5 className="fw-bold card-title-text mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-shield-check text-cyan"></i> Data Validation Settings
            </h5>
            <div className="validation-setting-box d-flex align-items-center justify-content-between p-3 rounded">
              <div>
                <h6 className="table-text-main fw-bold mb-1">Mandatory Aadhar No. Enforcement</h6>
                <p className="text-muted small mb-0">
                  When enabled, all newly entered records must have a valid 12-digit Aadhar number (unless waived by specific remark).
                </p>
              </div>
              <div className="form-check form-switch fs-4 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="switch-mandatory-aadhar"
                  checked={aadharMandatory}
                  onChange={(e) => handleToggleAadharMandatory(e.target.checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Remark Options Card */}
        <div className="col-12 col-lg-6">
          <div className="custom-table-card p-4 rounded-3 h-100">
            <h5 className="fw-bold card-title-text mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-chat-left-quote-fill text-cyan"></i> Remark Dropdown Options
            </h5>

            {/* Add Option Form */}
            <form onSubmit={handleAddRemark} className="mb-4">
              <div className="input-group mb-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter new remark option..."
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary px-3 fw-semibold">
                  <i className="bi bi-plus-lg me-1"></i> Add
                </button>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="new-remark-disable-aadhar"
                  checked={newRemarkDisableAadhar}
                  onChange={(e) => setNewRemarkDisableAadhar(e.target.checked)}
                />
                <label className="form-check-label text-muted small" htmlFor="new-remark-disable-aadhar">
                  Disable Aadhar requirement when this remark is selected
                </label>
              </div>
            </form>

            {/* Options List */}
            <div className="table-responsive table-scroll-container">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr className="text-uppercase small">
                    <th>Option Name</th>
                    <th>Disable Aadhar</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="text-center py-3 text-muted">Loading options...</td>
                    </tr>
                  ) : !Array.isArray(remarkOptions) || remarkOptions.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center py-3 text-muted">No remark options configured.</td>
                    </tr>
                  ) : (
                    (remarkOptions || []).map((opt, idx) => {
                      const val = typeof opt === 'object' ? opt.optionValue : opt;
                      const disable = typeof opt === 'object' ? !!opt.disableAadhar : false;
                      return (
                        <tr key={idx}>
                          <td className="fw-semibold table-text-main">{val}</td>
                          <td>
                            <div className="form-check form-switch mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={disable}
                                onChange={(e) => handleToggleRemarkAadhar(opt, e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger p-1 px-2"
                              onClick={() => handleDeleteRemark(opt)}
                              title="Delete option"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Delete Options Card */}
        <div className="col-12 col-lg-6">
          <div className="custom-table-card p-4 rounded-3 h-100">
            <h5 className="fw-bold card-title-text mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-trash3-fill text-danger"></i> Deletion Reason Options
            </h5>

            {/* Add Delete Option Form */}
            <form onSubmit={handleAddDeleteOption} className="mb-4">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter new deletion reason..."
                  value={newDeleteOption}
                  onChange={(e) => setNewDeleteOption(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-danger px-3 fw-semibold">
                  <i className="bi bi-plus-lg me-1"></i> Add
                </button>
              </div>
            </form>

            {/* Delete Reasons List */}
            <div className="table-responsive table-scroll-container">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr className="text-uppercase small">
                    <th>Reason Option</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="2" className="text-center py-3 text-muted">Loading options...</td>
                    </tr>
                  ) : !Array.isArray(deleteOptions) || deleteOptions.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="text-center py-3 text-muted">No delete options configured.</td>
                    </tr>
                  ) : (
                    (deleteOptions || []).map((opt, idx) => {
                      const val = typeof opt === 'object' ? opt.optionValue : opt;
                      return (
                        <tr key={idx}>
                          <td className="fw-semibold table-text-main">{val}</td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger p-1 px-2"
                              onClick={() => handleDeleteDeleteOption(opt)}
                              title="Delete reason option"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

