/**
 * client/src/layouts/MainLayout.jsx
 * Main Application Shell Layout with Sidebar, Header, 3D Canvas, Toasts, ErrorBoundary and Global Shortcuts
 */

import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import CyberBackground3D from '../components/CyberBackground3D';
import ToastContainer from '../components/ToastContainer';
import SelfChangePasswordModal from '../components/modals/SelfChangePasswordModal';
import ErrorBoundary from '../components/ErrorBoundary';

export default function MainLayout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selfPasswordOpen, setSelfPasswordOpen] = useState(false);

  // Global '/' keyboard shortcut to focus active search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
          return;
        }
        e.preventDefault();
        // Look for the visible search bar
        const searchInput = document.querySelector('input[type="text"][data-search-slash="true"], .search-slash-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-dark text-white">
        <div className="spinner-border text-cyan mb-2" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Loading Portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div id="app-shell" className="d-flex min-vh-100 position-relative">
      {/* 3D WebGL Background Canvas */}
      <CyberBackground3D />

      {/* Sidebar Navigation */}
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenSelfPassword={() => setSelfPasswordOpen(true)}
      />

      {/* Main Content Area */}
      <div id="content" className="d-flex flex-column flex-grow-1 min-vw-0 position-relative" style={{ zIndex: 1 }}>
        <Header
          toggleMobileSidebar={() => setMobileOpen(prev => !prev)}
          onOpenSelfPassword={() => setSelfPasswordOpen(true)}
        />
        <main className="p-3 p-md-4 flex-grow-1">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Notifications */}
      <ToastContainer />

      {/* Change Password Modal */}
      <SelfChangePasswordModal
        isOpen={selfPasswordOpen}
        onClose={() => setSelfPasswordOpen(false)}
      />
    </div>
  );
}
