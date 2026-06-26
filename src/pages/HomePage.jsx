import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEventSettings } from '../hooks/useEventSettings';
import { useBookTickets } from '../hooks/useBookTickets';

// Modals
import AuthChoiceModal from '../components/modals/AuthChoiceModal';
import CheckoutLoginModal from '../components/modals/CheckoutLoginModal';
import RegistrationQuestionsModal from '../components/modals/RegistrationQuestionsModal';
import RegistrationSummaryModal from '../components/modals/RegistrationSummaryModal';
import DigitalTicketModal from '../components/modals/DigitalTicketModal';
import Toast from '../components/Toast';
import { handleShareAction } from '../utils/shareActions';
import AttendeeProfileModal from '../components/modals/AttendeeProfileModal';
import EventImage from '../components/EventImage';
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function HomePage() {
  const [qty, setQty] = useState(1);
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');

  const { ticketsRemaining, updateTicketsRemaining } = useEventSettings();
  const { bookTicketsForUser } = useBookTickets();

  // Events list state
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Selected event detail state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);

  // Attendees for detail view
  const [attendees, setAttendees] = useState([]);
  const [selectedAttendee, setSelectedAttendee] = useState(null);

  // Share menu
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Modal states
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const [showCheckoutLogin, setShowCheckoutLogin] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showDigitalTicket, setShowDigitalTicket] = useState(false);
  const [generatedTicketIds, setGeneratedTicketIds] = useState([]);
  const [lastPaymentMethod, setLastPaymentMethod] = useState('offline');
  const [toastMessage, setToastMessage] = useState('');

  // Load all events for the listing view
  useEffect(() => {
    const loadEvents = async () => {
      try {
        let list = [];
        if (db) {
          try {
            const snapshot = await getDocs(collection(db, 'events'));
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() });
            });
          } catch (e) {
            console.warn("Failed to fetch events from Firestore, using localStorage fallback:", e);
            list = JSON.parse(localStorage.getItem('events')) || [];
          }
        } else {
          list = JSON.parse(localStorage.getItem('events')) || [];
        }
        setEvents(list);
      } catch (err) {
        console.error('Error loading events:', err);
        try {
          const list = JSON.parse(localStorage.getItem('events')) || [];
          setEvents(list);
        } catch (_) {}
      } finally {
        setEventsLoading(false);
      }
    };
    loadEvents();
  }, []);

  // When eventId param changes, load that specific event's detail
  useEffect(() => {
    if (!eventId) {
      setSelectedEvent(null);
      return;
    }
    const loadEventDetail = async () => {
      setEventLoading(true);
      try {
        let foundEvent = null;

        // Try Firestore first
        const docRef = doc(db, 'events', eventId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          foundEvent = { id: docSnap.id, ...docSnap.data() };
        }

        // Fallback: check already-loaded events list
        if (!foundEvent) {
          const found = events.find(e => e.id === eventId);
          if (found) foundEvent = found;
        }



        setSelectedEvent(foundEvent);

        // Load attendees filtered by this event
        const ticketsSnapshot = await getDocs(collection(db, 'tickets'));
        const list = [];
        ticketsSnapshot.forEach((t) => {
          const data = t.data();
          if (data.approval !== 'rejected') {
            // Show attendees for this event, or all if no eventId filter on ticket
            if (!data.eventId || data.eventId === eventId) {
              list.push({ id: t.id, ...data });
            }
          }
        });
        setAttendees(list);
      } catch (err) {
        console.error('Error loading event detail:', err);
      } finally {
        setEventLoading(false);
      }
    };
    loadEventDetail();
  }, [eventId]);

  const handleRegisterClick = () => {
    if (session) {
      if (session.role === 'admin') {
        alert('Event administrators cannot book passes. Please log in as a General User to proceed.');
        return;
      }
      setShowQuestions(true);
    } else {
      setShowAuthChoice(true);
    }
  };

  const handleQuestionsSubmit = (answers) => {
    sessionStorage.setItem('currentBookingAnswers', JSON.stringify(answers));
    setShowQuestions(false);
    setShowSummary(true);
  };

  const handleCheckout = async (finalQty, finalTotal, paymentMethod = 'offline', paymentId = null) => {
    setShowSummary(false);
    try {
      const answers = JSON.parse(sessionStorage.getItem('currentBookingAnswers') || '{}');
      const ticketIds = await bookTicketsForUser(session.email, finalQty, ticketsRemaining, updateTicketsRemaining, answers, eventId, selectedEvent?.name || null, selectedEvent, paymentMethod, paymentId);
      setGeneratedTicketIds(ticketIds);
      setLastPaymentMethod(paymentMethod);
      setShowDigitalTicket(true);
      sessionStorage.removeItem('currentBookingAnswers');
    } catch (error) {
      console.error('Error booking tickets: ', error);
      alert('Failed to book tickets. Error details: ' + error.message);
      setShowSummary(true);
    }
  };

  // ─── EVENT DETAIL VIEW ────────────────────────────────────────────────────
  if (eventId) {
    if (eventLoading) {
      return (
        <main className="page-main">
          <div className="content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div className="spinner" style={{
                width: '40px', height: '40px', border: '4px solid var(--border-card)', 
                borderTop: '4px solid var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading event...</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        </main>
      );
    }

    if (!selectedEvent) {
      return (
        <main className="page-main">
          <div className="content-wrapper" style={{ textAlign: 'center', paddingTop: '4rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Event not found.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/')}>← Back to Events</button>
          </div>
        </main>
      );
    }

    const evt = selectedEvent;
    const dateObj = evt.startDate ? new Date(evt.startDate) : null;
    const dateStr = dateObj
      ? `${dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}, ${dateObj.toLocaleDateString('en-IN', { weekday: 'long' })}`
      : 'TBA';
    const capacity = evt.capacity?.maxAttendees ?? 'Unlimited';
    // venue can be a string or an object {name, address, mapsLink}
    const venueStr = evt.venue
      ? (typeof evt.venue === 'object' ? [evt.venue.name, evt.venue.address].filter(Boolean).join(', ') : evt.venue)
      : null;

    return (
      <main className="page-main">
        <div className="content-wrapper" style={{ paddingBottom: '8rem' }}>
          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'none', border: 'none', color: 'var(--brand-primary)',
              fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
              marginBottom: '1.25rem', padding: '0.25rem 0'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back to Events
          </button>

          {/* Event Banner Section */}
          <section className="event-banner-section">
            <div className="banner-flex-container">
              <div className="banner-poster-col" style={{ borderRadius: '0.75rem', overflow: 'hidden' }}>
                <EventImage
                  src={evt.bannerUrl}
                  alt={evt.name}
                  className="event-poster-img"
                  aspectRatio="1/1"
                  containerStyle={{ borderRadius: '0.75rem', boxShadow: 'var(--shadow-md)' }}
                />
              </div>

              <div className="banner-info-col">
                <span className="banner-meta-tag">TICKETS</span>
                <div className="event-title-container">
                  <h1 className="event-main-title">{evt.name || 'Untitled Event'}</h1>
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
                      <button type="button" className="share-menu-item" data-action="copy" onClick={() => { handleShareAction('copy', setToastMessage, evt.name, evt.id); setShowShareMenu(false); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy Link</span>
                      </button>
                      <button type="button" className="share-menu-item" data-action="whatsapp" onClick={() => { handleShareAction('whatsapp', setToastMessage, evt.name, evt.id); setShowShareMenu(false); }}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <span>WhatsApp</span>
                      </button>
                      <button type="button" className="share-menu-item" data-action="facebook" onClick={() => { handleShareAction('facebook', setToastMessage, evt.name, evt.id); setShowShareMenu(false); }}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        <span>Facebook</span>
                      </button>
                      <button type="button" className="share-menu-item" data-action="twitter" onClick={() => { handleShareAction('twitter', setToastMessage, evt.name, evt.id); setShowShareMenu(false); }}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        <span>Twitter (X)</span>
                      </button>
                      <button type="button" className="share-menu-item" data-action="linkedin" onClick={() => { handleShareAction('linkedin', setToastMessage, evt.name, evt.id); setShowShareMenu(false); }}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        <span>LinkedIn</span>
                      </button>
                    </div>
                  </div>
                </div>

                {evt.description && (
                  <p className="event-main-description">{evt.description}</p>
                )}

                <div className="event-cards-grid">
                  <div className="info-card">
                    <div className="info-card-header">
                      <div className="info-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      </div>
                      <span className="info-card-label">Date</span>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-value">{dateStr}</span>
                    </div>
                  </div>

                  {evt.startTime && (
                    <div className="info-card">
                      <div className="info-card-header">
                        <div className="info-card-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <span className="info-card-label">Time</span>
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-value">{evt.startTime}{evt.endTime ? ` - ${evt.endTime}` : ''}</span>
                        {evt.timezone && <span className="info-card-sub">{evt.timezone}</span>}
                      </div>
                    </div>
                  )}

                  {venueStr && (
                    <div className="info-card">
                      <div className="info-card-header">
                        <div className="info-card-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        </div>
                        <span className="info-card-label">Venue</span>
                      </div>
                      <div className="info-card-content">
                        <span className="info-card-value">{venueStr}</span>
                        {typeof evt.venue === 'object' && evt.venue.mapsLink && (
                          <a href={evt.venue.mapsLink} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.72rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '0.15rem'}}>View on Maps ↗</a>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="info-card">
                    <div className="info-card-header">
                      <div className="info-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      </div>
                      <span className="info-card-label">Capacity</span>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-value">{capacity === 'Unlimited' ? 'Unlimited' : `${capacity} attendees`}</span>
                    </div>
                  </div>

                  <div className="info-card">
                    <div className="info-card-header">
                      <div className="info-card-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v2"></path><path d="M13 17v2"></path><path d="M13 11v2"></path></svg>
                      </div>
                      <span className="info-card-label">Ticket Price</span>
                    </div>
                    <div className="info-card-content">
                      <span className="info-card-value">
                        {evt.ticketPrice != null && evt.ticketPrice > 0
                          ? `₹${Number(evt.ticketPrice).toLocaleString('en-IN')}`
                          : 'Free'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="event-grid-layout">
            <div className="event-details-col">
              <h2 className="panel-section-title">About {evt.name || 'This Event'}</h2>
              <div className="about-rich-details" style={{ marginTop: '1rem' }}>
                {evt.description ? (
                  <p>{evt.description}</p>
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>No additional description provided.</p>
                )}
                {(() => {
                  let displayTimeStr = '';
                  if (evt.startTime) {
                    displayTimeStr = `${evt.startTime}${evt.endTime ? ` - ${evt.endTime}` : ''} ${evt.timezone ? `(${evt.timezone})` : ''}`;
                  } else if (evt.startDate) {
                    const startD = new Date(evt.startDate);
                    if (!isNaN(startD.getTime())) {
                      const sTime = startD.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      if (evt.endDate) {
                        const endD = new Date(evt.endDate);
                        if (!isNaN(endD.getTime())) {
                          const eTime = endD.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                          displayTimeStr = `${sTime} - ${eTime}`;
                        } else {
                          displayTimeStr = sTime;
                        }
                      } else {
                        displayTimeStr = sTime;
                      }
                    }
                  }

                  return (
                    <div className="details-cta-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {evt.name || 'Event Name'}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {dateStr}{displayTimeStr ? ` \u2022 ${displayTimeStr}` : ''}
                        </span>
                      </div>
                      <button type="button" className="btn btn-primary" onClick={handleRegisterClick} style={{boxShadow: '0 8px 20px rgba(90,154,142,0.3)', borderRadius: '2rem', padding: '0.75rem 1.25rem', whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0}}>
                        Register Now
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="event-attendees-col">
              <div className="attendees-header-row" style={{ marginTop: '2rem' }}>
                <h3 className="attendees-title">Attendees</h3>
                <span className="attendees-count-badge">
                  {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
                </span>
              </div>
              <div className="attendees-list-scrollable">
                {attendees.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No attendees yet.</p>
                ) : (
                  attendees.map((attendee) => {
                    const email = attendee.email || '';
                    const name = email ? email.split('@')[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Attendee';
                    const initial = name.charAt(0).toUpperCase();
                    return (
                      <button
                        key={attendee.id}
                        className="attendee-item-row"
                        onClick={() => setSelectedAttendee(attendee)}
                        style={{ border: '1px solid var(--divider)' }}
                      >
                        <div className="attendee-avatar">{initial}</div>
                        <div className="attendee-info-block">
                          <span className="attendee-display-name">{name}</span>
                          <span className="attendee-email-sub">{email}</span>
                        </div>
                        <span className={`attendee-status-indicator ${attendee.status === 'checked-in' ? 'checked-in' : 'registered'}`}>
                          {attendee.status === 'checked-in' ? 'Checked In' : 'Registered'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <AuthChoiceModal show={showAuthChoice} onClose={() => setShowAuthChoice(false)} qty={qty} eventId={eventId} eventName={selectedEvent?.name} />
        <CheckoutLoginModal show={showCheckoutLogin} onClose={() => setShowCheckoutLogin(false)} qty={qty} onLoginSuccess={() => { setShowCheckoutLogin(false); setShowQuestions(true); }} />
        <RegistrationQuestionsModal show={showQuestions} onClose={() => setShowQuestions(false)} onSubmit={handleQuestionsSubmit} eventDetails={selectedEvent} />
        <RegistrationSummaryModal show={showSummary} onClose={() => setShowSummary(false)} qty={qty} setQty={setQty} ticketsRemaining={ticketsRemaining} onCheckout={handleCheckout} eventTicketPrice={selectedEvent?.ticketPrice ?? null} />
        <DigitalTicketModal show={showDigitalTicket} onClose={() => { setShowDigitalTicket(false); navigate('/my-tickets'); }} ticketIds={generatedTicketIds} email={session?.email} eventName={selectedEvent?.name} paymentMethod={lastPaymentMethod} />
        <AttendeeProfileModal show={selectedAttendee !== null} onClose={() => setSelectedAttendee(null)} attendee={selectedAttendee} />
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      </main>
    );
  }

  // ─── EVENTS LISTING VIEW (default homepage) ───────────────────────────────
  return (
    <main className="page-main">
      <div className="content-wrapper">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: '"Outfit", sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
            Available Events
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Discover and register for upcoming events and meetups.
          </p>
        </div>

        {eventsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
            <div className="spinner" style={{
              width: '40px', height: '40px', border: '4px solid var(--border-card)', 
              borderTop: '4px solid var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading events...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : events.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'var(--bg-card)', border: '1px solid var(--border-card)',
            borderRadius: '1rem', color: 'var(--text-muted)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 1rem', opacity: 0.4 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>No events available</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Check back soon for upcoming events.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {events.map((evt) => {
              const dateStr = evt.startDate
                ? new Date(evt.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'TBA';
              const capacity = evt.capacity?.maxAttendees ?? 'Unlimited';
              return (
                <div
                  key={evt.id}
                  onClick={() => navigate(`/?eventId=${evt.id}`)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '0.875rem',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    e.currentTarget.style.borderColor = 'var(--border-card)';
                  }}
                >
                  {/* Banner */}
                  <div style={{ width: '100%', height: '180px', flexShrink: 0, overflow: 'hidden', borderRadius: '0.875rem 0.875rem 0 0' }}>
                    <EventImage src={evt.bannerUrl} alt={evt.name} containerStyle={{ height: '180px' }} />
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                    <h3 style={{ fontFamily: '"Outfit", sans-serif', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, lineHeight: 1.3 }}>
                      {evt.name || 'Untitled Event'}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        {dateStr}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        Capacity: {capacity === 'Unlimited' ? 'Unlimited' : `${capacity} attendees`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v2"></path><path d="M13 17v2"></path><path d="M13 11v2"></path></svg>
                        {evt.ticketPrice != null && evt.ticketPrice > 0
                          ? `₹${Number(evt.ticketPrice).toLocaleString('en-IN')} / ticket`
                          : 'Free Entry'}
                      </div>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', textAlign: 'center' }}
                        onClick={e => { e.stopPropagation(); navigate(`/?eventId=${evt.id}`); }}
                      >
                        View & Book
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
