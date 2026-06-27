import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEventSettings } from '../hooks/useEventSettings';
import { useBookTickets } from '../hooks/useBookTickets';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';

// Modals
import AuthChoiceModal from '../components/modals/AuthChoiceModal';
import CheckoutLoginModal from '../components/modals/CheckoutLoginModal';
import RegistrationQuestionsModal from '../components/modals/RegistrationQuestionsModal';
import RegistrationSummaryModal from '../components/modals/RegistrationSummaryModal';
import DigitalTicketModal from '../components/modals/DigitalTicketModal';
import Toast from '../components/Toast';
import { handleShareAction } from '../utils/shareActions';
import AttendeeProfileModal from '../components/modals/AttendeeProfileModal';
import ShareModal from '../components/modals/ShareModal';
import EventImage from '../components/EventImage';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function HomePage() {
  const [qty, setQty] = useState(1);
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const { eventName, slug } = useParams();

  const { ticketsRemaining, updateTicketsRemaining } = useEventSettings();
  const { bookTicketsForUser } = useBookTickets();

  useEffect(() => {
    if (!session && !eventId && !eventName && !slug) {
      navigate('/login');
    }
  }, [session, eventId, eventName, slug, navigate]);

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
            const adminEmails = ['admin@perenti.com', 'akshayvarmabudigam2006@gmail.com'];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.createdBy && adminEmails.includes(data.createdBy)) {
                list.push({ id: docSnap.id, ...data });
              }
            });
            
            try {
              const localEvents = JSON.parse(localStorage.getItem('events')) || [];
              const filteredLocal = localEvents.filter(e => e.createdBy && adminEmails.includes(e.createdBy));
              if (localEvents.length !== filteredLocal.length) {
                localStorage.setItem('events', JSON.stringify(filteredLocal));
              }
            } catch (e) {}
            
          } catch (e) {
            console.warn("Failed to fetch events from Firestore, using localStorage fallback:", e);
            const localList = JSON.parse(localStorage.getItem('events')) || [];
            const adminEmails = ['admin@perenti.com', 'akshayvarmabudigam2006@gmail.com'];
            list = localList.filter(e => e.createdBy && adminEmails.includes(e.createdBy));
          }
        } else {
          const localList = JSON.parse(localStorage.getItem('events')) || [];
          const adminEmails = ['admin@perenti.com', 'akshayvarmabudigam2006@gmail.com'];
          list = localList.filter(e => e.createdBy && adminEmails.includes(e.createdBy));
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

  // When eventId or slug param changes, load that specific event's detail
  useEffect(() => {
    if (!eventId && !eventName && !slug) {
      setSelectedEvent(null);
      return;
    }
    const loadEventDetail = async () => {
      setEventLoading(true);
      try {
        let foundEvent = null;

        if (eventId) {
          // Try Firestore first
          try {
            const docRef = doc(db, 'events', eventId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              foundEvent = { id: docSnap.id, ...docSnap.data() };
            }
          } catch (firestoreErr) {
            console.warn("Failed to fetch event detail from Firestore, trying fallback:", firestoreErr);
          }

          // Fallback: check already-loaded events list or localStorage directly
          if (!foundEvent) {
            const found = events.find(e => e.id === eventId);
            if (found) {
              foundEvent = found;
            } else {
              try {
                const localList = JSON.parse(localStorage.getItem('events')) || [];
                const localFound = localList.find(e => e.id === eventId);
                if (localFound) foundEvent = localFound;
              } catch (_) {}
            }
          }

          // Redirect to clean /events/:eventName route if we found the event
          if (foundEvent) {
            const nameSlug = foundEvent.slug || (foundEvent.name ? generateSlug(foundEvent.name) : foundEvent.id);
            navigate(`/events/${nameSlug}`, { replace: true });
            return;
          }
        } else if (eventName || slug) {
          const currentSlug = eventName || slug;
          // Try Firestore by slug
          try {
            const q = query(collection(db, 'events'), where('slug', '==', currentSlug));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const docSnap = snap.docs[0];
              foundEvent = { id: docSnap.id, ...docSnap.data() };
            }
          } catch (firestoreErr) {
            console.warn("Failed to fetch event by slug from Firestore:", firestoreErr);
          }

          // Fallback scan for matches
          if (!foundEvent) {
            try {
              const snapshot = await getDocs(collection(db, 'events'));
              snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const generated = data.slug || (data.name ? generateSlug(data.name) : '');
                if (generated === currentSlug) {
                  foundEvent = { id: docSnap.id, ...data };
                }
              });
            } catch (err) {
              console.warn("Failed to scan events for slug match:", err);
            }
          }

          // Fallback to localStorage
          if (!foundEvent) {
            try {
              const localList = JSON.parse(localStorage.getItem('events')) || [];
              const localFound = localList.find(e => {
                const s = e.slug || (e.name ? generateSlug(e.name) : '');
                return s === currentSlug;
              });
              if (localFound) foundEvent = localFound;
            } catch (_) {}
          }

          // Fallback check if currentSlug is actually a valid eventId directly (backward compatibility)
          if (!foundEvent && currentSlug) {
            try {
              const docRef = doc(db, 'events', currentSlug);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                foundEvent = { id: docSnap.id, ...docSnap.data() };
              }
            } catch (err) {
              console.warn("Failed to fetch event by ID fallback:", err);
            }
          }
        }

        setSelectedEvent(foundEvent);

        // Load attendees filtered by this event
        const list = [];
        const resolvedId = foundEvent?.id || eventId;
        if (resolvedId) {
          try {
            const ticketsSnapshot = await getDocs(collection(db, 'tickets'));
            ticketsSnapshot.forEach((t) => {
              const data = t.data();
              if (data.approval !== 'rejected') {
                // Show attendees for this event, or all if no eventId filter on ticket
                if (!data.eventId || data.eventId === resolvedId) {
                  list.push({ id: t.id, ...data });
                }
              }
            });
          } catch (ticketsErr) {
            console.warn("Failed to fetch tickets/attendees (could be guest mode):", ticketsErr);
          }
        }
        setAttendees(list);
      } catch (err) {
        console.error('Error loading event detail:', err);
      } finally {
        setEventLoading(false);
      }
    };
    loadEventDetail();
  }, [eventId, eventName, slug, events, navigate]);
  // Update SEO metadata when an event is selected or deselected
  useEffect(() => {
    if (selectedEvent) {
      document.title = `${selectedEvent.name} | Perenti`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", selectedEvent.description || `Join ${selectedEvent.name} on Perenti.`);
      
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", `${selectedEvent.name} | Perenti`);
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", selectedEvent.description || `Join ${selectedEvent.name} on Perenti.`);
    } else {
      document.title = "Perenti | The Platform for Community Builders";
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", "Perenti is the ultimate platform for community builders. Create, manage, and host premium events effortlessly.");
      
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", "Perenti | The Platform for Community Builders");
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", "Perenti is the ultimate platform for community builders. Create, manage, and host premium events effortlessly.");
    }
  }, [selectedEvent]);

  const handleRegisterClick = () => {
    if (session) {
      if (session.role === 'admin') {
        alert('Event administrators cannot book passes. Please log in as a General User to proceed.');
        return;
      }
      setShowQuestions(true);
    } else {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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
      const ticketIds = await bookTicketsForUser(session.email, finalQty, ticketsRemaining, updateTicketsRemaining, answers, selectedEvent?.id || eventId, selectedEvent?.name || null, selectedEvent, paymentMethod, paymentId);
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
  if (eventId || eventName || slug) {
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
        <Helmet>
          <title>{evt.name || 'Event Details'} - Perenti</title>
          <meta name="description" content={evt.description || `Register for ${evt.name} on Perenti.`} />
        </Helmet>
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
                    <button type="button" className="btn-share-icon" onClick={() => setShowShareMenu(true)} title="Share Event">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                      </svg>
                    </button>
                    
                    <ShareModal 
                      show={showShareMenu} 
                      onClose={() => setShowShareMenu(false)} 
                      eventName={evt.name} 
                      eventId={evt.id} 
                      eventSlug={evt.slug}
                      setToastMessage={setToastMessage}
                    />
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

        <AuthChoiceModal show={showAuthChoice} onClose={() => setShowAuthChoice(false)} qty={qty} eventId={selectedEvent?.id || eventId} eventName={selectedEvent?.name} />
        <CheckoutLoginModal show={showCheckoutLogin} onClose={() => setShowCheckoutLogin(false)} qty={qty} onLoginSuccess={() => { setShowCheckoutLogin(false); setShowQuestions(true); }} />
        <RegistrationQuestionsModal show={showQuestions} onClose={() => setShowQuestions(false)} onSubmit={handleQuestionsSubmit} eventDetails={selectedEvent} />
        <RegistrationSummaryModal show={showSummary} onClose={() => setShowSummary(false)} qty={qty} setQty={setQty} ticketsRemaining={ticketsRemaining} onCheckout={handleCheckout} eventTicketPrice={selectedEvent?.ticketPrice ?? null} />
        <DigitalTicketModal show={showDigitalTicket} onClose={() => { setShowDigitalTicket(false); navigate('/my-tickets'); }} ticketIds={generatedTicketIds} email={session?.email} eventName={selectedEvent?.name} paymentMethod={lastPaymentMethod} />
        <AttendeeProfileModal show={selectedAttendee !== null} onClose={() => setSelectedAttendee(null)} attendee={selectedAttendee} customQuestions={selectedEvent?.customRegistrationFields} />
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      </main>
    );
  }

  // ─── EVENTS LISTING VIEW (default homepage) ───────────────────────────────
  return (
    <motion.main className="page-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <Helmet>
        <title>Perenti - Discover Incredible Events</title>
        <meta name="description" content="Discover and register for upcoming events, meetups, and networking opportunities on Perenti." />
      </Helmet>
      <div className="content-wrapper">
        {/* Dynamic Hero Section */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ 
            marginBottom: '3rem', 
            padding: '3.5rem 2rem', 
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          {/* Abstract SVG Background element for flair */}
          <svg style={{ position: 'absolute', top: 0, right: 0, opacity: 0.1, transform: 'scale(1.5) translate(10%, -10%)', pointerEvents: 'none' }} width="400" height="400" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#ffffff" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.3C90.8,-33.5,96.8,-18,97.7,-2.1C98.6,13.8,94.5,30,86.1,43.6C77.7,57.1,65,68.1,50.7,74.9C36.4,81.7,20.5,84.3,4.3,83.9C-11.9,83.4,-27.8,79.9,-42.1,72.7C-56.4,65.5,-69.1,54.6,-77.6,41.4C-86.1,28.2,-90.4,12.7,-89.8,-2.4C-89.2,-17.5,-83.7,-32.2,-74.6,-44C-65.5,-55.8,-52.8,-64.7,-39.3,-71.5C-25.8,-78.3,-11.5,-83,-2.3,-79.8C6.9,-76.6,22.2,-65.5,30.6,-83.6C30.6,-83.6,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <motion.h1 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ fontFamily: '"Outfit", sans-serif', fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.75rem', letterSpacing: '-0.03em' }}
            >
              Discover Incredible Events
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.1rem', maxWidth: '600px', lineHeight: 1.5 }}
            >
              Join vibrant communities, expand your network, and unlock unforgettable experiences at upcoming events near you.
            </motion.p>
          </div>
        </motion.div>

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
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '5rem 2rem', background: 'linear-gradient(to bottom right, var(--bg-card), var(--bg-body))', border: '1px solid var(--border-card)',
            borderRadius: '1rem', textAlign: 'center', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden'
          }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, opacity: 0.05, transform: 'scale(2) translate(-20%, -10%)', pointerEvents: 'none' }} width="400" height="400" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <path fill="var(--brand-primary)" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.3C90.8,-33.5,96.8,-18,97.7,-2.1C98.6,13.8,94.5,30,86.1,43.6C77.7,57.1,65,68.1,50.7,74.9C36.4,81.7,20.5,84.3,4.3,83.9C-11.9,83.4,-27.8,79.9,-42.1,72.7C-56.4,65.5,-69.1,54.6,-77.6,41.4C-86.1,28.2,-90.4,12.7,-89.8,-2.4C-89.2,-17.5,-83.7,-32.2,-74.6,-44C-65.5,-55.8,-52.8,-64.7,-39.3,-71.5C-25.8,-78.3,-11.5,-83,-2.3,-79.8C6.9,-76.6,22.2,-65.5,30.6,-83.6C30.6,-83.6,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
            </svg>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(90, 154, 142, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>No Events Available</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '400px', margin: '0', lineHeight: 1.5 }}>
                There are no upcoming events at the moment. Please check back later for new and exciting meetups!
              </p>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {events.map((evt, index) => {
              const dateStr = evt.startDate
                ? new Date(evt.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'TBA';
              const capacity = evt.capacity?.maxAttendees ?? 'Unlimited';
              return (
                <motion.div
                  key={evt.id}
                  className="hover-lift"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
                  onClick={() => navigate(`/events/${evt.slug || (evt.name ? generateSlug(evt.name) : evt.id)}`)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-card)',
                    borderRadius: '1rem',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative'
                  }}
                >
                  {/* Banner */}
                  <div style={{ width: '100%', height: '180px', flexShrink: 0, overflow: 'hidden', borderRadius: '1rem 1rem 0 0', position: 'relative' }}>
                    <EventImage src={evt.bannerUrl} alt={evt.name} containerStyle={{ height: '180px' }} />
                    <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', padding: '0.3rem 0.75rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                      {evt.ticketPrice != null && evt.ticketPrice > 0 ? `₹${Number(evt.ticketPrice).toLocaleString('en-IN')}` : 'FREE'}
                    </div>
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
                        onClick={e => { e.stopPropagation(); navigate(`/events/${evt.slug || (evt.name ? generateSlug(evt.name) : evt.id)}`); }}
                      >
                        View & Book
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.main>
  );
}
