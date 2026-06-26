import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useBookTickets } from '../hooks/useBookTickets';
import { useEventSettings } from '../hooks/useEventSettings';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { bookTicketsForUser } = useBookTickets();
  const { ticketsRemaining, updateTicketsRemaining } = useEventSettings();

  const urlParams = new URLSearchParams(location.search);
  const redirectQty = urlParams.get('qty');
  const redirectUrl = urlParams.get('redirect');
  const eventId = urlParams.get('eventId');
  const eventName = urlParams.get('eventName');

  const handleSuccessfulLogin = async (userEmail) => {
    let role = 'user';
    if (userEmail === 'admin@perenti.com') {
      role = 'admin';
      try {
        await setDoc(doc(db, 'users', userEmail), { email: userEmail, role: 'admin' }, { merge: true });
      } catch (e) {
        console.error("Could not write admin to users collection:", e);
      }
    } else {
      try {
        const userDoc = await getDoc(doc(db, 'users', userEmail));
        if (userDoc.exists()) {
          role = userDoc.data().role || 'user';
        }
      } catch (e) { console.error("Error fetching role", e); }
    }
    
    login(userEmail, role);

    if (role === 'admin') {
      navigate('/admin-dashboard');
    } else {
      if (redirectQty && parseInt(redirectQty) > 0) {
        const savedAnswers = JSON.parse(sessionStorage.getItem('currentBookingAnswers') || '{}');
        await bookTicketsForUser(userEmail, parseInt(redirectQty), ticketsRemaining, updateTicketsRemaining, savedAnswers, eventId, eventName);
        sessionStorage.removeItem('currentBookingAnswers');
        navigate('/');
      } else if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        navigate('/');
      }
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleSuccessfulLogin(userCredential.user.email);
    } catch (loginError) {
      if (email.endsWith('@perenti.com')) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await handleSuccessfulLogin(userCredential.user.email);
        } catch (createError) {
          if (loginError.code === 'auth/invalid-credential' || loginError.code === 'auth/wrong-password') {
            setError("Incorrect password. Please try again.");
          } else {
            setError(loginError.message);
          }
        }
      } else {
        if (loginError.code === 'auth/invalid-credential' || loginError.code === 'auth/wrong-password') {
          setError("Incorrect password. Please try again.");
        } else {
          setError(loginError.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleSuccessfulLogin(result.user.email);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
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
          <h2 className="auth-title">Log in to Perenti</h2>
          <p className="auth-subtitle">Welcome back. Enter your credentials to manage your account or book passes.</p>

          {error && (
            <div className="auth-error-banner" id="login-error-alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'1.1rem', height:'1.1rem', flexShrink:0}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form className="modal-form" id="login-form" onSubmit={handleEmailLogin}>
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <input type="email" id="login-email" className="form-control" required placeholder="name@domain.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <label htmlFor="login-password" className="form-label" style={{marginBottom: 0}}>Password</label>
                <Link to="/forgot-password" style={{fontSize: '0.8rem', color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 500}}>Forgot password?</Link>
              </div>
              <input type="password" id="login-password" className="form-control" required placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} style={{marginTop: '0.5rem'}} />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{marginTop: '1rem'}} disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div className="oauth-divider">
            <span>Or log in with Google</span>
          </div>

          <button type="button" className="btn btn-outline btn-block btn-lg" id="btn-google-login" onClick={handleGoogleLogin} disabled={loading}>
            <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{width: '1.25rem', height: '1.25rem', marginRight: '0.5rem'}}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <p className="auth-switch-prompt">
            Don't have an account? <Link to={`/signup${location.search}`}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
