import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../config/firebase';

export default function UserDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState('');
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || session.role !== 'user') {
      navigate('/login');
      return;
    }

    const checkAnnouncements = () => {
      const latestAnnouncement = localStorage.getItem('latestAnnouncement');
      if (latestAnnouncement) {
        setAnnouncement(latestAnnouncement);
      } else {
        setAnnouncement('');
      }
    };
    checkAnnouncements();
    const interval = setInterval(checkAnnouncements, 2000);

    const loadData = async () => {
      try {
        // Load events
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        const eventsList = [];
        eventsSnapshot.forEach((docSnap) => {
          eventsList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setEvents(eventsList);

        // Load tickets
        const q = query(collection(db, 'tickets'), where('email', '==', session.email));
        const querySnapshot = await getDocs(q);
        const ticketsList = [];
        querySnapshot.forEach((docSnap) => {
          ticketsList.push(docSnap.data());
        });
        setTickets(ticketsList);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Poll tickets live updates
    const pollInterval = setInterval(async () => {
      try {
        const q = query(collection(db, 'tickets'), where('email', '==', session.email));
        const querySnapshot = await getDocs(q);
        const ticketsList = [];
        querySnapshot.forEach((docSnap) => {
          ticketsList.push(docSnap.data());
        });
        setTickets(ticketsList);
      } catch(e) {
        console.error("Error polling tickets", e);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [session, navigate]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-page-wrapper">
      <main className="dashboard-main-content" id="print-area-wrapper">
        {/* Success Banner (handled by Toast in React, omitted from here) */}

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

        {/* Available Events */}
        <div className="hub-header-row" style={{marginBottom: '1rem'}}>
          <div className="hub-title-section">
            <h1>Available Events</h1>
            <p>Discover and register for upcoming events and meetups.</p>
          </div>
        </div>
        
        <div id="available-events-container" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem'}}>
          {events.length === 0 ? (
            <div style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>No upcoming events found.</div>
          ) : (
            events.map((evt) => {
              const dateStr = evt.startDate ? new Date(evt.startDate).toLocaleDateString() : 'TBA';
              const capacityStr = evt.capacity && evt.capacity.maxAttendees ? evt.capacity.maxAttendees : 'Unlimited';
              return (
                <div key={evt.id} style={{background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {evt.bannerUrl && (
                    <div style={{width: '100%', height: '140px', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '0.25rem'}}>
                      <img src={evt.bannerUrl} style={{width: '100%', height: '100%', objectFit: 'cover'}} alt="Event Banner" />
                    </div>
                  )}
                  <h4 style={{fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: '"Outfit", sans-serif'}}>{evt.name || 'Untitled Event'}</h4>
                  <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    {dateStr}
                  </div>
                  <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Capacity: {capacityStr}
                  </div>
                  <div style={{marginTop: '0.5rem'}}>
                    <Link to={`/?eventId=${evt.id}`} className="btn btn-primary btn-sm" style={{width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none'}}>View & Book</Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hub-header-row">
          <div className="hub-title-section">
            <h1>My Tickets Hub</h1>
            <p>Review your registration passes. Present the QR codes at the venue entrance.</p>
          </div>
          {tickets.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              Print All Tickets
            </button>
          )}
        </div>

        {/* Empty View */}
        {tickets.length === 0 ? (
          <div className="empty-tickets-view" id="hub-empty-state">
            <svg className="empty-graphic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <h3>No passes found</h3>
            <p>You haven't booked any passes for the Ebc 28th Meetup yet.</p>
            <Link to="/" className="btn btn-primary">Find Event & Book Passes</Link>
          </div>
        ) : (
          <div className="tickets-scroll-container" id="hub-tickets-container">
            {tickets.map((t, idx) => {
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
                      <h4 className="stub-event-title">Ebc 28th Meetup</h4>
                      <div className="stub-event-grid">
                        <p className="stub-event-meta"><strong>Date:</strong> Sunday, June 14, 2026</p>
                        <p className="stub-event-meta"><strong>Time:</strong> 9:00 AM - 11:00 AM (Asia/Kolkata)</p>
                        <p className="stub-event-meta"><strong>Venue:</strong> Birch Cafe, Hyderabad</p>
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
                          {Object.entries(t.answers).map(([key, value]) => (
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
