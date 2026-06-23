import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useBookTickets } from '../hooks/useBookTickets';
import { useEventSettings } from '../hooks/useEventSettings';

export default function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
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

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }

    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        await setDoc(doc(db, 'users', user.email), {
          email: user.email,
          role: role,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`,
          createdAt: new Date().toISOString()
        });
      } catch(e) {
        console.error("Error saving user role", e);
      }

      login(user.email, role, firstName.trim(), lastName.trim());

      if (redirectQty && parseInt(redirectQty) > 0) {
        const savedAnswers = JSON.parse(sessionStorage.getItem('currentBookingAnswers') || '{}');
        await bookTicketsForUser(user.email, parseInt(redirectQty), ticketsRemaining, updateTicketsRemaining, savedAnswers, eventId, eventName);
        sessionStorage.removeItem('currentBookingAnswers');
        navigate('/');
      } else if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        navigate(role === 'admin' ? '/admin-dashboard' : '/');
      }
    } catch (err) {
      console.error("Error signing up:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container">
        <div className="auth-card">
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Join Perenti to book meetup passes and track check-ins seamlessly.</p>
          
          {error && (
            <div className="auth-error-banner" id="signup-error-alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'1.1rem', height:'1.1rem', flexShrink:0}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form className="modal-form" id="signup-form" onSubmit={handleSignup}>
            <div className="signup-name-row">
              <div className="form-group" style={{flex: 1}}>
                <label htmlFor="signup-first-name" className="form-label">First Name</label>
                <input type="text" id="signup-first-name" className="form-control" required placeholder="John"
                  value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="form-group" style={{flex: 1}}>
                <label htmlFor="signup-last-name" className="form-label">Last Name</label>
                <input type="text" id="signup-last-name" className="form-control" required placeholder="Smith"
                  value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-email" className="form-label">Email Address</label>
              <input type="email" id="signup-email" className="form-control" required placeholder="name@domain.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label htmlFor="signup-role" className="form-label">Account Role</label>
              <select id="signup-role" className="form-control" value={role} onChange={(e) => setRole(e.target.value)} style={{
                appearance: 'none', 
                backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%221.67%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E")`, 
                backgroundRepeat: 'no-repeat', 
                backgroundPosition: 'right 0.75rem center', 
                backgroundSize: '1.25rem'
              }}>
                <option value="user">General User (Book Passes)</option>
                <option value="admin">Event Organizer / Admin (Scan QR & Check-in)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="signup-password" className="form-label">Password</label>
              <input type="password" id="signup-password" className="form-control" required placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="form-group">
              <label htmlFor="signup-confirm-password" className="form-label">Confirm Password</label>
              <input type="password" id="signup-confirm-password" className="form-control" required placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{marginTop: '1rem'}} disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="auth-switch-prompt">
            Already have an account? <Link to={`/login${location.search}`}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
