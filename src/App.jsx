import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CreateEventPage from './pages/CreateEventPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import { isConfigured } from './config/firebase';

import './App.css';

// Routes that render their own custom header — suppress the global one there
const ROUTES_WITH_OWN_HEADER = ['/create-event', '/admin-dashboard'];


function AppContent() {
  const location = useLocation();
  const hideGlobalHeader = ROUTES_WITH_OWN_HEADER.includes(location.pathname);

  return (
    <>
      {!hideGlobalHeader && <Header />}
      <Routes>
        {/* Homepage: events list OR event detail (via ?eventId= or /events/:eventName) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/events/:eventName" element={<HomePage />} />
        {/* Keep legacy route for backward compatibility */}
        <Route path="/event/:slug" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* My Tickets — only shows user's booked tickets */}
        <Route path="/my-tickets" element={
          <ProtectedRoute requiredRole="user">
            <UserDashboard />
          </ProtectedRoute>
        } />
        {/* Legacy alias */}
        <Route path="/user-dashboard" element={
          <ProtectedRoute requiredRole="user">
            <UserDashboard />
          </ProtectedRoute>
        } />

        <Route path="/admin-dashboard" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/create-event" element={
          <ProtectedRoute requiredRole="admin">
            <CreateEventPage />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

function App() {
  if (!isConfigured) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--brand-primary)', marginBottom: '1rem' }}>Setup Required</h1>
        <p style={{ maxWidth: '600px', lineHeight: '1.6', color: 'var(--text-main)' }}>
          Firebase is not configured. The application needs a <code>.env</code> file with valid Firebase credentials to run.
          Please rename <code>.env.example</code> to <code>.env</code> and fill in your Firebase project details, then restart the development server.
        </p>
      </div>
    );
  }

  return <AppContent />;
}

export default App;
