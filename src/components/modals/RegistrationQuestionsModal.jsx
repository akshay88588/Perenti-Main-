import React, { useState, useEffect } from 'react';

export default function RegistrationQuestionsModal({ show, onClose, onSubmit, eventDetails }) {
  const [formConfig, setFormConfig] = useState([]);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    if (show) {
      let config = null;
      if (eventDetails && eventDetails.customRegistrationFields) {
        config = eventDetails.customRegistrationFields;
      } else {
        try {
          config = JSON.parse(localStorage.getItem('customRegistrationForm'));
        } catch (e) {}
      }

      if (!config || config.length === 0) {
        config = [
          { id: 'q-building', type: 'text', label: 'What are you building?', required: true },
          { id: 'q-about', type: 'textarea', label: 'Tell us about yourself', required: true },
          { id: 'q-role', type: 'radio', label: 'Role', required: true, options: 'Founder,Student,Investor,Professional' },
          { id: 'q-industry', type: 'select', label: 'Industry', required: true, options: 'Technology,Finance,Healthcare,Education,Other' },
          { id: 'q-linkedin', type: 'text', label: 'LinkedIn URL', required: false },
          { id: 'q-instagram', type: 'text', label: 'Instagram URL', required: false },
          { id: 'q-website', type: 'text', label: 'Personal Website URL', required: false },
          { id: 'q-cofounder', type: 'toggle', label: 'Looking for Co-founder?', required: false }
        ];
      }
      setFormConfig(config);
      
      const initialAnswers = {};
      config.forEach(q => {
        if (q.type === 'toggle') {
          initialAnswers[q.label] = 'No';
        }
      });
      setAnswers(initialAnswers);
    }
  }, [show, eventDetails]);

  if (!show) return null;

  const handleChange = (label, value) => {
    setAnswers(prev => ({ ...prev, [label]: value }));
  };

  const formatPlaceholder = (label) => {
    let cleanLabel = label.replace(/\s*\([Oo]ptional\)/gi, '');
    if (cleanLabel.toLowerCase() === 'personal website') {
      cleanLabel = 'Personal Website URL';
    }
    return `Enter ${cleanLabel}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate required
    for (const q of formConfig) {
      const isRequired = q.required === true || q.required === 'true';
      if (isRequired && (!answers[q.label] || String(answers[q.label]).trim() === '')) {
        const cleanLabel = q.label.replace(/\s*\([Oo]ptional\)/gi, '');
        alert(`Please answer the required field: "${cleanLabel}"`);
        return;
      }
    }
    onSubmit(answers);
  };

  return (
    <div className="modal-overlay" id="questions-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" id="questions-modal-card" style={{maxWidth: '520px'}}>
        <div className="modal-header">
          <h3 className="modal-title">A Few Quick Questions</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto'}}>
          <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem'}}>
            Help us personalize your experience. This information will be shared with the event organizer.
          </p>

          <form id="dynamic-questions-form" onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
            {formConfig.map((q) => {
              const isRequired = q.required === true || q.required === 'true';
              const cleanLabel = q.label.replace(/\s*\([Oo]ptional\)/gi, '');
              return (
                <div className="form-group" key={q.id} style={{margin: 0}}>
                  <label className="form-label" style={{fontSize: '0.85rem'}}>
                    {cleanLabel} {isRequired && <span style={{color: '#ef4444'}}>*</span>}
                  </label>

                  {q.type === 'text' && (
                    <input type="text" className="form-control" placeholder={formatPlaceholder(q.label)}
                      value={answers[q.label] || ''} onChange={(e) => handleChange(q.label, e.target.value)}
                      required={isRequired} />
                  )}

                  {q.type === 'textarea' && (
                    <textarea className="form-control" rows="3" placeholder={formatPlaceholder(q.label)}
                      value={answers[q.label] || ''} onChange={(e) => handleChange(q.label, e.target.value)}
                      required={isRequired} style={{fontFamily: 'inherit', resize: 'vertical'}} />
                  )}

                  {q.type === 'radio' && q.options && (
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                      {q.options.split(',').map(opt => opt.trim()).map(opt => (
                        <label key={opt} className="pill-radio-label" style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.4rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s',
                          border: answers[q.label] === opt ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-input)',
                          backgroundColor: answers[q.label] === opt ? 'rgba(90,154,142,0.08)' : 'var(--bg-input)',
                          color: answers[q.label] === opt ? 'var(--brand-primary)' : 'var(--text-secondary)'
                        }}>
                          <input type="radio" name={q.id} value={opt} checked={answers[q.label] === opt}
                            onChange={() => handleChange(q.label, opt)} style={{display: 'none'}} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === 'select' && q.options && (
                    <select className="form-control" value={answers[q.label] || ''}
                      onChange={(e) => handleChange(q.label, e.target.value)} required={isRequired}>
                      <option value="" disabled>Select...</option>
                      {q.options.split(',').map(opt => opt.trim()).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {q.type === 'toggle' && (
                    <label className="toggle-switch" style={{display: 'inline-flex'}}>
                      <input type="checkbox" checked={answers[q.label] === 'Yes'}
                        onChange={(e) => handleChange(q.label, e.target.checked ? 'Yes' : 'No')} />
                      <span className="toggle-slider"></span>
                    </label>
                  )}
                </div>
              );
            })}

            <button type="submit" className="btn btn-primary btn-block btn-lg" id="btn-questions-submit">
              Continue to Summary →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
