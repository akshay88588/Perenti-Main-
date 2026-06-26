import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, onSnapshot } from "firebase/firestore";
import { db } from '../config/firebase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';

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
        
        // Merge local storage events as fallback
        try {
          const localEvents = JSON.parse(localStorage.getItem('events')) || [];
          localEvents.forEach(evt => {
            if (!map[evt.id]) {
              map[evt.id] = evt;
            }
          });
        } catch (err) {}
        
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

  const generateGoogleCalendarUrl = (event, fallbackName) => {
    const name = (event?.name || fallbackName || 'Upcoming Event').trim();
    const text = encodeURIComponent(name);
    
    let startDate = new Date();
    let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default
    
    if (event?.startDate) {
      const parsedStart = new Date(event.startDate);
      if (!isNaN(parsedStart.getTime())) {
        startDate = parsedStart;
        endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours default
        if (event.endDate) {
          const parsedEnd = new Date(event.endDate);
          if (!isNaN(parsedEnd.getTime())) {
            endDate = parsedEnd;
          }
        }
      }
    }

    const formatGCalDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    const dates = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;
    
    let desc = (event?.description || '').trim();
    if (!desc) {
      desc = `Join us for ${name}! Please present your digital pass at the venue.`;
    }
    const details = encodeURIComponent(desc);
    
    let loc = getVenueStr(event?.venue) || '';
    loc = loc.trim();
    if (!loc) {
      loc = 'TBA';
    }
    const location = encodeURIComponent(loc);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  };

  const handleDownloadPDF = async (ticketId) => {
    const element = document.getElementById(`ticket-${ticketId}`);
    if (!element) return;
    try {
      // Temporarily hide actions bar if it is inside the element
      const actions = element.querySelector('.ticket-actions-bar');
      if (actions) actions.style.display = 'none';

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
      
      if (actions) actions.style.display = 'flex';

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`perenti-ticket-${ticketId}.pdf`);
    } catch (e) {
      console.error("Failed to generate PDF", e);
      alert("Failed to download PDF ticket.");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{
            width: '40px', height: '40px', border: '4px solid var(--border-card)', 
            borderTop: '4px solid var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading your passes...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page-wrapper">
      <Helmet>
        <title>My Tickets - Perenti</title>
        <meta name="description" content="View and manage your registered event tickets on Perenti." />
      </Helmet>
      <motion.main className="dashboard-main-content" id="print-area-wrapper" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

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
            padding: '5rem 2rem', background: 'linear-gradient(to bottom right, var(--bg-card), var(--bg-body))', border: '1px solid var(--border-card)',
            borderRadius: '1rem', marginTop: '1.5rem', textAlign: 'center', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden'
          }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, opacity: 0.05, transform: 'scale(2) translate(-20%, -10%)', pointerEvents: 'none' }} width="400" height="400" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <path fill="var(--brand-primary)" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.3C90.8,-33.5,96.8,-18,97.7,-2.1C98.6,13.8,94.5,30,86.1,43.6C77.7,57.1,65,68.1,50.7,74.9C36.4,81.7,20.5,84.3,4.3,83.9C-11.9,83.4,-27.8,79.9,-42.1,72.7C-56.4,65.5,-69.1,54.6,-77.6,41.4C-86.1,28.2,-90.4,12.7,-89.8,-2.4C-89.2,-17.5,-83.7,-32.2,-74.6,-44C-65.5,-55.8,-52.8,-64.7,-39.3,-71.5C-25.8,-78.3,-11.5,-83,-2.3,-79.8C6.9,-76.6,22.2,-65.5,30.6,-83.6C30.6,-83.6,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
            </svg>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(90, 154, 142, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <svg className="empty-graphic" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="1.5"
                    style={{ width: '40px', height: '40px' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>No passes found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '400px', margin: '0 0 2rem 0', lineHeight: 1.5 }}>
                You haven't booked any passes yet. Browse available events to get started and unlock new experiences.
              </p>
              <Link to="/" className="btn btn-primary" style={{ padding: '0.85rem 1.75rem', borderRadius: '2rem', fontWeight: 700, fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(90, 154, 142, 0.3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                Browse Events
              </Link>
            </div>
          </div>
        ) : (
          <div id="grouped-tickets-container">
            {/* ✅ updated: Grouped tickets by Upcoming and Past events */}
            {(() => {
              const now = new Date();
              const upcoming = [];
              const past = [];
              
              tickets.forEach(ticket => {
                const eventId = ticket.eventId || 'default';
                const eventInfo = eventsMap[eventId];
                let isPast = false;
                if (eventInfo) {
                  let d = eventInfo.endDate ? new Date(eventInfo.endDate) : (eventInfo.startDate ? new Date(eventInfo.startDate) : null);
                  // Ensure date object is valid
                  if (d && !isNaN(d.getTime()) && d < now) {
                    isPast = true;
                  }
                }
                if (isPast) past.push(ticket);
                else upcoming.push(ticket);
              });

              return [
                { title: 'Upcoming Events', data: upcoming, id: 'upcoming' },
                { title: 'Past Events', data: past, id: 'past' }
              ].filter(g => g.data.length > 0).map(group => (
                <div key={group.id} className="event-tickets-group" style={{ marginBottom: '3rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)', borderBottom: '2px solid var(--border-card)', paddingBottom: '0.5rem' }}>
                    {group.title}
                  </h3>
                  <div className="tickets-scroll-container" id={`hub-tickets-container-${group.id}`}>
                    {group.data.map((t, idx) => {
                      const eventId = t.eventId || 'default';
                      const eventInfo = eventsMap[eventId] || {
                        name: 'Unknown Event',
                        startDate: 'TBA'
                      };
                      const dateStr = getDateStr(eventInfo);
                      const timeStr = getTimeStr(eventInfo);
                      const venueStr = getVenueStr(eventInfo.venue);

                      const relatedTickets = group.data.filter(tk => tk.eventId === eventId);
                      const ticketIndex = relatedTickets.findIndex(tk => tk.id === t.id) + 1;

                      let statusText = 'Unused';
                      let statusClass = 'unused';
                      let statusStyle = { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#2563EB', border: '1px solid rgba(59, 130, 246, 0.5)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)', fontWeight: 'bold' };
                      
                      if (t.status === 'checked-in') {
                        statusText = 'Checked In';
                        statusClass = 'checked-in';
                        statusStyle = { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.5)', boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)', fontWeight: 'bold' };
                      } else if (t.approval === 'pending') {
                        statusText = 'Pending Approval';
                        statusClass = 'pending';
                        statusStyle = { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#D97706', border: '1px solid rgba(245, 158, 11, 0.5)', boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)', fontWeight: 'bold' };
                      } else if (t.approval === 'rejected') {
                        statusText = 'Rejected';
                        statusClass = 'rejected';
                        statusStyle = { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', border: '1px solid rgba(239, 68, 68, 0.5)', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)', fontWeight: 'bold' };
                      }
                      
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(t.id)}`;
                      const paymentText = t.payment === 'online' ? 'Paid (Online)' : 'Offline Payment';
                      const paymentColor = t.payment === 'online' ? '#10b981' : '#d97706';

                      return (
                        <div key={t.id} className="print-ticket-page">
                          <div className="ticket-stub-container" id={`ticket-${t.id}`}>
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
                              <h4 className="stub-event-title">{eventInfo.name}</h4>
                              <div className="stub-event-grid">
                                <p className="stub-event-meta"><strong>Date:</strong> {dateStr}</p>
                                {timeStr && <p className="stub-event-meta"><strong>Time:</strong> {timeStr}</p>}
                                {venueStr && <p className="stub-event-meta"><strong>Venue:</strong> {venueStr}</p>}
                              </div>
                              
                              <div className="stub-user-info">
                                <p><strong>Attendee:</strong> <span>{t.email}</span></p>
                                <p><strong>Ticket ID:</strong> <span className="monospaced-code">{t.id}</span></p>
                                <p><strong>Pass:</strong> <span>{ticketIndex} of {relatedTickets.length}</span></p>
                                <p><strong>Payment Status:</strong> <span style={{color: paymentColor, fontWeight: 600}}>{paymentText}</span></p>
                              </div>
                              
                              {t.answers && Object.keys(t.answers).length > 0 && (
                                <div className="print-hide-answers" style={{marginTop: '1rem', borderTop: '1px dashed var(--divider)', paddingTop: '1rem'}}>
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
                          
                          {/* Action Bar (Hidden when printed) */}
                          <div className="ticket-actions-bar" style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center'}}>
                            <a href={generateGoogleCalendarUrl(eventInfo, eventInfo.name)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{flex: '1 1 auto', minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderColor: '#cbd5e1', color: '#475569', textDecoration: 'none', padding: '0.5rem 1rem'}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                              Add to Calendar
                            </a>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDownloadPDF(t.id)} style={{flex: '1 1 auto', minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem'}}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                              Download PDF
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </motion.main>
    </div>
  );
}
