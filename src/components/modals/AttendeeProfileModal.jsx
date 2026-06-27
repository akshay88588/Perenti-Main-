import React, { useEffect } from 'react';

export default function AttendeeProfileModal({ show, onClose, attendee, customQuestions }) {
  // ESC key listener for accessibility
  useEffect(() => {
    if (!show) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose]);

  if (!show || !attendee) return null;

  const email = attendee.email || '';
  // Derive name from email or answers
  const displayName = email ? email.split('@')[0].split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Attendee';
  const initial = displayName.charAt(0).toUpperCase();

  // Extract answers safely
  const answers = attendee.answers || {};
  const bio = answers['Tell us about yourself'] || answers['bio'] || '';
  const role = answers['Role'] || answers['role'] || '';
  const industry = answers['Industry'] || answers['industry'] || '';
  const linkedin = answers['LinkedIn URL (Optional)'] || answers['LinkedIn URL'] || answers['linkedin'] || '';
  const instagram = answers['Instagram URL (Optional)'] || answers['Instagram URL'] || answers['instagram'] || '';
  const website = answers['Personal Website (Optional)'] || answers['Personal Website'] || answers['Personal Website URL'] || answers['website'] || '';
  const building = answers['What are you building?'] || answers['building'] || '';

  const isQuestionVisible = (label) => {
    if (!customQuestions) return true;
    const q = customQuestions.find(field => {
      const fLabel = (field.label || '').toLowerCase().trim().replace(/\s*\([Oo]ptional\)/gi, '');
      const target = label.toLowerCase().trim().replace(/\s*\([Oo]ptional\)/gi, '');
      return fLabel.includes(target) || target.includes(fLabel);
    });
    if (!q) return true;
    return q.showOnProfile !== false;
  };

  const showBio = isQuestionVisible('Tell us about yourself') || isQuestionVisible('bio');
  const showBuilding = isQuestionVisible('What are you building?') || isQuestionVisible('building');
  const showRole = isQuestionVisible('Role') || isQuestionVisible('role');
  const showIndustry = isQuestionVisible('Industry') || isQuestionVisible('industry');
  const showLinkedin = isQuestionVisible('LinkedIn URL') || isQuestionVisible('linkedin');
  const showInstagram = isQuestionVisible('Instagram URL') || isQuestionVisible('instagram');
  const showWebsite = isQuestionVisible('Personal Website') || isQuestionVisible('website');

  // Helper to ensure URL starts with protocol for external links
  const formatUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  };

  return (
    <div 
      className="modal-overlay" 
      id="attendee-profile-modal-overlay" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="modal-card" style={{ maxWidth: '460px', borderRadius: '1rem', overflow: 'hidden' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--divider)', padding: '1.25rem 1.5rem' }}>
          <h3 id="profile-modal-title" className="modal-title" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>
            Attendee Profile
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal" style={{ fontSize: '1.5rem', cursor: 'pointer' }}>
            &times;
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '1.75rem 1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Avatar and Primary Info */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{
              width: '80px', 
              height: '80px', 
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover))',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 1rem', 
              color: '#ffffff', 
              fontWeight: 700, 
              fontSize: '2rem',
              fontFamily: "'Outfit', sans-serif",
              boxShadow: 'var(--shadow-sm)'
            }}>
              {initial || '?'}
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontFamily: "'Outfit', sans-serif" }}>
              {displayName}
            </h4>
            {email && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                {email}
              </p>
            )}

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--divider)', paddingTop: '1.25rem' }}>
            {/* Bio */}
            {showBio && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--brand-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                  Bio
                </span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                  {bio || 'No biography provided.'}
                </p>
              </div>
            )}

            {/* What are you building */}
            {showBuilding && building && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--brand-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                  What I'm Building
                </span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5', margin: 0, fontStyle: 'italic' }}>
                  "{building}"
                </p>
              </div>
            )}

            {/* Role & Industry in a grid */}
            {(showRole || showIndustry) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {showRole && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--brand-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                      Role
                    </span>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, fontWeight: 500 }}>
                      {role || 'Not specified'}
                    </p>
                  </div>
                )}
                {showIndustry && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--brand-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                      Industry
                    </span>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, fontWeight: 500 }}>
                      {industry || 'Not specified'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Social Links */}
            {((showLinkedin && linkedin) || (showInstagram && instagram) || (showWebsite && website)) && (
              <div style={{ borderTop: '1px solid var(--divider)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--brand-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>
                  Connect
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {showLinkedin && linkedin && (
                    <a 
                      href={formatUrl(linkedin)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="share-menu-item"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        textDecoration: 'none', 
                        fontSize: '0.88rem', 
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--divider)',
                        backgroundColor: 'var(--bg-info-card)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.2rem', height: '1.2rem', color: '#0077b5' }}>
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>LinkedIn Profile</span>
                    </a>
                  )}
                  {showInstagram && instagram && (
                    <a 
                      href={formatUrl(instagram)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="share-menu-item"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        textDecoration: 'none', 
                        fontSize: '0.88rem', 
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--divider)',
                        backgroundColor: 'var(--bg-info-card)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.2rem', height: '1.2rem', color: '#e1306c' }}>
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204 0.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Instagram</span>
                    </a>
                  )}
                  {showWebsite && website && (
                    <a 
                      href={formatUrl(website)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="share-menu-item"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        textDecoration: 'none', 
                        fontSize: '0.88rem', 
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--divider)',
                        backgroundColor: 'var(--bg-info-card)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1.2rem', height: '1.2rem', color: 'var(--brand-primary)' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Personal Website</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--divider)', paddingTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1.5rem' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
