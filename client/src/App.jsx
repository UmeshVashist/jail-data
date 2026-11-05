/**
 * client/src/App.jsx - Application Router & Providers
 */

import React from 'react';
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

