import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { db, storage, auth } from '../config/firebase';

export default function CreateEventPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bannerUrl: '',
    category: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    venueName: '',
    address: '',
    mapsLink: '',
    maxAttendees: '',
    waitlistEnabled: false
  });
  
  const [bannerFile, setBannerFile] = useState(null);
  const [originalBannerUrl, setOriginalBannerUrl] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'admin') {
      navigate('/login');
      return;
    }

    if (editId) {
      setIsEditMode(true);
      document.title = "Edit Event | Perenti Admin";
      loadEventData(editId);
    } else {
      document.title = "Create Event | Perenti Admin";
    }
  }, [session, navigate, editId]);

  const loadEventData = async (id) => {
    try {
      if (id === 'main') {
        // Default mockup meetup details
        setFormData({
          name: "Ebc 28th Meetup (Default)",
          description: "Join us at the Ebc 28th meetup, where aspiring founders, business owners, professionals, and students can share their stories.",
          bannerUrl: "ebc_meetup_banner.jpg",
          category: "Networking",
          startDate: "2026-06-14T09:00",
          endDate: "2026-06-14T11:00",
          registrationDeadline: "",
          venueName: "Birch Cafe",
          address: "Vanasthalipuram, Hyderabad",
          mapsLink: "",
          maxAttendees: "60",
          waitlistEnabled: false
        });
        setOriginalBannerUrl("ebc_meetup_banner.jpg");
        return;
      }

      const docSnap = await getDoc(doc(db, 'events', id));
      if (docSnap.exists()) {
        const evt = docSnap.data();
        setFormData({
          name: evt.name || '',
          description: evt.description || '',
          bannerUrl: evt.bannerUrl || '',
          category: evt.category || '',
          startDate: evt.startDate || '',
          endDate: evt.endDate || '',
          registrationDeadline: evt.registrationDeadline || '',
          venueName: evt.venue?.name || '',
          address: evt.venue?.address || '',
          mapsLink: evt.venue?.mapsLink || '',
          maxAttendees: evt.capacity?.maxAttendees || '',
          waitlistEnabled: evt.capacity?.waitlistEnabled || false
        });
        if (evt.bannerUrl) setOriginalBannerUrl(evt.bannerUrl);
      } else {
        // Try local storage fallback
        const localEvents = JSON.parse(localStorage.getItem('events')) || [];
        const evt = localEvents.find(e => e.id === id);
        if (evt) {
          setFormData({
            name: evt.name || '',
            description: evt.description || '',
            bannerUrl: evt.bannerUrl || '',
            category: evt.category || '',
            startDate: evt.startDate || '',
            endDate: evt.endDate || '',
            registrationDeadline: evt.registrationDeadline || '',
            venueName: evt.venue?.name || '',
            address: evt.venue?.address || '',
            mapsLink: evt.venue?.mapsLink || '',
            maxAttendees: evt.capacity?.maxAttendees || '',
            waitlistEnabled: evt.capacity?.waitlistEnabled || false
          });
          if (evt.bannerUrl) setOriginalBannerUrl(evt.bannerUrl);
        } else {
          setError("Event not found locally or in Firestore.");
        }
      }
    } catch (err) {
      console.warn("Fetch failed:", err);
      setError("Failed to load event data.");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBannerFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.warn("Anonymous auth fallback failed:", err);
        }
      }

      let finalBannerUrl = formData.bannerUrl;

      if (bannerFile) {
        try {
          const storageRef = ref(storage, 'event-banners/' + Date.now() + '_' + bannerFile.name.replace(/[^a-zA-Z0-9.]/g, ''));
          const snapshot = await uploadBytes(storageRef, bannerFile);
          finalBannerUrl = await getDownloadURL(snapshot.ref);
        } catch (uploadErr) {
          console.warn("Banner upload failed (likely CORS or permission issue). Proceeding without new image.", uploadErr);
          // Fallback to existing or empty if upload fails
          if (!formData.bannerUrl && originalBannerUrl) {
            finalBannerUrl = originalBannerUrl;
          }
        }
      } else if (!formData.bannerUrl && originalBannerUrl) {
        finalBannerUrl = originalBannerUrl;
      }

      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        bannerUrl: finalBannerUrl,
        category: formData.category,
        startDate: formData.startDate,
        endDate: formData.endDate,
        registrationDeadline: formData.registrationDeadline,
        venue: {
          name: formData.venueName.trim(),
          address: formData.address.trim(),
          mapsLink: formData.mapsLink.trim(),
        },
        capacity: {
          maxAttendees: parseInt(formData.maxAttendees, 10) || 0,
          waitlistEnabled: formData.waitlistEnabled
        },
        createdBy: session.email,
        status: 'active'
      };

      if (isEditMode && editId) {
        const eventRef = doc(db, 'events', editId);
        await setDoc(eventRef, { ...eventData, updatedAt: serverTimestamp() }, { merge: true });
      } else {
        const eventsRef = collection(db, 'events');
        await addDoc(eventsRef, { ...eventData, createdAt: serverTimestamp() });
      }

      setTimeout(() => {
        navigate('/admin-dashboard');
      }, 1000);

    } catch (err) {
      console.error("Save failed:", err);
      setError("Failed to save event. " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page-wrapper">
      <header className="site-header">
        <div className="header-container">
          <Link to="/" className="brand-link">
            <span className="brand-name">perenti</span>
          </Link>
          
          <div className="header-actions" style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
            <span className="session-email-text" style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)'}}>{session?.email}</span>
            <Link to="/admin-dashboard" className="btn btn-secondary btn-sm">Back to Dashboard</Link>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => {
              localStorage.removeItem('currentUser');
              navigate('/login');
            }}>Logout</button>
          </div>
        </div>
      </header>

      <main className="admin-main-content" style={{flex: 1, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <div className="admin-header-row" style={{marginBottom: '1rem'}}>
          <div className="admin-title-section">
            <h1 style={{fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)'}}>{isEditMode ? 'Edit Event' : 'Create New Event'}</h1>
            <p style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem'}}>
              {isEditMode ? 'Modify the details, date, venue, and capacity for this event.' : 'Set up a new event, manage details, date, venue, and capacity.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="auth-error-banner" style={{marginBottom: '1rem', backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          <div className="form-section-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '1rem', padding: '2rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem'}}>
            <h2 className="form-section-title" style={{fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--brand-primary)'}}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              Basic Information
            </h2>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-name" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Event Name <span style={{color: '#ef4444'}}>*</span></label>
              <input type="text" id="evt-name" name="name" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} required placeholder="e.g. Ebc 28th Meetup" value={formData.name} onChange={handleChange} />
            </div>
            
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-desc" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Event Description <span style={{color: '#ef4444'}}>*</span></label>
              <textarea id="evt-desc" name="description" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} rows="4" required placeholder="Provide a brief description of what attendees can expect..." value={formData.description} onChange={handleChange}></textarea>
            </div>

            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Event Banner (Upload OR URL)</label>
              <div className="responsive-grid-2-col">
                <input type="file" id="evt-banner-file" className="form-control" accept="image/*" style={{width: '100%', padding: '0.55rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} title="Upload Image" onChange={handleFileChange} />
                <input type="url" id="evt-banner-url" name="bannerUrl" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} placeholder="Or paste image URL here" value={formData.bannerUrl} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-category" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Event Category <span style={{color: '#ef4444'}}>*</span></label>
              <select id="evt-category" name="category" className="form-control" required style={{appearance: 'none', backgroundImage: 'url("data:image/svg+xml;utf8,<svg viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'></polyline></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem', paddingRight: '2.5rem', width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} value={formData.category} onChange={handleChange}>
                <option value="" disabled>Select Category</option>
                <option value="Startup">Startup</option>
                <option value="Networking">Networking</option>
                <option value="Workshop">Workshop</option>
                <option value="Business">Business</option>
                <option value="Technology">Technology</option>
                <option value="Community">Community</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-section-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '1rem', padding: '2rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem'}}>
            <h2 className="form-section-title" style={{fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--brand-primary)'}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Date & Time
            </h2>
            <div className="responsive-grid-2-col">
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
                <label htmlFor="evt-start" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Start Date & Time <span style={{color: '#ef4444'}}>*</span></label>
                <input type="datetime-local" id="evt-start" name="startDate" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} required value={formData.startDate} onChange={handleChange} />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
                <label htmlFor="evt-end" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>End Date & Time <span style={{color: '#ef4444'}}>*</span></label>
                <input type="datetime-local" id="evt-end" name="endDate" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} required value={formData.endDate} onChange={handleChange} />
              </div>
            </div>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-deadline" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Registration Deadline</label>
              <input type="datetime-local" id="evt-deadline" name="registrationDeadline" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} value={formData.registrationDeadline} onChange={handleChange} />
            </div>
          </div>

          <div className="form-section-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '1rem', padding: '2rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem'}}>
            <h2 className="form-section-title" style={{fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--brand-primary)'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              Venue
            </h2>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-venue-name" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Venue Name <span style={{color: '#ef4444'}}>*</span></label>
              <input type="text" id="evt-venue-name" name="venueName" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} required placeholder="e.g. Birch Cafe" value={formData.venueName} onChange={handleChange} />
            </div>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-address" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Full Address <span style={{color: '#ef4444'}}>*</span></label>
              <input type="text" id="evt-address" name="address" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} required placeholder="e.g. Vanasthalipuram, Hyderabad" value={formData.address} onChange={handleChange} />
            </div>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-maps-link" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Google Maps Link</label>
              <input type="url" id="evt-maps-link" name="mapsLink" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} placeholder="https://maps.google.com/..." value={formData.mapsLink} onChange={handleChange} />
            </div>
          </div>

          <div className="form-section-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '1rem', padding: '2rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem'}}>
            <h2 className="form-section-title" style={{fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--brand-primary)'}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Capacity
            </h2>
            <div className="responsive-grid-2-col">
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
                <label htmlFor="evt-capacity" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Maximum Attendees <span style={{color: '#ef4444'}}>*</span></label>
                <input type="number" id="evt-capacity" name="maxAttendees" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} required min="1" placeholder="e.g. 100" value={formData.maxAttendees} onChange={handleChange} />
              </div>
              <div className="form-group toggle-group" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-info-card)', border: '1px solid var(--border-input)', borderRadius: '0.5rem', marginTop: '1.5rem', marginBottom: '1.25rem'}}>
                <label htmlFor="evt-waitlist" className="form-label" style={{marginBottom: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Enable Waitlist?</label>
                <label className="toggle-switch">
                  <input type="checkbox" id="evt-waitlist" name="waitlistEnabled" checked={formData.waitlistEnabled} onChange={handleChange} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem'}}>
            <Link to="/admin-dashboard" className="btn btn-outline btn-lg">Cancel</Link>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{minWidth: '150px'}}>
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Event' : 'Create Event')}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
