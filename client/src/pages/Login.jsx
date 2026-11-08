/**
 * client/src/pages/Login.jsx - Authentication Screen
 */

import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { translateToHindi } from '../utils/hindiTranslator';
import CyberBackground3D from '../components/CyberBackground3D';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      const rawMsg = err.message || 'अमान्य यूज़रनेम या पासवर्ड।';
      const msg = translateToHindi(rawMsg);
      if (!rawMsg.toLowerCase().includes('successful') && !rawMsg.includes('सफल')) {
        setError(msg);
      } else {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3 position-relative">
      <CyberBackground3D />
      <div className="card login-card p-4 p-md-5 position-relative" style={{ maxWidth: '440px', width: '100%', zIndex: 10 }}>
        <div className="text-center mb-4">
          <div
            className="brand-logo-icon mx-auto mb-3 d-flex align-items-center justify-content-center"
            style={{ width: 60, height: 60, borderRadius: 18, fontSize: '1.8rem' }}
          >
            <i className="bi bi-shield-lock-fill text-cyan"></i>
          </div>
          <h3 className="fw-bold mb-1 login-title">JAM Portal Access</h3>
          <p className="login-subtitle small mb-0 text-muted">Sign in to manage your sheets & data records</p>
        </div>

        {error && (
          <div className="alert alert-danger small rounded-3 border-0 bg-danger bg-opacity-25 text-danger fw-semibold d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="mb-3">
            <label className="form-label small fw-semibold login-label">Username</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-person"></i></span>
              <input
                type="text"
                className="form-control"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label small fw-semibold login-label">Password</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-key"></i></span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control border-end-0"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required
              />
              <button
                className="btn btn-outline-secondary border-start-0 input-group-text password-toggle-btn"
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label="Toggle password visibility"
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-3 fw-bold rounded-3 shadow-lg fs-6 d-flex align-items-center justify-content-center"
            disabled={loading}
            title="Keyboard shortcut: Ctrl + Enter"
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Signing In...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right me-2"></i> Sign In <small className="opacity-75 ms-1 fw-normal fs-6">(Ctrl+Enter)</small>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

