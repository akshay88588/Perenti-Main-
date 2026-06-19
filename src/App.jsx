import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CreateEventPage from './pages/CreateEventPage';
import { isConfigured } from './config/firebase';

import './App.css';

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

  return (
    <>
      {/* We only show the header inside the App layout, but we need to conditionally
          hide it on some pages if needed. Currently, all pages have the header. */}
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
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

export default App;
