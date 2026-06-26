import React, { useState, useMemo } from 'react';
import { useRazorpay } from '../../hooks/useRazorpay';

export default function RegistrationSummaryModal({
  show, onClose, qty, setQty, ticketsRemaining, onCheckout, eventTicketPrice
}) {
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');

  const TICKET_PRICE = (eventTicketPrice != null && eventTicketPrice > 0) ? Number(eventTicketPrice) : 0;
  const isFree = TICKET_PRICE === 0;
  
  const PLATFORM_FEE = isFree ? 0 : 9.98;
  const GATEWAY_FEE = isFree ? 0 : 12.13;
  const GST_RATE = isFree ? 0 : 0.18;

  const calculations = useMemo(() => {
    const subtotal = TICKET_PRICE * qty;
    const discount = promoApplied && !isFree ? subtotal * 0.10 : 0;
    const afterDiscount = subtotal - discount;
    const fees = PLATFORM_FEE + GATEWAY_FEE;
    const gst = afterDiscount * GST_RATE;
    const total = afterDiscount + fees + gst;
    return { subtotal, discount, afterDiscount, fees, gst, total };
  }, [qty, promoApplied, TICKET_PRICE, PLATFORM_FEE, GATEWAY_FEE, GST_RATE, isFree]);

  const { initiatePayment, paymentStatus, error } = useRazorpay();

  if (!show) return null;

  const handleOnlinePayment = () => {
    // amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(calculations.total * 100);
    initiatePayment(
      amountInPaise, 
      (paymentDetails) => {
        // Success
        onCheckout(qty, calculations.total, 'online', paymentDetails.paymentId);
      },
      () => {
        // Cancelled
        console.log('Payment cancelled by user');
      }
    );
  };

  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'EBC10') {
      setPromoApplied(true);
      setPromoMessage('✅ Promo code "EBC10" applied! 10% off.');
    } else {
      setPromoApplied(false);
      setPromoMessage('❌ Invalid promo code.');
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(false);
    setPromoCode('');
    setPromoMessage('');
  };

  const handleQtyChange = (delta) => {
    const newQty = qty + delta;
    if (newQty >= 1 && newQty <= Math.min(10, ticketsRemaining)) {
      setQty(newQty);
    }
  };

  return (
    <div className="modal-overlay" id="summary-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" id="summary-modal-card" style={{maxWidth: '480px'}}>
        <div className="modal-header">
          <h3 className="modal-title">Booking Summary</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>
        <div className="modal-body" style={{padding: '1.5rem'}}>
          {/* Quantity Selector */}
          <div style={{marginBottom: '1.25rem'}}>
            <label style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem'}}>
              Number of Passes
            </label>
            <div className="goavo-quantity-selector" style={{display: 'inline-flex'}}>
              <button type="button" className="stepper-action-btn" onClick={() => handleQtyChange(-1)} disabled={qty <= 1}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <span className="stepper-count-val" id="summary-qty-display">{qty}</span>
              <button type="button" className="stepper-action-btn" onClick={() => handleQtyChange(1)} disabled={qty >= Math.min(10, ticketsRemaining)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div style={{background: 'var(--bg-info-card)', border: '1px solid var(--divider)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem'}}>
              <span>Ticket Price × {qty}</span>
              <span style={{fontWeight: 600}}>₹{calculations.subtotal.toFixed(2)}</span>
            </div>
            {promoApplied && !isFree && (
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#059669'}}>
                <span>Promo Discount (10%)</span>
                <span style={{fontWeight: 600}}>-₹{calculations.discount.toFixed(2)}</span>
              </div>
            )}
            {!isFree && (
              <>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)'}}>
                  <span>Platform Fee</span>
                  <span>₹{PLATFORM_FEE.toFixed(2)}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)'}}>
                  <span>Payment Gateway Fee</span>
                  <span>₹{GATEWAY_FEE.toFixed(2)}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-muted)'}}>
                  <span>GST (18%)</span>
                  <span>₹{calculations.gst.toFixed(2)}</span>
                </div>
              </>
            )}
            <div style={{borderTop: '1px solid var(--divider)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem'}}>
              <span>Total</span>
              <span id="summary-total-display" style={{color: 'var(--brand-primary)'}}>₹{calculations.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Promo Code Section - Hide if Free */}
          {!isFree && (
            <div style={{marginBottom: '1.25rem'}}>
              <label style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem'}}>
                Promo Code
              </label>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <input type="text" className="promo-textbox" placeholder="Enter promo code"
                  value={promoCode} onChange={(e) => setPromoCode(e.target.value)}
                  disabled={promoApplied}
                  style={{flex: 1, padding: '0.5rem 0.75rem', border: '1px solid var(--border-input)', borderRadius: '0.375rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)'}} />
                {!promoApplied ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleApplyPromo}>Apply</button>
                ) : (
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleRemovePromo} style={{borderColor: '#ef4444', color: '#ef4444'}}>Remove</button>
                )}
              </div>
              {promoMessage && (
                <p style={{fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600, color: promoApplied ? '#059669' : '#dc2626'}}>{promoMessage}</p>
              )}
            </div>
          )}

          {/* Payment Notice */}
          {!isFree && (
            <div style={{
              background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '0.5rem',
              padding: '0.75rem', fontSize: '0.8rem', color: '#065f46', marginBottom: '1.25rem',
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink: 0, marginTop: '0.1rem'}}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Secure online payment powered by <strong>Razorpay</strong>.</span>
            </div>
          )}

          {error && (
            <div style={{color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center'}}>
              {error}
            </div>
          )}

          <div style={{display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem'}}>
            {isFree ? (
              <button 
                type="button" 
                className="btn btn-primary btn-block" 
                onClick={() => onCheckout(qty, 0, 'free', null)}
                style={{
                  position: 'relative', 
                  padding: '0.85rem', 
                  fontSize: '1rem', 
                  fontWeight: 700, 
                  borderRadius: '0.5rem'
                }}
              >
                Complete Free Registration
              </button>
            ) : (
              <>
                <button 
                  type="button" 
                  className="btn btn-primary btn-block" 
                  onClick={handleOnlinePayment}
                  disabled={paymentStatus === 'processing'}
                  style={{
                    position: 'relative', 
                    padding: '0.85rem', 
                    fontSize: '1rem', 
                    fontWeight: 700, 
                    borderRadius: '0.5rem'
                  }}
                >
                  {paymentStatus === 'processing' ? 'Processing...' : `Pay ₹${calculations.total.toFixed(2)} Securely`}
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline btn-block" 
                  onClick={() => onCheckout(qty, calculations.total, 'offline', null)}
                  disabled={paymentStatus === 'processing'}
                  style={{ 
                    padding: '0.85rem', 
                    fontSize: '1rem', 
                    fontWeight: 700, 
                    borderRadius: '0.5rem',
                    borderWidth: '1.5px'
                  }}
                >
                  Skip and Pay at Venue
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
