import React from 'react';

export default function AttendeeDetailsModal({ show, onClose, ticket }) {
  if (!show || !ticket) return null;

  let answersHtml = null;
  if (ticket.answers && Object.keys(ticket.answers).length > 0) {
    answersHtml = (
      <div style={{marginTop: '1rem', borderTop: '1px solid var(--divider)', paddingTop: '1rem'}}>
        <h4 style={{fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif"}}>
          Attendee Registration Answers
        </h4>
        {Object.entries(ticket.answers).map(([key, value]) => (
          <div key={key} style={{
            marginBottom: '0.75rem', background: 'var(--bg-info-card)',
            padding: '0.6rem 0.75rem', borderRadius: '0.375rem',
            border: '1px solid var(--border-card)'
          }}>
            <p style={{fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.02em'}}>
              {key}
            </p>
            <p style={{fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500, wordBreak: 'break-word', whiteSpace: 'pre-wrap', margin: 0}}>
              {value || 'No answer provided.'}
            </p>
          </div>
        ))}
      </div>
    );
  } else {
    answersHtml = (
      <div style={{marginTop: '1.25rem', borderTop: '1px solid var(--divider)', paddingTop: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic'}}>
        No custom question responses available for this attendee.
      </div>
    );
  }

  const approvalStyle = ticket.approval === 'rejected'
    ? {backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)'}
    : {};

  return (
    <div className="modal-overlay" id="attendee-details-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{maxWidth: '500px'}}>
        <div className="modal-header">
          <h3 className="modal-title" style={{fontFamily: "'Outfit', sans-serif"}}>Attendee Registration Details</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{padding: '1.25rem', maxHeight: '80vh', overflowY: 'auto'}}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem',
            background: 'var(--bg-info-card)', border: '1px solid var(--divider)',
            padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem'
          }}>
            <p style={{margin: 0}}><strong>Email:</strong> {ticket.email}</p>
            <p style={{margin: 0}}>
              <strong>Ticket ID:</strong>{' '}
              <span className="monospaced-code" style={{fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)'}}>{ticket.id}</span>
            </p>
            <p style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <strong>Status:</strong>
              <span className={`badge-status ${ticket.status === 'checked-in' ? 'checked-in' : 'unused'}`} style={{margin: 0}}>
                {ticket.status === 'checked-in' ? 'Checked In' : 'Unused'}
              </span>
            </p>
            <p style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <strong>Approval:</strong>
              <span className={`badge-status ${ticket.approval === 'rejected' ? '' : (ticket.approval === 'approved' ? 'checked-in' : 'unused')}`}
                style={{margin: 0, ...approvalStyle}}>
                {(ticket.approval || 'approved').toUpperCase()}
              </span>
            </p>
            <p style={{margin: 0}}><strong>Payment Method:</strong> <span style={{textTransform: 'capitalize'}}>{ticket.payment || 'offline'}</span></p>
            <p style={{margin: 0}}><strong>Booking Date:</strong> {ticket.timestamp || '-'}</p>
          </div>
          {answersHtml}

          <div style={{marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{padding: '0.5rem 1.5rem'}}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
