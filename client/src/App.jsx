/**
 * client/src/App.jsx - Application Router & Providers
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DataRecords from './pages/DataRecords';
import ImportData from './pages/ImportData';
import AllRequests from './pages/AllRequests';
import MyRequests from './pages/MyRequests';
import UserManagement from './pages/UserManagement';
import PSList from './pages/PSList';
import SystemSettings from './pages/SystemSettings';

export default function App() {
  // Global Ctrl + Enter / Cmd + Enter Keyboard Shortcut for Submit Buttons across entire website
  useEffect(() => {
    const handleGlobalCtrlEnter = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        // 1. If an active modal is open on the screen (highest priority)
        const openModals = Array.from(document.querySelectorAll('.modal.show, .modal.d-block'));
        if (openModals.length > 0) {
          const topModal = openModals[openModals.length - 1];

          // Form submit button inside modal
          const modalFormSubmit = topModal.querySelector('form button[type="submit"]:not([disabled]), form input[type="submit"]:not([disabled])');
          if (modalFormSubmit) {
            e.preventDefault();
            e.stopPropagation();
            modalFormSubmit.click();
            return;
          }

          // Any submit button inside modal
          const anyModalSubmit = topModal.querySelector('button[type="submit"]:not([disabled])');
          if (anyModalSubmit) {
            e.preventDefault();
            e.stopPropagation();
            anyModalSubmit.click();
            return;
          }

          // Primary action buttons in modal footer (for review / export / print / confirm modals without a <form>)
          const modalActionBtn = topModal.querySelector(
            '.modal-footer .btn-primary:not([disabled]), .modal-footer .btn-success:not([disabled]), .modal-footer .btn-danger:not([disabled])'
          );
          if (modalActionBtn) {
            e.preventDefault();
            e.stopPropagation();
            modalActionBtn.click();
            return;
          }
        }

        // 2. If focus is inside an active element belonging to a form on the current page
        const activeEl = document.activeElement;
        if (activeEl) {
          const form = activeEl.closest('form');
          if (form) {
            const formSubmitBtn = form.querySelector('button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])');
            if (formSubmitBtn) {
              e.preventDefault();
              e.stopPropagation();
              formSubmitBtn.click();
              return;
            }
            if (typeof form.requestSubmit === 'function') {
              e.preventDefault();
              e.stopPropagation();
              form.requestSubmit();
              return;
            }
          }
        }

        // 3. Fallback: Any visible form with an enabled submit button on the page
        const visibleForm = document.querySelector('form');
        if (visibleForm && !visibleForm.closest('.modal:not(.show):not(.d-block)')) {
          const anySubmitBtn = visibleForm.querySelector('button[type="submit"]:not([disabled])');
          if (anySubmitBtn) {
            e.preventDefault();
            e.stopPropagation();
            anySubmitBtn.click();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalCtrlEnter, true);
    return () => window.removeEventListener('keydown', handleGlobalCtrlEnter, true);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes inside Main Shell */}
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="records" element={<DataRecords />} />
              <Route path="data-records" element={<DataRecords />} />
              <Route path="import" element={<ImportData />} />
              <Route path="import-data" element={<ImportData />} />
              <Route path="all-requests" element={<AllRequests />} />
              <Route path="edit-requests" element={<AllRequests />} />
              <Route path="delete-requests" element={<AllRequests />} />
              <Route path="my-requests" element={<MyRequests />} />
              <Route path="reactive-list" element={<MyRequests />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="user-management" element={<UserManagement />} />
              <Route path="ps" element={<PSList />} />
              <Route path="ps-list" element={<PSList />} />
              <Route path="settings" element={<SystemSettings />} />
              <Route path="dropdowns" element={<SystemSettings />} />
              <Route path="system-settings" element={<SystemSettings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

