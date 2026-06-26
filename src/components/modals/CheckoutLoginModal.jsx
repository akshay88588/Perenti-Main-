import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export default function CheckoutLoginModal({ show, onClose, qty, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  if (!show) return null;

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = cred.user.email;

      let role = 'user';
      if (userEmail === 'admin@perenti.com') {
        role = 'admin';
      } else {
        try {
          const roleDoc = await getDoc(doc(db, 'users', cred.user.uid));
          if (roleDoc.exists() && roleDoc.data().role) {
            role = roleDoc.data().role;
          }
        } catch(e) {
          console.warn("Could not fetch user role, defaulting to 'user':", e);
        }
      }

      login(userEmail, role);
      setLoading(false);

      if (role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        if (onLoginSuccess) onLoginSuccess(userEmail, qty);
      }
    } catch (err) {
      setLoading(false);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("No account found. Please sign up first.");
      } else if (err.code === 'auth/wrong-password') {
        setError("Incorrect password. Please try again.");
      } else {
        setError(err.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email;

      let role = 'user';
      try {
        const roleDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (roleDoc.exists() && roleDoc.data().role) {
          role = roleDoc.data().role;
        }
      } catch(e) {
        console.warn("Could not fetch user role, defaulting to 'user':", e);
      }

      login(userEmail, role);
      setLoading(false);

      if (role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        if (onLoginSuccess) onLoginSuccess(userEmail, qty);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" id="checkout-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{maxWidth: '440px'}}>
        <div className="modal-header">
          <h3 className="modal-title">Login to Continue</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{padding: '1.5rem'}}>
          <p className="modal-body-subtitle" style={{marginBottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem'}}>
            Please login or sign up to complete your booking of <strong>{qty} ticket(s)</strong>.
          </p>

          {error && (
            <div className="auth-error-banner" style={{
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
              padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem',
              fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleEmailLogin} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            <div className="form-group" style={{margin: 0}}>
              <label className="form-label" htmlFor="checkout-email">Email Address</label>
              <input type="email" id="checkout-email" className="form-control" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group" style={{margin: 0}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <label className="form-label" htmlFor="checkout-password" style={{marginBottom: 0}}>Password</label>
                <a href="/forgot-password" onClick={(e) => { e.preventDefault(); onClose(); navigate('/forgot-password'); }} style={{fontSize: '0.8rem', color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 500}}>Forgot password?</a>
              </div>
              <input type="password" id="checkout-password" className="form-control" placeholder="Enter your password"
                value={password} onChange={(e) => setPassword(e.target.value)} required style={{marginTop: '0.5rem'}} />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" id="btn-checkout-login" disabled={loading}>
              {loading ? 'Logging in...' : 'Login & Continue'}
            </button>
          </form>

          <div className="auth-divider" style={{display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0'}}>
            <hr style={{flex: 1, border: 'none', borderTop: '1px solid var(--divider)'}} />
            <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600}}>OR</span>
            <hr style={{flex: 1, border: 'none', borderTop: '1px solid var(--divider)'}} />
          </div>

          <button type="button" className="btn btn-outline btn-block btn-lg" id="btn-checkout-google" onClick={handleGoogleLogin} disabled={loading}
            style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path></svg>
            Continue with Google
          </button>

          <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem'}}>
            Don't have an account? <a href="/signup" style={{color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none'}} onClick={(e) => { e.preventDefault(); onClose(); navigate(`/signup?qty=${qty}`); }}>Sign up here</a>
          </p>
        </div>
      </div>
    </div>
  );
}
