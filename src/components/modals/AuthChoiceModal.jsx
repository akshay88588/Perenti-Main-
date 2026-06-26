import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthChoiceModal({ show, onClose, qty, eventId, eventName }) {
  const navigate = useNavigate();

  if (!show) return null;

  return (
    <div className="modal-overlay" id="auth-choice-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{maxWidth: '440px'}}>
        <div className="modal-header">
          <h3 className="modal-title">Create Your Account</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{padding: '1.5rem'}}>
          <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>
            You need an account to book tickets. Choose how you'd like to proceed:
          </p>

          <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            <button type="button" className="btn btn-primary btn-block btn-lg"
              onClick={() => { onClose(); navigate(`/signup?qty=${qty}${eventId ? `&eventId=${eventId}` : ''}${eventName ? `&eventName=${encodeURIComponent(eventName)}` : ''}`); }}>
              Sign Up with Email
            </button>
            <button type="button" className="btn btn-outline btn-block btn-lg"
              onClick={() => { onClose(); navigate(`/login?qty=${qty}${eventId ? `&eventId=${eventId}` : ''}${eventName ? `&eventName=${encodeURIComponent(eventName)}` : ''}`); }}>
              I Already Have an Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
