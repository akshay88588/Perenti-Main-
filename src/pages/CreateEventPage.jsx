import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { db, storage, auth } from '../config/firebase';

const promiseWithTimeout = (promise, ms, timeoutError) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutError)), ms))
  ]);
};

const isValidUrl = (urlString) => {
  if (!urlString) return true;
  // Reject Windows-style local paths (e.g. C:\path or D:\path) or containing backslashes
  if (/^[A-Za-z]:\\/.test(urlString) || urlString.includes('\\')) {
    return false;
  }
  // Reject file:// protocol
  if (urlString.startsWith('file://')) {
    return false;
  }
  if (urlString.startsWith('/') || urlString.startsWith('data:') || (!urlString.includes('://') && (urlString.endsWith('.jpg') || urlString.endsWith('.png') || urlString.endsWith('.jpeg') || urlString.endsWith('.webp') || urlString.endsWith('.gif')))) {
    return true;
  }
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

const compressImage = (file, maxWidth = 800, maxHeight = 600) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};
export function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove special chars
    .replace(/[\s_]+/g, '-')  // replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // remove leading/trailing hyphens
}

async function getUniqueSlug(name, editId) {
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;
  
  const checkExists = async (testSlug) => {
    if (db) {
      try {
        const q = query(collection(db, 'events'), where('slug', '==', testSlug));
        const snap = await getDocs(q);
        let foundConflict = false;
        snap.forEach(d => {
          if (d.id !== editId) {
            foundConflict = true;
          }
        });
        if (foundConflict) return true;
      } catch (err) {
        console.warn("Failed to check slug uniqueness in Firestore:", err);
      }
    }
    try {
      const localEvents = JSON.parse(localStorage.getItem('events')) || [];
      const conflict = localEvents.some(e => e.slug === testSlug && e.id !== editId);
      if (conflict) return true;
    } catch (_) {}
    return false;
  };

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}

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
    waitlistEnabled: false,
    ticketPrice: ''
  });
  
  const [bannerFile, setBannerFile] = useState(null);
  const [originalBannerUrl, setOriginalBannerUrl] = useState('');
  const fileInputRef = React.useRef(null);

  const handleClearFile = () => {
    setBannerFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearUrl = () => {
    setFormData(prev => ({
      ...prev,
      bannerUrl: ''
    }));
  };

  const [customRegistrationFields, setCustomRegistrationFields] = useState(() => {
    try {
      const stored = localStorage.getItem('customRegistrationForm');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return [
      { id: 'q-building', type: 'text', label: 'What are you building?', required: true, showOnProfile: true },
      { id: 'q-about', type: 'textarea', label: 'Tell us about yourself', required: true, showOnProfile: true },
      { id: 'q-role', type: 'radio', label: 'Role', required: true, options: 'Founder,Student,Investor,Professional', showOnProfile: true },
      { id: 'q-industry', type: 'select', label: 'Industry', required: true, options: 'Technology,Finance,Healthcare,Education,Other', showOnProfile: true },
      { id: 'q-linkedin', type: 'text', label: 'LinkedIn URL', required: false, showOnProfile: true },
      { id: 'q-instagram', type: 'text', label: 'Instagram URL', required: false, showOnProfile: true },
      { id: 'q-website', type: 'text', label: 'Personal Website URL', required: false, showOnProfile: true },
      { id: 'q-cofounder', type: 'toggle', label: 'Looking for Co-founder?', required: false, showOnProfile: true }
    ];
  });

  const [newQuestion, setNewQuestion] = useState({ label: '', type: 'text', options: '', required: true, showOnProfile: true });

  const handleAddQuestion = () => {
    if (!newQuestion.label.trim()) {
      alert("Question Label is required!");
      return;
    }
    if ((newQuestion.type === 'radio' || newQuestion.type === 'select') && !newQuestion.options.trim()) {
      alert("Options are required for Multiple Choice or Dropdown!");
      return;
    }

    const id = 'q-custom-' + Date.now();
    setCustomRegistrationFields(prev => [...prev, { ...newQuestion, id, label: newQuestion.label.trim(), options: newQuestion.options.trim() }]);
    setNewQuestion({ label: '', type: 'text', options: '', required: true, showOnProfile: true });
  };

  const handleDeleteQuestion = (index) => {
    setCustomRegistrationFields(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleToggleRequired = (index) => {
    setCustomRegistrationFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], required: !updated[index].required };
      return updated;
    });
  };

  const handleToggleShowOnProfile = (index) => {
    setCustomRegistrationFields(prev => {
      const updated = [...prev];
      const currentVal = updated[index].showOnProfile !== false;
      updated[index] = { ...updated[index], showOnProfile: !currentVal };
      return updated;
    });
  };

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
          waitlistEnabled: evt.capacity?.waitlistEnabled || false,
          ticketPrice: evt.ticketPrice != null ? String(evt.ticketPrice) : ''
        });
        if (evt.bannerUrl) setOriginalBannerUrl(evt.bannerUrl);
        if (evt.customRegistrationFields) {
          setCustomRegistrationFields(evt.customRegistrationFields);
          localStorage.setItem('customRegistrationForm', JSON.stringify(evt.customRegistrationFields));
        } else {
          setCustomRegistrationFields([]);
        }
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
            waitlistEnabled: evt.capacity?.waitlistEnabled || false,
            ticketPrice: evt.ticketPrice != null ? String(evt.ticketPrice) : ''
          });
          if (evt.bannerUrl) setOriginalBannerUrl(evt.bannerUrl);
          if (evt.customRegistrationFields) {
            setCustomRegistrationFields(evt.customRegistrationFields);
            localStorage.setItem('customRegistrationForm', JSON.stringify(evt.customRegistrationFields));
          } else {
            setCustomRegistrationFields([]);
          }
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
    if (name === 'bannerUrl' && value) {
      setBannerFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBannerFile(e.target.files[0]);
      setFormData(prev => ({
        ...prev,
        bannerUrl: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate URLs
      if (formData.bannerUrl && !isValidUrl(formData.bannerUrl)) {
        setError("Event Banner URL is invalid. Please enter a valid URL (starting with http:// or https://) or a local asset path.");
        setLoading(false);
        return;
      }
      if (formData.mapsLink && !isValidUrl(formData.mapsLink)) {
        setError("Google Maps Link is invalid. Please enter a valid URL starting with http:// or https://");
        setLoading(false);
        return;
      }

      if (auth) {
        if (!auth.currentUser) {
          try {
            await promiseWithTimeout(
              signInAnonymously(auth),
              4000,
              "Authentication timed out."
            );
          } catch (err) {
            console.warn("Anonymous auth fallback failed:", err);
          }
        }
      }

      let finalBannerUrl = formData.bannerUrl;

      if (bannerFile) {
        try {
          if (storage) {
            const storageRef = ref(storage, 'event-banners/' + Date.now() + '_' + bannerFile.name.replace(/[^a-zA-Z0-9.]/g, ''));
            const snapshot = await promiseWithTimeout(
              uploadBytes(storageRef, bannerFile),
              6000,
              "Banner upload timed out."
            );
            finalBannerUrl = await getDownloadURL(snapshot.ref);
          } else {
            throw new Error("Storage not configured");
          }
        } catch (uploadErr) {
          console.warn("Banner upload failed or storage offline. Converting to base64 Data URL fallback:", uploadErr);
          try {
            finalBannerUrl = await compressImage(bannerFile);
          } catch (readErr) {
            console.error("FileReader base64 conversion failed:", readErr);
            if (!formData.bannerUrl && originalBannerUrl) {
              finalBannerUrl = originalBannerUrl;
            }
          }
        }
      } else if (!formData.bannerUrl && originalBannerUrl) {
        finalBannerUrl = originalBannerUrl;
      }

      // customRegistrationFields state is saved directly in eventData

      const uniqueSlug = await getUniqueSlug(formData.name.trim(), editId);

      const eventData = {
        name: formData.name.trim(),
        slug: uniqueSlug,
        description: formData.description.trim(),
        bannerUrl: finalBannerUrl || '',
        category: formData.category,
        startDate: formData.startDate,
        endDate: formData.endDate,
        registrationDeadline: formData.registrationDeadline || '',
        venue: {
          name: formData.venueName.trim(),
          address: formData.address.trim(),
          mapsLink: formData.mapsLink.trim(),
        },
        capacity: {
          maxAttendees: parseInt(formData.maxAttendees, 10) || 0,
          waitlistEnabled: formData.waitlistEnabled || false
        },
        ticketPrice: formData.ticketPrice !== '' ? parseFloat(formData.ticketPrice) : null,
        customRegistrationFields: customRegistrationFields,
        createdBy: session?.email || 'admin@perenti.com',
        status: 'active'
      };

      let docId = editId;

      if (db) {
        if (isEditMode && editId) {
          const eventRef = doc(db, 'events', editId);
          await promiseWithTimeout(
            setDoc(eventRef, { ...eventData, updatedAt: serverTimestamp() }, { merge: true }),
            5000,
            "Firestore write timed out (offline or network error)."
          );
        } else {
          const eventsRef = collection(db, 'events');
          const docRef = await promiseWithTimeout(
            addDoc(eventsRef, { ...eventData, createdAt: serverTimestamp() }),
            5000,
            "Firestore write timed out (offline or network error)."
          );
          docId = docRef.id;
        }
      } else {
        console.warn("Firebase Firestore is not configured. Saving locally only.");
      }

      // Always save to localStorage as fallback/sync
      try {
        const localEvents = JSON.parse(localStorage.getItem('events')) || [];
        const newLocalEvent = {
          id: docId || (isEditMode && editId ? editId : 'local_' + Date.now()),
          ...eventData,
          createdAt: isEditMode && editId ? (localEvents.find(e => e.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        let updatedEvents;
        if (isEditMode && editId) {
          updatedEvents = localEvents.map(e => e.id === editId ? newLocalEvent : e);
        } else {
          updatedEvents = [...localEvents, newLocalEvent];
        }
        localStorage.setItem('events', JSON.stringify(updatedEvents));
      } catch (storageErr) {
        console.warn("Failed to save event to local storage fallback:", storageErr);
      }

      setLoading(false);
      alert(isEditMode ? "Event updated successfully!" : "Event created successfully!");
      navigate('/admin-dashboard');

    } catch (err) {
      console.error("Save failed:", err);
      setError("Failed to save event. " + (err?.message || err));
      setLoading(false);
    }
  };

  return (
    <div className="create-event-page-wrapper">
      <header className="site-header">
        <div className="header-container create-event-header-container">
          <Link to="/" className="brand-link">
            <span className="brand-name">perenti</span>
          </Link>
          
          <div className="header-actions create-event-header-actions">
            <span className="session-email-text" style={{fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)'}}>{session?.email}</span>
            <Link to="/admin-dashboard" className="btn btn-secondary btn-sm">Back to Dashboard</Link>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => {
              localStorage.removeItem('currentUser');
              navigate('/login');
            }}>Logout</button>
          </div>
        </div>
      </header>

      <main className="admin-main-content create-event-main-content">
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
          
          <div className="form-section-card">
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <input 
                    type="file" 
                    id="evt-banner-file" 
                    ref={fileInputRef}
                    className="form-control" 
                    accept="image/*" 
                    style={{width: '100%', padding: '0.55rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} 
                    title="Upload Image" 
                    onChange={handleFileChange} 
                    disabled={!!formData.bannerUrl}
                  />
                  {bannerFile && (
                    <button 
                      type="button" 
                      onClick={handleClearFile} 
                      style={{ 
                        alignSelf: 'flex-start', 
                        background: 'none', 
                        border: 'none', 
                        color: '#ef4444', 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        cursor: 'pointer', 
                        padding: '0.25rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      ✕ Remove selected file ({bannerFile.name})
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <input 
                    type="url" 
                    id="evt-banner-url" 
                    name="bannerUrl" 
                    className="form-control" 
                    style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} 
                    placeholder="Or paste image URL here" 
                    value={formData.bannerUrl} 
                    onChange={handleChange} 
                    disabled={!!bannerFile}
                  />
                  {formData.bannerUrl && (
                    <button 
                      type="button" 
                      onClick={handleClearUrl} 
                      style={{ 
                        alignSelf: 'flex-start', 
                        background: 'none', 
                        border: 'none', 
                        color: '#ef4444', 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        cursor: 'pointer', 
                        padding: '0.25rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      ✕ Clear URL
                    </button>
                  )}
                </div>
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

          <div className="form-section-card">
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

          <div className="form-section-card">
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

          <div className="form-section-card">
            <h2 className="form-section-title" style={{fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--brand-primary)'}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              Capacity &amp; Pricing
            </h2>
            <div className="responsive-grid-2-col">
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
                <label htmlFor="evt-capacity" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Maximum Attendees <span style={{color: '#ef4444'}}>*</span></label>
                <input type="number" id="evt-capacity" name="maxAttendees" className="form-control" style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}} required min="1" placeholder="e.g. 100" value={formData.maxAttendees} onChange={handleChange} />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem'}}>
                <label htmlFor="evt-ticket-price" className="form-label" style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>
                  Ticket Price (₹) <span style={{fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)'}}>— leave blank for free</span>
                </label>
                <input
                  type="number"
                  id="evt-ticket-price"
                  name="ticketPrice"
                  className="form-control"
                  style={{width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-input)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontFamily: '"Inter", sans-serif', fontSize: '0.95rem', outline: 'none'}}
                  min="0"
                  step="0.01"
                  placeholder="e.g. 460"
                  value={formData.ticketPrice}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-group toggle-group" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-info-card)', border: '1px solid var(--border-input)', borderRadius: '0.5rem', marginBottom: '1.25rem'}}>
              <label htmlFor="evt-waitlist" className="form-label" style={{marginBottom: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)'}}>Enable Waitlist?</label>
              <label className="toggle-switch">
                <input type="checkbox" id="evt-waitlist" name="waitlistEnabled" checked={formData.waitlistEnabled} onChange={handleChange} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="form-section-card" style={{padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
            <h2 className="form-section-title" style={{fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--brand-primary)'}}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              Custom Registration Questions
            </h2>
            <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0}}>
              Configure custom registration fields requested from attendees for this specific event.
            </p>

            <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem'}}>
              {customRegistrationFields.map((q, idx) => (
                <div key={q.id || idx} className="custom-reg-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '0.5rem', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: 'var(--shadow-sm)', width: '100%', boxSizing: 'border-box'}}>
                  {/* Top Section */}
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1}}>
                      <strong style={{color: 'var(--text-main)', fontSize: '0.85rem', wordBreak: 'break-word'}}>{(q.label || '').replace(/\s*\([Oo]ptional\)/g, '')}</strong>
                      <span style={{fontSize: '0.7rem', background: 'var(--bg-info-card)', color: 'var(--brand-primary)', border: '1px solid rgba(90, 154, 142, 0.2)', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 600, textTransform: 'uppercase', flexShrink: 0}}>{q.type}</span>
                    </div>
                    <span style={{color: (q.required === true || q.required === 'true') ? '#ef4444' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.15rem', flexShrink: 0}}>
                      ● {(q.required === true || q.required === 'true') ? 'Required' : 'Optional'}
                    </span>
                  </div>

                  {/* Bottom / Action Section */}
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%', borderTop: '1px solid var(--divider)', paddingTop: '0.5rem', flexWrap: 'wrap'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap'}}>
                      {/* Required Toggle */}
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.35rem'}}>
                        <span style={{fontSize: '0.75rem', fontWeight: 600, color: (q.required === true || q.required === 'true') ? 'var(--brand-primary)' : 'var(--text-secondary)'}}>
                          {(q.required === true || q.required === 'true') ? 'Required' : 'Optional'}
                        </span>
                        <label className="toggle-switch" style={{display: 'inline-flex', transform: 'scale(0.85)'}} title="Toggle Required/Optional">
                          <input 
                            type="checkbox" 
                            checked={q.required === true || q.required === 'true'} 
                            onChange={() => handleToggleRequired(idx)} 
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      {/* Show on Attendee Profile Toggle */}
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.35rem'}}>
                        <span style={{fontSize: '0.75rem', fontWeight: 600, color: (q.showOnProfile !== false) ? 'var(--brand-primary)' : 'var(--text-secondary)'}}>
                          {(q.showOnProfile !== false) ? 'Show on Profile' : 'Private'}
                        </span>
                        <label className="toggle-switch" style={{display: 'inline-flex', transform: 'scale(0.85)'}} title="Toggle Show on Attendee Profile">
                          <input 
                            type="checkbox" 
                            checked={q.showOnProfile !== false} 
                            onChange={() => handleToggleShowOnProfile(idx)} 
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button type="button" className="btn btn-sm" style={{padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2', borderRadius: '0.375rem', flexShrink: 0}} onClick={() => handleDeleteQuestion(idx)} title="Delete Question">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{background: 'var(--bg-info-card)', border: '1px solid var(--border-input)', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem'}}>
              <h4 style={{fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', margin: 0}}>Add New Custom Question</h4>
              
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem'}}>
                <label className="form-label" style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)'}}>Question Label</label>
                <input type="text" className="form-control" style={{fontSize: '0.85rem', width: '100%', padding: '0.5rem 0.75rem'}} value={newQuestion.label} onChange={e => setNewQuestion({...newQuestion, label: e.target.value})} placeholder="e.g. T-Shirt Size" />
              </div>
              
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem'}}>
                <label className="form-label" style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)'}}>Question Type</label>
                <select className="form-control" style={{fontSize: '0.85rem', width: '100%', padding: '0.5rem 0.75rem'}} value={newQuestion.type} onChange={e => setNewQuestion({...newQuestion, type: e.target.value})}>
                  <option value="text">Short Text</option>
                  <option value="textarea">Long Text</option>
                  <option value="radio">Multiple Choice (Radio Buttons)</option>
                  <option value="select">Dropdown List</option>
                  <option value="toggle">Yes/No Switch</option>
                </select>
              </div>

              {(newQuestion.type === 'radio' || newQuestion.type === 'select') && (
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem'}}>
                  <label className="form-label" style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)'}}>Options (comma separated)</label>
                  <input type="text" className="form-control" style={{fontSize: '0.85rem', width: '100%', padding: '0.5rem 0.75rem'}} value={newQuestion.options} onChange={e => setNewQuestion({...newQuestion, options: e.target.value})} placeholder="e.g. Small,Medium,Large" />
                </div>
              )}

              <div style={{display: 'flex', gap: '1.5rem', flexWrap: 'wrap', margin: '0.25rem 0'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <input type="checkbox" id="fb-new-required" style={{width: '1rem', height: '1rem', cursor: 'pointer', margin: 0}} checked={newQuestion.required} onChange={e => setNewQuestion({...newQuestion, required: e.target.checked})} />
                  <label htmlFor="fb-new-required" className="form-label" style={{margin: 0, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer'}}>Is this question required?</label>
                </div>

                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <input type="checkbox" id="fb-new-showonprofile" style={{width: '1rem', height: '1rem', cursor: 'pointer', margin: 0}} checked={newQuestion.showOnProfile !== false} onChange={e => setNewQuestion({...newQuestion, showOnProfile: e.target.checked})} />
                  <label htmlFor="fb-new-showonprofile" className="form-label" style={{margin: 0, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer'}}>Show on Attendee Profile?</label>
                </div>
              </div>

              <button type="button" className="btn btn-secondary btn-sm" style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'}} onClick={handleAddQuestion}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Question to Event
              </button>
            </div>
          </div>

          <div className="form-actions">
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
