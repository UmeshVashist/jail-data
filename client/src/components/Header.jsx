/**
 * client/src/components/Header.jsx
 * Top Navigation Bar with Title, UI Theme Toggle & User Profile Chip
 */

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ toggleMobileSidebar, onOpenSelfPassword }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isModern } = useTheme();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getPageInfo = () => {
    const p = location.pathname;
    if (p === '/dashboard') return { title: 'Dashboard Overview', icon: 'bi-speedometer2 text-primary' };
    if (p === '/records' || p === '/data-records') return { title: 'Data Records & Operations', icon: 'bi-table text-cyan' };
    if (p === '/import' || p === '/import-data') return { title: 'Import Data File', icon: 'bi-file-earmark-arrow-up-fill text-warning' };
    if (p === '/all-requests' || p === '/edit-requests' || p === '/delete-requests') return { title: 'Requests Management Hub', icon: 'bi-inbox-fill text-info' };
    if (p === '/my-requests' || p === '/reactive-list') return { title: 'My Sent Requests', icon: 'bi-send-fill text-success' };
    if (p === '/users' || p === '/user-management') return { title: 'Admin User Management', icon: 'bi-people-fill text-primary' };
    if (p === '/ps' || p === '/ps-list') return { title: 'Police Stations (PS List)', icon: 'bi-shield-check text-cyan' };
    if (p === '/settings' || p === '/dropdowns' || p === '/system-settings') return { title: 'System Settings & Options', icon: 'bi-gear-wide-connected text-warning' };
    return { title: 'JAM Management Portal', icon: 'bi-layers-half text-cyan' };
  };

  const pageInfo = getPageInfo();
  const userInitial = (user?.username || 'U').charAt(0).toUpperCase();
  const roleDisplay = (user?.role || 'User').toUpperCase() + (user?.fullAccess ? ' (FULL)' : '');

  return (
    <header className="top-navbar d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
      {/* Page Title & Mobile Toggle */}
      <div className="d-flex align-items-center gap-3">
        <button
          className="btn btn-light d-md-none border-0 shadow-sm rounded-3 p-1 px-2"
          onClick={toggleMobileSidebar}
          aria-label="Toggle menu"
        >
          <i className="bi bi-list fs-5"></i>
        </button>
        <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" id="page-title-display">
          <i className={`bi ${pageInfo.icon}`}></i> {pageInfo.title}
        </h5>
      </div>

      {/* Right controls: Theme switcher + Profile chip */}
      <div className="d-flex align-items-center gap-2 gap-md-3">
        {/* UI Theme Switcher */}
        <div className="ui-mode-switcher-container">
          <div className="ui-mode-pill d-flex align-items-center rounded-pill p-0.5 border" role="group">
            <button
              type="button"
              className={`btn btn-sm ui-mode-btn ${!isModern ? 'active' : ''}`}
              onClick={() => toggleTheme('classic')}
              title="Classic UI"
            >
              <i className="bi bi-display me-1"></i> <span className="d-none d-sm-inline">Classic</span> UI
            </button>
            <button
              type="button"
              className={`btn btn-sm ui-mode-btn ${isModern ? 'active' : ''}`}
              onClick={() => toggleTheme('modern')}
              title="Modern 3D Cyber UI"
            >
              <i className="bi bi-stars me-1 text-warning"></i> <span className="d-none d-sm-inline">Modern</span> 3D
            </button>
          </div>
        </div>

        {/* User Profile Chip */}
        <div className="position-relative">
          <button
            type="button"
            className="btn p-0 d-flex align-items-center text-decoration-none border-0 bg-transparent"
            onClick={() => setDropdownOpen(prev => !prev)}
            aria-expanded={dropdownOpen}
          >
            <div className="avatar avatar-gradient rounded-circle d-flex align-items-center justify-content-center fw-bold me-2 position-relative text-white" style={{ width: 38, height: 38, fontSize: '0.95rem' }}>
              {userInitial}
              <span className="position-absolute bottom-0 end-0 bg-success border border-white rounded-circle p-1" style={{ width: 10, height: 10 }}></span>
            </div>
            <div className="d-none d-sm-block text-start">
              <div className="fw-bold small leading-tight text-white">{user?.username || 'User'}</div>
              <div className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.65rem' }}>{roleDisplay}</div>
            </div>
            <i className="bi bi-chevron-down ms-1 text-muted small"></i>
          </button>

          {dropdownOpen && (
            <>
              <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1050 }} onClick={() => setDropdownOpen(false)}></div>
              <ul className="dropdown-menu dropdown-menu-end shadow border-0 rounded-3 mt-2 show position-absolute end-0" style={{ zIndex: 1055, minWidth: '180px' }}>
                <li className="px-3 py-1 border-bottom">
                  <div className="fw-bold small">{user?.username}</div>
                  <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{roleDisplay}</div>
                </li>
                {onOpenSelfPassword && (
                  <li>
                    <button
                      type="button"
                      className="dropdown-item py-2 d-flex align-items-center gap-2"
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenSelfPassword();
                      }}
                    >
                      <i className="bi bi-key-fill text-warning"></i> Change Password
                    </button>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    className="dropdown-item text-danger py-2 d-flex align-items-center gap-2"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                  >
                    <i className="bi bi-box-arrow-left"></i> Sign Out
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

