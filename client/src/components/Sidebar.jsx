/**
 * client/src/components/Sidebar.jsx
 * Application Sidebar Navigation with Active Route highlighting & Permission gates
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ mobileOpen, setMobileOpen, onOpenSelfPassword }) {
  const { user, logout, isAdmin, canImport, canAccessPS } = useAuth();
  const navigate = useNavigate();

  const handleNav = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <nav id="sidebar" className={`d-flex flex-column ${mobileOpen ? 'active mobile-open' : ''}`}>
      {/* Brand / Logo */}
      <div className="sidebar-header d-flex align-items-center justify-content-between p-3 border-bottom border-secondary border-opacity-25">
        <NavLink
          to="/dashboard"
          id="brand-logo-link"
          className="navbar-brand d-flex align-items-center gap-2 m-0 text-decoration-none"
          onClick={handleNav}
        >
          <div className="brand-icon-3d">
            <i className="bi bi-layers-half text-cyan fs-4"></i>
          </div>
          <span className="fw-bold tracking-tight text-white fs-5">
            JAM <span className="text-cyan fw-semibold">Portal</span>
          </span>
        </NavLink>
        <button
          className="btn btn-sm btn-link text-white d-md-none p-0 border-0"
          onClick={() => setMobileOpen(false)}
          aria-label="Close Sidebar"
        >
          <i className="bi bi-x-lg fs-5"></i>
        </button>
      </div>

      {/* Navigation List */}
      <ul className="nav nav-pills flex-column p-3 gap-1 sidebar-nav-list flex-grow-1">
        {/* Dashboard */}
        <li className="nav-item">
          <NavLink
            to="/dashboard"
            id="nav-dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNav}
          >
            <div className="nav-icon-3d nav-icon-dashboard">
              <i className="bi bi-speedometer2"></i>
            </div>
            <span>Dashboard</span>
          </NavLink>
        </li>

        {/* Data Records */}
        <li className="nav-item">
          <NavLink
            to="/records"
            id="nav-records"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNav}
          >
            <div className="nav-icon-3d nav-icon-records">
              <i className="bi bi-table"></i>
            </div>
            <span>Data Records</span>
          </NavLink>
        </li>

        {/* Import Data */}
        {canImport && (
          <li className="nav-item">
            <NavLink
              to="/import"
              id="nav-import"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={handleNav}
            >
              <div className="nav-icon-3d nav-icon-import">
                <i className="bi bi-file-earmark-arrow-up-fill"></i>
              </div>
              <span>Import Data</span>
            </NavLink>
          </li>
        )}

        {/* All Requests (Admin) */}
        {isAdmin && (
          <li className="nav-item" id="nav-item-all-requests">
            <NavLink
              to="/all-requests"
              id="nav-all-requests"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={handleNav}
            >
              <div className="nav-icon-3d nav-icon-all-requests">
                <i className="bi bi-inbox-fill"></i>
              </div>
              <span>All Requests</span>
            </NavLink>
          </li>
        )}

        {/* My Requests */}
        <li className="nav-item" id="nav-item-my-requests">
          <NavLink
            to="/my-requests"
            id="nav-my-requests"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNav}
          >
            <div className="nav-icon-3d nav-icon-my-requests">
              <i className="bi bi-send-fill"></i>
            </div>
            <span>My Requests</span>
          </NavLink>
        </li>

        {/* User Management (Admin) */}
        {isAdmin && (
          <li className="nav-item" id="nav-item-users">
            <NavLink
              to="/users"
              id="nav-users"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={handleNav}
            >
              <div className="nav-icon-3d nav-icon-users">
                <i className="bi bi-people-fill"></i>
              </div>
              <span>User Management</span>
            </NavLink>
          </li>
        )}

        {/* PS List */}
        {canAccessPS && (
          <li className="nav-item" id="nav-item-ps-list">
            <NavLink
              to="/ps"
              id="nav-ps"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={handleNav}
            >
              <div className="nav-icon-3d nav-icon-ps">
                <i className="bi bi-shield-check"></i>
              </div>
              <span>PS List</span>
            </NavLink>
          </li>
        )}

        {/* System Settings (Admin) */}
        {isAdmin && (
          <li className="nav-item" id="nav-item-dropdowns">
            <NavLink
              to="/settings"
              id="nav-settings"
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={handleNav}
            >
              <div className="nav-icon-3d nav-icon-settings">
                <i className="bi bi-gear-wide-connected"></i>
              </div>
              <span>System Settings</span>
            </NavLink>
          </li>
        )}
      </ul>

      {/* User Profile & Sign Out Footer */}
      <div className="mt-auto p-3 border-top border-secondary border-opacity-25 d-flex flex-column gap-2">
        <button
          className="btn btn-outline-danger w-100 btn-sm rounded-3 py-2 d-flex align-items-center justify-content-center gap-2 fw-medium"
          onClick={logout}
        >
          <div className="nav-icon-3d nav-icon-logout">
            <i className="bi bi-box-arrow-left"></i>
          </div>
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}

