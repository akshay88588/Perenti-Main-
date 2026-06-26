import React from 'react';
import { handleShareAction } from '../../utils/shareActions';
import { motion, AnimatePresence } from 'framer-motion';

export default function ShareModal({ show, onClose, eventName, eventId, eventSlug, setToastMessage }) {

  const handleNativeShare = async () => {
    const slug = eventSlug || (eventName ? eventName.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '') : '');
    const shareUrl = slug 
      ? `${window.location.origin}/events/${slug}`
      : (eventId ? `${window.location.origin}/?eventId=${eventId}` : window.location.href);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${eventName} - Perenti`,
          text: `Join me at ${eventName}!`,
          url: shareUrl,
        });
        onClose();
      } catch (err) {
        console.error('Error sharing natively:', err);
      }
    } else {
      setToastMessage("Native share not supported on this device.");
    }
  };

  const shareItem = (action) => {
    handleShareAction(action, setToastMessage, eventName, eventId, eventSlug);
    onClose();
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.4)' }}>
          <motion.div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{ padding: '2rem', maxWidth: '400px', width: '90%', borderRadius: '1.5rem', background: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: '"Outfit", sans-serif' }}>Share Event</h3>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <button className="share-btn-circle" onClick={() => shareItem('whatsapp')} style={{ background: '#25D366', color: 'white' }} title="WhatsApp">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
              <button className="share-btn-circle" onClick={() => shareItem('twitter')} style={{ background: '#1DA1F2', color: 'white' }} title="Twitter">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </button>
              <button className="share-btn-circle" onClick={() => shareItem('linkedin')} style={{ background: '#0077B5', color: 'white' }} title="LinkedIn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </button>
              <button className="share-btn-circle" onClick={() => shareItem('copy')} style={{ background: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border-card)' }} title="Copy Link">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>

            {navigator.share && (
              <button 
                onClick={handleNativeShare}
                style={{
                  width: '100%', padding: '0.8rem', borderRadius: '0.75rem', background: 'var(--brand-primary)', color: 'white',
                  border: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                Share via device
              </button>
            )}

            <style>{`
              .share-btn-circle {
                width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                border: none; cursor: pointer; transition: transform 0.2s; margin: 0 auto;
              }
              .share-btn-circle:hover { transform: scale(1.1); }
            `}</style>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
