import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, onSnapshot } from "firebase/firestore";
import { db } from '../config/firebase';

export default function UserDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState('');
  const [tickets, setTickets] = useState([]);
  const [eventsMap, setEventsMap] = useState({}); // eventId -> event data
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || session.role !== 'user') {
      navigate('/login');
      return;
    }

    const unsubAnn = onSnapshot(doc(db, 'settings', 'announcement'), (docSnap) => {
      if (docSnap.exists()) {
        setAnnouncement(docSnap.data().text || '');
      } else {
        setAnnouncement('');
      }
    });

    const loadData = async () => {
      try {
        // 1. Load all events into a map so we can look up by eventId
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        const map = {};
        eventsSnapshot.forEach((docSnap) => {
          map[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        setEventsMap(map);

        // 2. Load only this user's tickets
        const q = query(collection(db, 'tickets'), where('email', '==', session.email));
        const querySnapshot = await getDocs(q);
        const ticketsList = [];
        querySnapshot.forEach((docSnap) => {
          ticketsList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setTickets(ticketsList);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Poll tickets for live check-in status updates
    const pollInterval = setInterval(async () => {
      try {
        const q = query(collection(db, 'tickets'), where('email', '==', session.email));
        const querySnapshot = await getDocs(q);
        const ticketsList = [];
        querySnapshot.forEach((docSnap) => {
          ticketsList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setTickets(ticketsList);
      } catch (e) {
        console.error("Error polling tickets", e);
      }
    }, 5000); // reduced to every 5s to avoid hammering Firestore

    return () => {
      unsubAnn();
      clearInterval(pollInterval);
    };
  }, [session, navigate]);

  const handlePrint = () => window.print();

  // Helper: safely get venue string from object or string
  const getVenueStr = (venue) => {
    if (!venue) return null;
    if (typeof venue === 'object') {
      return [venue.name, venue.address].filter(Boolean).join(', ') || null;
    }
    return venue;
  };

  // Helper: format date string from event
  const getDateStr = (event) => {
    if (!event) return 'TBA';
    if (event.startDate) {
      try {
        return new Date(event.startDate).toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      } catch { return event.startDate; }
    }
    return 'TBA';
  };

  // Helper: format time string from event
  const getTimeStr = (event) => {
    if (!event) return null;
    const parts = [event.startTime, event.endTime].filter(Boolean);
    if (parts.length === 0) return null;
    const time = parts.join(' - ');
    return event.timezone ? `${time} (${event.timezone})` : time;
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading tickets...</div>;
  }

  return (
    <div className="dashboard-page-wrapper">
      <main className="dashboard-main-content" id="print-area-wrapper">

        {/* Announcements Banner */}
        {announcement && (
          <div className="announcements-alert" id="announcements-alert" style={{backgroundColor: 'rgba(90, 154, 142, 0.1)', border: '1px solid var(--brand-primary)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', boxShadow: 'var(--shadow-sm)'}}>
            <span style={{fontSize: '1.25rem', lineHeight: '1'}}>📢</span>
            <div style={{flex: 1}}>
              <h4 style={{color: 'var(--brand-primary)', fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.2rem 0'}}>Organizer Announcement</h4>
              <p id="announcement-text" style={{color: 'var(--text-main)', fontSize: '0.85rem', margin: 0, lineHeight: 1.4, fontWeight: 550}}>{announcement}</p>
            </div>
          </div>
        )}

        <div className="hub-header-row">
          <div className="hub-title-section">
            <h1>My Tickets Hub</h1>
            <p>Review your registration passes. Present the QR codes at the venue entrance.</p>
          </div>
          {tickets.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={handlePrint} style={{ 
              padding: '0.75rem 1.5rem', 
              fontSize: '1rem', 
              fontWeight: 600, 
              whiteSpace: 'nowrap', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.6rem', 
              borderRadius: '0.5rem', 
              boxShadow: '0 4px 6px rgba(90, 154, 142, 0.2)',
              border: 'none',
              cursor: 'pointer',
              height: 'fit-content'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Print All Tickets
            </button>
          )}
        </div>

        {/* Empty View */}
        {tickets.length === 0 ? (
          <div className="empty-tickets-view" id="hub-empty-state" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '5rem 2rem', backgroundColor: 'var(--bg-card)', border: '1px dashed var(--divider)',
            borderRadius: '1rem', marginTop: '1.5rem', textAlign: 'center', boxShadow: 'var(--shadow-sm)'
          }}>
            <svg className="empty-graphic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                 style={{ width: '72px', height: '72px', color: 'var(--text-muted)', opacity: 0.6, marginBottom: '1.5rem' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>No passes found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '400px', margin: '0 0 1.5rem 0', lineHeight: 1.5 }}>
              You haven't booked any passes yet. Browse available events to get started.
            </p>
            <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(90, 154, 142, 0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="tickets-scroll-container" id="hub-tickets-container">
            {tickets.map((t, idx) => {
              // Look up the event this ticket belongs to
              let event = t.eventId ? eventsMap[t.eventId] : null;
              if (!event && t.eventId === 'main') {
                event = {
                  name: 'Ebc 28th Meetup (Default)',
                  startDate: '2026-06-14T09:00',
                  venue: { name: 'Birch Cafe', address: 'Vanasthalipuram, Hyderabad' }
                };
              }

              // Fallback event name: use stored eventName field, or 'Unknown Event'
              const eventName = event?.name || t.eventName || 'Unknown Event';
              const dateStr = getDateStr(event);
              const timeStr = getTimeStr(event);
              const venueStr = getVenueStr(event?.venue);

              let statusText = 'Unused';
              let statusClass = 'unused';
              let statusStyle = {};

              if (t.status === 'checked-in') {
                statusText = 'Checked In';
                statusClass = 'checked-in';
              } else if (t.approval === 'pending') {
                statusText = 'Pending Approval';
                statusClass = 'pending';
                statusStyle = { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fef3c7', border: '1px solid rgba(245, 158, 11, 0.4)' };
              } else if (t.approval === 'rejected') {
                statusText = 'Rejected';
                statusClass = 'rejected';
                statusStyle = { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fecaca', border: '1px solid rgba(239, 68, 68, 0.4)' };
              }

              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(t.id)}`;
              const paymentText = t.payment === 'online' ? 'Paid (Online)' : 'Offline Payment';
              const paymentColor = t.payment === 'online' ? '#10b981' : '#d97706';

              return (
                <div key={t.id} className="print-ticket-page">
                  <div className="ticket-stub-container">
                    <div className="ticket-stub-header">
                      <div className="stub-brand-logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '1.2rem', height: '1.2rem', color: '#ffffff'}}>
                          <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                          <path d="M2 17L12 22L22 17"/>
                        </svg>
                        <span>perenti pass</span>
                      </div>
                      <span className={`ticket-status-tag ${statusClass}`} style={statusStyle}>{statusText}</span>
                    </div>

                    <div className="ticket-stub-main">
                      <h4 className="stub-event-title">{eventName}</h4>
                      <div className="stub-event-grid">
                        <p className="stub-event-meta"><strong>Date:</strong> {dateStr}</p>
                        {timeStr && <p className="stub-event-meta"><strong>Time:</strong> {timeStr}</p>}
                        {venueStr && <p className="stub-event-meta"><strong>Venue:</strong> {venueStr}</p>}
                      </div>

                      <div className="stub-user-info">
                        <p><strong>Attendee:</strong> <span>{t.email}</span></p>
                        <p><strong>Ticket ID:</strong> <span className="monospaced-code">{t.id}</span></p>
                        <p><strong>Pass:</strong> <span>{idx + 1} of {tickets.length}</span></p>
                        <p><strong>Payment Status:</strong> <span style={{color: paymentColor, fontWeight: 600}}>{paymentText}</span></p>
                      </div>

                      {t.answers && Object.keys(t.answers).length > 0 && (
                        <div style={{marginTop: '1rem', borderTop: '1px dashed var(--divider)', paddingTop: '1rem'}}>
                          <h5 style={{fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)'}}>Registration Answers</h5>
                          {Object.entries(t.answers)
                            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                            .map(([key, value]) => (
                            <div key={key} style={{marginBottom: '0.5rem'}}>
                              <p style={{fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.1rem', textTransform: 'uppercase'}}>{key}</p>
                              <p style={{fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500, margin: 0, wordBreak: 'break-word'}}>{value || '-'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="ticket-stub-cut-divider">
                      <div className="cut-left"></div>
                      <div className="cut-line"></div>
                      <div className="cut-right"></div>
                    </div>

                    <div className="ticket-stub-qr">
                      <img src={qrUrl} alt="Ticket QR Code" className="stub-qr-code-img" />
                      <span className="qr-code-sub">Present this QR code to the organizer at the venue entrance.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
