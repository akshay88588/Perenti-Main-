import React from 'react';
import { compileEmailHtml } from '../../utils/emailjs';

export default function EmailPreviewModal({ show, onClose, email, ticketIds }) {
  if (!show || !ticketIds || ticketIds.length === 0) return null;

  const htmlContent = compileEmailHtml(email, ticketIds);

  return (
    <div className="modal-overlay" id="email-preview-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{maxWidth: '650px', maxHeight: '90vh'}}>
        <div className="modal-header">
          <h3 className="modal-title">📧 Email Preview</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{padding: '1rem', maxHeight: '75vh', overflowY: 'auto'}}>
          <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem'}}>
            This is a preview of the confirmation email sent to <strong>{email}</strong>.
          </p>
          <div style={{border: '1px solid var(--divider)', borderRadius: '0.5rem', overflow: 'hidden'}}>
            <iframe
              title="Email Preview"
              srcDoc={htmlContent}
              style={{width: '100%', minHeight: '500px', border: 'none'}}
              sandbox=""
            />
          </div>
          <div style={{marginTop: '1rem', display: 'flex', justifyContent: 'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close Preview</button>
          </div>
        </div>
      </div>
    </div>
  );
}
