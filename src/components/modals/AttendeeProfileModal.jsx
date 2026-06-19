import React from 'react';

export default function AttendeeProfileModal({ show, onClose, attendee }) {
  if (!show || !attendee) return null;

  return (
    <div className="modal-overlay" id="attendee-profile-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{maxWidth: '440px'}}>
        <div className="modal-header">
          <h3 className="modal-title" style={{fontFamily: "'Outfit', sans-serif"}}>Attendee Profile</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{padding: '1.5rem'}}>
          <div style={{textAlign: 'center', marginBottom: '1.25rem'}}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 0.75rem', color: '#fff', fontWeight: 700, fontSize: '1.5rem',
              fontFamily: "'Outfit', sans-serif"
            }}>
              {attendee.email ? attendee.email.charAt(0).toUpperCase() : '?'}
            </div>
            <p style={{fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', margin: '0 0 0.25rem 0'}}>{attendee.email}</p>
            <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0}}>
              {attendee.tickets?.length || 0} ticket(s) booked
            </p>
          </div>

          {attendee.answers && Object.keys(attendee.answers).length > 0 && (
            <div style={{borderTop: '1px solid var(--divider)', paddingTop: '1rem'}}>
              <h4 style={{fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)'}}>Registration Answers</h4>
              {Object.entries(attendee.answers).map(([key, value]) => (
                <div key={key} style={{
                  marginBottom: '0.6rem', background: 'var(--bg-info-card)',
                  padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                  border: '1px solid var(--border-card)'
                }}>
                  <p style={{fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 0.15rem 0', textTransform: 'uppercase', letterSpacing: '0.02em'}}>
                    {key}
                  </p>
                  <p style={{fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 500, wordBreak: 'break-word', margin: 0}}>
                    {value || 'No answer provided.'}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div style={{marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
