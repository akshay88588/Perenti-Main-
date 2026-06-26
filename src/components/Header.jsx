import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { session, isAdmin, isUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  console.log("Header location.pathname:", location.pathname);

  return (
    <header className="site-header">
      <div className="header-container">
        <Link to="/" className="brand-link">
          <span className="brand-name">perenti</span>
          <span className="brand-tagline">Smart Events, Seamless Outcomes</span>
        </Link>


        <div className="header-actions" id="header-session-actions">
          {!session && (
            <>
              <Link to="/login" className="btn btn-outline btn-sm" id="btn-header-login">Login</Link>
              <Link to="/signup" className="btn btn-primary btn-sm" id="btn-header-signup">Sign Up</Link>
            </>
          )}

          {session && isUser && (
            <>
              <span className="session-email-text" id="session-email-display" style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)'}}>{session.displayName || session.email}</span>
              <Link to="/my-tickets" className="btn btn-secondary btn-sm" id="btn-header-my-tickets">My Tickets</Link>
              <button type="button" className="btn btn-outline btn-sm" id="btn-header-logout" onClick={handleLogout}>Logout</button>
            </>
          )}

          {session && isAdmin && (
            <>
              <span className="session-email-text" id="session-email-display" style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)'}}>{session.displayName || session.email}</span>
              <Link to="/admin-dashboard" className="btn btn-secondary btn-sm" id="btn-header-admin-panel">Admin Panel</Link>
              <button type="button" className="btn btn-outline btn-sm" id="btn-header-logout" onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
