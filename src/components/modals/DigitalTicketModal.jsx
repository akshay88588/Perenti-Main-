import React from 'react';

export default function DigitalTicketModal({ show, onClose, ticketIds, email, eventName, paymentMethod = 'offline' }) {
  if (!show || !ticketIds || ticketIds.length === 0) return null;

  const qty = ticketIds.length;

  const handleDownload = async () => {
    try {
      for (let i = 0; i < ticketIds.length; i++) {
        const ticketId = ticketIds[i];
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(ticketId)}`;
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `QR_Pass_${ticketId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Could not download QR code automatically. Please try taking a screenshot or printing.');
    }
  };

  return (
    <div className="modal-overlay" id="ticket-success-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" id="ticket-success-modal-card" style={{ maxWidth: '520px' }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)', borderBottom: '1px solid #a7f3d0' }}>
          <h3 className="modal-title" style={{ color: '#065f46' }}>🎉 Booking Confirmed!</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              Your <strong>{qty} ticket{qty > 1 ? 's' : ''}</strong> for the <strong>{eventName || 'Ebc 28th Meetup'}</strong> {qty > 1 ? 'have' : 'has'} been reserved successfully!
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              A confirmation email has been sent to <strong>{email}</strong>.
            </p>
          </div>

          <div id="generated-tickets-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {ticketIds.map((ticketId, i) => {
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketId)}`;
              return (
                <div key={ticketId} className="digital-ticket-card" style={{
                  border: '1px solid var(--divider)', borderRadius: '0.75rem', padding: '1.25rem',
                  display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-info-card)'
                }}>
                  <img src={qrUrl} alt={`QR Code for ${ticketId}`}
                    style={{ width: '90px', height: '90px', borderRadius: '0.5rem', border: '1px solid var(--divider)', padding: '4px', background: '#fff' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Pass {i + 1} of {qty}
                    </p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {ticketId}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      Status: <span style={{ color: paymentMethod === 'online' ? '#059669' : '#d97706', fontWeight: 600 }}>
                        {paymentMethod === 'online' ? 'Paid (Online)' : 'Unused (Offline Payment)'}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.75rem' }}>
            <button type="button" className="btn btn-primary btn-block" onClick={handleDownload} style={{ padding: '0.85rem', fontSize: '1.05rem', fontWeight: 700, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(90, 154, 142, 0.2)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download QR Ticket{qty > 1 ? 's' : ''}
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose} style={{ padding: '0.85rem', fontSize: '1.05rem', fontWeight: 700, borderRadius: '0.5rem' }}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
