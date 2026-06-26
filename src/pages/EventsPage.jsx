import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import EventImage from '../components/EventImage';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'events'));
        const list = [];
        const adminEmails = ['admin@perenti.com', 'akshayvarmabudigam2006@gmail.com'];
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.createdBy && adminEmails.includes(data.createdBy)) {
            list.push({ id: docSnap.id, ...data });
          }
        });
        
        // Clean up local storage dummy events
        try {
          const localEvents = JSON.parse(localStorage.getItem('events')) || [];
          const filteredLocal = localEvents.filter(e => e.createdBy && adminEmails.includes(e.createdBy));
          if (localEvents.length !== filteredLocal.length) {
            localStorage.setItem('events', JSON.stringify(filteredLocal));
          }
        } catch (e) {}
        
        setEvents(list);
      } catch (err) {
        console.error('Error loading events:', err);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  if (loading) {
    return (
      <main className="page-main">
        <div className="content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="spinner" style={{
              width: '40px', height: '40px', border: '4px solid var(--border-card)', 
              borderTop: '4px solid var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading events...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </main>
    );
  }

  return (
    <motion.main className="page-main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <Helmet>
        <title>All Events - Perenti</title>
        <meta name="description" content="Browse and register for upcoming events and meetups on Perenti." />
      </Helmet>
      <div className="content-wrapper">
        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: '"Outfit", sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
            All Events
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Browse and register for upcoming events and meetups.
          </p>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
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
              const dateStr = evt.startDate ? new Date(evt.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBA';
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
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        {dateStr}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Capacity: {capacity === 'Unlimited' ? 'Unlimited' : `${capacity} attendees`}
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
