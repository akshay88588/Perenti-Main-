import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEventSettings } from '../hooks/useEventSettings';
import { useBookTickets } from '../hooks/useBookTickets';

// Modals
import AuthChoiceModal from '../components/modals/AuthChoiceModal';
import CheckoutLoginModal from '../components/modals/CheckoutLoginModal';
import RegistrationQuestionsModal from '../components/modals/RegistrationQuestionsModal';
import RegistrationSummaryModal from '../components/modals/RegistrationSummaryModal';
import DigitalTicketModal from '../components/modals/DigitalTicketModal';
import EmailPreviewModal from '../components/modals/EmailPreviewModal';
import Toast from '../components/Toast';
import { handleShareAction } from '../utils/shareActions';

export default function HomePage() {
  const [qty, setQty] = useState(1);
  const { session } = useAuth();
  const navigate = useNavigate();
  const { ticketsRemaining, updateTicketsRemaining } = useEventSettings();
  const { bookTicketsForUser } = useBookTickets();
  
  // Modal states
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const [showCheckoutLogin, setShowCheckoutLogin] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showDigitalTicket, setShowDigitalTicket] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  const [generatedTicketIds, setGeneratedTicketIds] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  const TICKET_PRICE = 399;

  // Handles clicking the main 'Register' button
  const handleRegisterClick = () => {
    if (session) {
      if (session.role === 'admin') {
        alert("Event administrators cannot book passes. Please register or log in as a General User to proceed.");
        return;
      }
      setShowQuestions(true);
    } else {
      setShowAuthChoice(true);
    }
  };

  const handleAuthChoiceClose = () => setShowAuthChoice(false);
  const handleCheckoutLoginClose = () => setShowCheckoutLogin(false);
  const handleQuestionsClose = () => setShowQuestions(false);
  const handleSummaryClose = () => setShowSummary(false);

  // When questions are submitted, store them and show summary
  const handleQuestionsSubmit = (answers) => {
    sessionStorage.setItem('currentBookingAnswers', JSON.stringify(answers));
    setShowQuestions(false);
    setShowSummary(true);
  };

  // Final checkout from Summary modal
  const handleCheckout = async (finalQty, finalTotal) => {
    setShowSummary(false);
    
    try {
      const answers = JSON.parse(sessionStorage.getItem('currentBookingAnswers') || '{}');
      const ticketIds = await bookTicketsForUser(session.email, finalQty, ticketsRemaining, updateTicketsRemaining, answers);
      
      setGeneratedTicketIds(ticketIds);
      setShowDigitalTicket(true);
      sessionStorage.removeItem('currentBookingAnswers');
    } catch (error) {
      console.error("Error booking tickets: ", error);
      alert("Failed to book tickets. Error details: " + error.message);
      setShowSummary(true);
    }
  };

  return (
    <main className="page-main">
      <div className="content-wrapper">
        {/* Event Banner Section */}
        <section className="event-banner-section">
          <div className="banner-flex-container">
            
            <div className="banner-poster-col">
              <img src="/ebc_meetup_banner.jpg" alt="Ebc 28th Meetup Poster" className="event-poster-img" />
            </div>
            
            <div className="banner-info-col">
              <span className="banner-meta-tag">TICKETS</span>
              <div className="event-title-container">
                <h1 className="event-main-title">Ebc 28th Meetup</h1>
                <div className="share-dropdown-wrapper">
                  <button type="button" className="btn-share-icon" onClick={() => setShowShareMenu(!showShareMenu)} title="Share Event">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </button>
                  <div className={`share-dropdown-menu ${showShareMenu ? 'show' : ''}`}>
                    <button type="button" className="share-menu-item" onClick={() => {handleShareAction('copy', setToastMessage); setShowShareMenu(false);}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      <span>Copy Link</span>
                    </button>
                    <button type="button" className="share-menu-item" onClick={() => {handleShareAction('whatsapp', setToastMessage); setShowShareMenu(false);}}>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                    <button type="button" className="share-menu-item" onClick={() => {handleShareAction('twitter', setToastMessage); setShowShareMenu(false);}}>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </button>
                    <button type="button" className="share-menu-item" onClick={() => {handleShareAction('linkedin', setToastMessage); setShowShareMenu(false);}}>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <p className="event-main-description">
                Join us at the Ebc 28th meetup, where aspiring founders, business owners, professionals, and students can share their stories. You'll have one minute to introduce yourself and discuss what you're building.
              </p>
              
              <div className="event-cards-grid">
                <div className="info-card">
                  <div className="info-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  </div>
                  <div className="info-card-text">
                    <span className="info-card-label">Date</span>
                    <span className="info-card-value">Sunday, June 14th 2026</span>
                  </div>
                </div>
                
                <div className="info-card">
                  <div className="info-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </div>
                  <div className="info-card-text">
                    <span className="info-card-label">Time</span>
                    <span className="info-card-value">9:00 AM - 11:00 AM</span>
                    <span className="info-card-sub">Asia/Kolkata</span>
                  </div>
                </div>
                
                <div className="info-card">
                  <div className="info-card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  </div>
                  <div className="info-card-text">
                    <span className="info-card-label">Venue</span>
                    <span className="info-card-value">Birch Cafe Vanasthalipuram, Hyderabad</span>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </section>

        <div className="event-grid-layout">
          <div className="event-details-col">
            <h2 className="panel-section-title">About Ebc 28th Meetup</h2>
            <div className="about-rich-details" style={{marginTop: '1rem'}}>
              <p>Welcome to the <strong>Ekthaa Business & Builders Community (EBC)</strong>! We are the premier ecosystem in Hyderabad connecting founders, creators, software engineers, operators, and startup builders.</p>
              <p>Our monthly meetups are outcome-driven professional gatherings designed to break down barriers, create direct collaboration channels, and help you find co-founders, advisors, beta testers, and business partners.</p>
              
              <div className="details-feature-highlights">
                <h4>What to expect:</h4>
                <ul>
                  <li>💡 <strong>Curated Networking:</strong> Meet builders and developers actively building in AI, Web3, and SaaS.</li>
                  <li>🤝 <strong>Open Mic & Pitch:</strong> A 1-minute quick fire slot for anyone to introduce themselves and describe what they're building.</li>
                  <li>🍳 <strong>English Breakfast & Coffee:</strong> Included with your entry pass to fuel morning conversations.</li>
                </ul>
              </div>

              <div className="details-cta-banner">
                <button type="button" className="btn btn-primary btn-block btn-lg" onClick={handleRegisterClick}>
                  Register for Meetup Pass
                </button>
              </div>
            </div>
          </div>
          
          <div className="event-attendees-col">
            <div className="goavo-ticket-card">
              <div className="ticket-left-band">
                <span className="vertical-paid-text">PAID</span>
              </div>
              <div className="ticket-center-content">
                <span className="ticket-status-badge" id="ticket-available-badge">{ticketsRemaining} left</span>
                <h3 className="ticket-title-name">Meetup Pass</h3>
                <p className="ticket-subtext-info">Includes entry, networking access, and english breakfast.</p>
                <div className="ticket-deadline-row">
                  <svg className="meta-clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span>Sales end on June 13th</span>
                </div>
                <div className="ticket-price-display">
                  <span className="price-val">₹{TICKET_PRICE.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <AuthChoiceModal show={showAuthChoice} onClose={handleAuthChoiceClose} qty={qty} />
      <CheckoutLoginModal show={showCheckoutLogin} onClose={handleCheckoutLoginClose} qty={qty} onLoginSuccess={() => {
        setShowCheckoutLogin(false);
        setShowQuestions(true);
      }} />
      <RegistrationQuestionsModal show={showQuestions} onClose={handleQuestionsClose} onSubmit={handleQuestionsSubmit} />
      <RegistrationSummaryModal show={showSummary} onClose={handleSummaryClose} qty={qty} setQty={setQty} ticketsRemaining={ticketsRemaining} onCheckout={handleCheckout} />
      <DigitalTicketModal show={showDigitalTicket} onClose={() => { setShowDigitalTicket(false); navigate('/user-dashboard'); }} ticketIds={generatedTicketIds} email={session?.email} />
      
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </main>
  );
}
