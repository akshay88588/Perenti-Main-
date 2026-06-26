import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error === 'auth/user-not-found') {
          throw new Error('No account found with this email.');
        } else if (data.error === 'auth/invalid-email') {
          throw new Error('Invalid email format.');
        } else {
          throw new Error(data.error || 'Failed to send password reset email.');
        }
      }

      setMessage('Check your inbox for further instructions. (Also check your spam folder)');
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.message === 'No account found with this email.') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/invalid-email' || err.message === 'Invalid email format.') {
        setError('Invalid email format.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container">
        <div className="auth-card">
          <h2 className="auth-title">Reset Password</h2>
          <p className="auth-subtitle">Enter your email address to receive a password reset link.</p>

          {error && (
            <div className="auth-error-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'1.1rem', height:'1.1rem', flexShrink:0}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="auth-success-banner" style={{
              background: '#dcfce7', border: '1px solid #86efac', color: '#166534',
              padding: '1rem', borderRadius: '0.5rem', fontSize: '0.9rem',
              fontWeight: 500, marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              textAlign: 'left', lineHeight: '1.4'
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'1.2rem', height:'1.2rem', flexShrink:0, marginTop: '0.1rem'}}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>{message}</span>
            </div>
          )}

          <form className="modal-form" onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="reset-email" className="form-label">Email Address</label>
              <input type="email" id="reset-email" className="form-control" required placeholder="name@domain.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{marginTop: '1rem'}} disabled={loading}>
              {loading ? 'Sending...' : 'Reset Password'}
            </button>
          </form>

          <p className="auth-switch-prompt" style={{marginTop: '1.5rem'}}>
            <Link to="/login">Back to Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
