import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, doc, getDocs, getDoc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from '../config/firebase';
import jsQR from 'jsqr';
import EventImage from '../components/EventImage';
import { Helmet } from 'react-helmet';

// Helper function to format check-in timestamps to uniform hh:mm:ss am/pm
const formatCheckInTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    let timeStr = '';
    if (timestamp.includes(',')) {
      timeStr = timestamp.split(',')[1].trim();
    } else {
      timeStr = timestamp.trim();
    }
    
    // Match hh:mm:ss and optional am/pm
    const timeParts = timeStr.match(/(\d+):(\d+):(\d+)(?:\s*(am|pm))?/i);
    if (timeParts) {
      let hours = parseInt(timeParts[1], 10);
      const minutes = timeParts[2].padStart(2, '0');
      const seconds = timeParts[3].padStart(2, '0');
      const ampm = timeParts[4] ? timeParts[4].toLowerCase() : '';
      
      const hoursStr = String(hours).padStart(2, '0');
      if (ampm) {
        return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
      } else {
        return `${hoursStr}:${minutes}:${seconds}`;
      }
    }

    // Date object fallback
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, '0');
      return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
    }
  } catch (e) {
    console.error("Error formatting time:", e);
  }
  return timestamp;
};

// Admin dashboard component
export default function AdminDashboard() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const [announcement, setAnnouncement] = useState('');
  const [broadcastedAnnouncement, setBroadcastedAnnouncement] = useState('');
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'checked-in'
  const [selectedEventId, setSelectedEventId] = useState('all');

  const allEvents = events;

  const [manualTicketId, setManualTicketId] = useState('');

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [scanStatus, setScanStatus] = useState('Idle');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanRafId = useRef(null);
  const lastScannedId = useRef(null);
  const lastScanTime = useRef(0);
  const scanStream = useRef(null);

  // Overlay states
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [showAlreadyScannedOverlay, setShowAlreadyScannedOverlay] = useState(false);
  const [overlayDetails, setOverlayDetails] = useState({ email: '', ticketId: '' });

  // Attendee details modal
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Form Builder state
  const [formConfig, setFormConfig] = useState([]);
  const [newQuestion, setNewQuestion] = useState({ label: '', type: 'text', options: '', required: true, showOnProfile: true });

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleSort = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const _formConfig = [...formConfig];
      const draggedItemContent = _formConfig.splice(dragItem.current, 1)[0];
      _formConfig.splice(dragOverItem.current, 0, draggedItemContent);
      setFormConfig(_formConfig);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleMove = (index, direction) => {
    const newConfig = [...formConfig];
    if (index + direction >= 0 && index + direction < newConfig.length) {
      const item = newConfig.splice(index, 1)[0];
      newConfig.splice(index + direction, 0, item);
      setFormConfig(newConfig);
    }
  };

  useEffect(() => {
    if (!session || session.role !== 'admin') {
      navigate('/login');
      return;
    }

    // Load form config
    const storedConfig = localStorage.getItem('customRegistrationForm');
    if (storedConfig) {
      setFormConfig(JSON.parse(storedConfig));
    } else {
      setFormConfig([
        { id: 'q-building', type: 'text', label: 'What are you building?', required: true, showOnProfile: true },
        { id: 'q-about', type: 'textarea', label: 'Tell us about yourself', required: true, showOnProfile: true },
        { id: 'q-role', type: 'radio', label: 'Role', required: true, options: 'Founder,Student,Investor,Professional', showOnProfile: true },
        { id: 'q-industry', type: 'select', label: 'Industry', required: true, options: 'Technology,Finance,Healthcare,Education,Other', showOnProfile: true },
        { id: 'q-linkedin', type: 'text', label: 'LinkedIn URL', required: false, showOnProfile: true },
        { id: 'q-instagram', type: 'text', label: 'Instagram URL', required: false, showOnProfile: true },
        { id: 'q-website', type: 'text', label: 'Personal Website URL', required: false, showOnProfile: true },
        { id: 'q-cofounder', type: 'toggle', label: 'Looking for Co-founder?', required: false, showOnProfile: true }
      ]);
    }

    const loadData = async () => {
      try {
        let eventsList = [];
        let ticketsList = [];

        if (db) {
          try {
            const eventsSnapshot = await getDocs(collection(db, 'events'));
            const adminEmails = ['admin@perenti.com', 'akshayvarmabudigam2006@gmail.com'];
            eventsSnapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.createdBy && adminEmails.includes(data.createdBy)) {
                eventsList.push({ id: docSnap.id, ...data });
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
            eventsList = localList.filter(e => e.createdBy && adminEmails.includes(e.createdBy));
          }

          try {
            const ticketsSnapshot = await getDocs(collection(db, 'tickets'));
            ticketsSnapshot.forEach((docSnap) => {
              ticketsList.push({ id: docSnap.id, ...docSnap.data() });
            });
          } catch (e) {
            console.warn("Failed to fetch tickets from Firestore:", e);
          }

          try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const uMap = {};
            usersSnapshot.forEach((docSnap) => {
              const data = docSnap.data();
              uMap[data.email] = data;
            });
            setUsersMap(uMap);
          } catch (e) {
            console.warn("Failed to fetch users from Firestore:", e);
          }

          try {
            const annDoc = await getDoc(doc(db, 'settings', 'announcement'));
            if (annDoc.exists()) {
              setAnnouncement(annDoc.data().text);
              setBroadcastedAnnouncement(annDoc.data().text);
            }
          } catch (e) {
            console.warn("Failed to fetch announcement from Firestore:", e);
          }
        } else {
          const localList = JSON.parse(localStorage.getItem('events')) || [];
          const adminEmails = ['admin@perenti.com', 'akshayvarmabudigam2006@gmail.com'];
          eventsList = localList.filter(e => e.createdBy && adminEmails.includes(e.createdBy));
        }

        setEvents(eventsList);
        setTickets(ticketsList);
      } catch (error) {
        console.error("Error loading admin data:", error);
        try {
          const eventsList = JSON.parse(localStorage.getItem('events')) || [];
          setEvents(eventsList);
        } catch (_) {}
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      stopCameraScan();
    };
  }, [session, navigate]);

  const handleDeleteEvent = async (eId) => {
    if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'events', eId));
      try {
        const localEvents = JSON.parse(localStorage.getItem('events')) || [];
        const filtered = localEvents.filter(e => e.id !== eId);
        localStorage.setItem('events', JSON.stringify(filtered));
      } catch (err) {
        console.warn("Failed to delete event from local storage:", err);
      }
      setEvents(events.filter(e => e.id !== eId));
    } catch (e) {
      console.error("Firestore delete failed:", e);
      alert("Failed to delete event: " + e.message);
    }
  };

  const broadcastAnnouncement = async () => {
    if (!announcement.trim()) {
      alert("Error: Announcement text cannot be empty!");
      return;
    }
    const cleanAnn = announcement.trim();
    try {
      await setDoc(doc(db, 'settings', 'announcement'), { text: cleanAnn, timestamp: Date.now() });
      setBroadcastedAnnouncement(cleanAnn);
      alert("Announcement broadcasted successfully to all attendees!");
    } catch (e) {
      console.error("Failed to broadcast announcement:", e);
      alert("Failed to broadcast announcement.");
    }
  };

  const deleteAnnouncement = async () => {
    if (!window.confirm("Are you sure you want to delete the current announcement?")) return;
    try {
      await deleteDoc(doc(db, 'settings', 'announcement'));
      setAnnouncement('');
      setBroadcastedAnnouncement('');
    } catch (e) {
      console.error("Failed to delete announcement:", e);
      alert("Failed to delete announcement.");
    }
  };

  const updateAttendeeApproval = async (tId, newStatus) => {
    try {
      const ticketRef = doc(db, 'tickets', tId);
      const updateData = { approval: newStatus };
      if (newStatus === 'rejected') {
        updateData.status = 'unused';
      }
      await updateDoc(ticketRef, updateData);
      
      setTickets(tickets.map(t => {
        if (t.id === tId) {
          return { ...t, approval: newStatus, ...(newStatus === 'rejected' ? { status: 'unused' } : {}) };
        }
        return t;
      }));
    } catch (e) {
      console.error("Firestore update failed:", e);
      alert("Cloud update failed: " + e.message);
    }
  };

  const processCheckIn = async (tId) => {
    const cleanId = tId.trim().toUpperCase();
    if (!cleanId) {
      alert("Error: Please enter a Ticket ID!");
      return;
    }

    let ticket = tickets.find(t => t.id === cleanId);

    if (!ticket) {
      try {
        const ticketRef = doc(db, 'tickets', cleanId);
        const ticketSnap = await getDoc(ticketRef);
        if (ticketSnap.exists()) {
          ticket = { id: ticketSnap.id, ...ticketSnap.data() };
          setTickets([...tickets, ticket]);
        }
      } catch (e) {
        console.warn("Could not fetch ticket from Firestore:", e);
      }
    }

    if (!ticket) {
      if (/^PRNT-/i.test(cleanId)) {
        ticket = {
          id: cleanId,
          email: 'walkin@perenti.com',
          qty: 1,
          status: 'unused',
          payment: 'offline',
          approval: 'approved',
          timestamp: new Date().toLocaleString(),
          answers: {}
        };
        try {
          await setDoc(doc(db, 'tickets', cleanId), ticket);
          setTickets([...tickets, ticket]);
        } catch(e) {
          alert("Cloud auto-create failed: " + e.message);
          return;
        }
      } else {
        alert(`Error: Invalid Ticket ID "${cleanId}"!`);
        return;
      }
    }

    // Verify if ticket belongs to the selected event
    const ticketEventId = ticket.eventId || 'main';
    if (selectedEventId !== 'all' && ticketEventId !== selectedEventId) {
      const activeEvent = allEvents.find(e => e.id === selectedEventId);
      const ticketEvent = allEvents.find(e => e.id === ticketEventId);
      const activeEventName = activeEvent ? activeEvent.name : 'the selected event';
      const ticketEventName = ticketEvent ? ticketEvent.name : 'another event';
      
      if (!window.confirm(`Warning: This ticket is registered for "${ticketEventName}", but you are checking in for "${activeEventName}". Do you want to proceed with check-in?`)) {
        stopCameraScan();
        return;
      }
    }

    if (ticket.status === 'checked-in') {
      setOverlayDetails({ email: ticket.email, ticketId: cleanId });
      setShowAlreadyScannedOverlay(true);
      setTimeout(() => setShowAlreadyScannedOverlay(false), 3000);
      stopCameraScan();
      return;
    }

    const checkinTime = new Date().toLocaleString();
    try {
      const ticketRef = doc(db, 'tickets', cleanId);
      await updateDoc(ticketRef, {
        status: 'checked-in',
        timestamp: checkinTime,
        approval: 'approved'
      });
      
      setTickets(tickets.map(t => t.id === cleanId ? { ...t, status: 'checked-in', timestamp: checkinTime, approval: 'approved' } : t));
      
      setOverlayDetails({ email: ticket.email, ticketId: cleanId });
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 3000);
      stopCameraScan();
    } catch(e) { 
      console.error("Firestore check-in failed:", e);
      alert("Cloud check-in failed: " + e.message);
    }
  };

  // Scanner functions
  const _scanTick = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      const cropSize = Math.floor(Math.min(videoW, videoH) * 0.65);
      const sx = Math.floor((videoW - cropSize) / 2);
      const sy = Math.floor((videoH - cropSize) / 2);

      ctx.filter = 'contrast(1.3) brightness(1.05)';
      ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 320, 320);
      ctx.filter = 'none';

      const imgData = ctx.getImageData(0, 0, 320, 320);
      const result = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth'
      });

      const now = Date.now();
      if (result && result.data) {
        setScanStatus(`Detected! ${result.data}`);
        if (result.data !== lastScannedId.current || (now - lastScanTime.current) > 3000) {
          lastScannedId.current = result.data;
          lastScanTime.current = now;
          processCheckIn(result.data);
          return;
        }
      } else {
        setScanStatus(`Scanning... (No QR found)`);
      }
    }
    scanRafId.current = requestAnimationFrame(_scanTick);
  };

  const startCameraScan = async () => {
    if (isScanning || isStartingScan) return;
    setIsStartingScan(true);
    try {
      setScanStatus("Initializing camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      scanStream.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);
        scanRafId.current = requestAnimationFrame(_scanTick);
      }
    } catch (err) {
      console.error('Camera start error:', err);
      alert('Error: Could not access camera. Please allow camera permissions.');
      setScanStatus("Camera access error");
      stopCameraScan();
    } finally {
      setIsStartingScan(false);
    }
  };

  const stopCameraScan = () => {
    setIsScanning(false);
    if (scanRafId.current) cancelAnimationFrame(scanRafId.current);
    if (scanStream.current) {
      scanStream.current.getTracks().forEach(t => t.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanStatus("Idle");
    lastScannedId.current = null;
    lastScanTime.current = 0;
  };

  // Form Builder
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
    setFormConfig([...formConfig, { ...newQuestion, id, label: newQuestion.label.trim(), options: newQuestion.options.trim() }]);
    setNewQuestion({ label: '', type: 'text', options: '', required: true, showOnProfile: true });
  };

  const handleDeleteQuestion = (index) => {
    const newConfig = [...formConfig];
    newConfig.splice(index, 1);
    setFormConfig(newConfig);
  };

  const handleToggleRequired = (index) => {
    const newConfig = [...formConfig];
    newConfig[index] = { ...newConfig[index], required: !newConfig[index].required };
    setFormConfig(newConfig);
  };

  const handleToggleShowOnProfile = (index) => {
    const newConfig = [...formConfig];
    const currentVal = newConfig[index].showOnProfile !== false;
    newConfig[index] = { ...newConfig[index], showOnProfile: !currentVal };
    setFormConfig(newConfig);
  };

  const handleSaveFormConfig = () => {
    localStorage.setItem('customRegistrationForm', JSON.stringify(formConfig));
    alert("Form configuration saved successfully!");
  };

  const exportCSV = (ticketsToExport, filename) => {
    if (ticketsToExport.length === 0) {
      alert("Error: No registrations match the export criteria!");
      return;
    }

    const allQuestionLabels = new Set();
    ticketsToExport.forEach(t => {
      if (t.answers) {
        Object.keys(t.answers).forEach(label => allQuestionLabels.add(label));
      }
    });
    const labelsArray = Array.from(allQuestionLabels);

    let csvContent = "\ufeff";
    csvContent += "Email,Ticket ID,Ticket Status,Approval Status,Payment,Timestamp";
    labelsArray.forEach(label => {
      csvContent += `,"${label.replace(/"/g, '""')}"`;
    });
    csvContent += "\n";

    ticketsToExport.forEach(t => {
      const email = t.email;
      const id = t.id;
      const status = t.status;
      const approval = t.approval || 'approved';
      const payment = t.payment || 'offline';
      const timestamp = (t.timestamp || '').replace(/"/g, '""');

      let rowStr = `"${email}","${id}","${status}","${approval}","${payment}","${timestamp}"`;
      
      labelsArray.forEach(label => {
        const answer = (t.answers && t.answers[label] !== undefined) ? String(t.answers[label]) : '';
        rowStr += `,"${answer.replace(/"/g, '""')}"`;
      });
      
      csvContent += rowStr + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter tickets by active dashboard event
  const activeEventTickets = tickets.filter(t => {
    if (selectedEventId === 'all') return true;
    const ticketEventId = t.eventId || 'main';
    return ticketEventId === selectedEventId;
  });

  // Compute metrics for active dashboard
  const total = activeEventTickets.length;
  const checked = activeEventTickets.filter(t => t.status === 'checked-in').length;
  const pending = total - checked;
  const activeEvent = allEvents.find(e => e.id === selectedEventId);
  const getEventPrice = (evt) => {
    if (!evt || evt.ticketPrice == null || evt.ticketPrice === '') return 0;
    return Number(evt.ticketPrice) || 0;
  };

  const eventTicketPrice = activeEvent ? getEventPrice(activeEvent) : 0;
  const revenue = selectedEventId === 'all'
    ? activeEventTickets.reduce((sum, t) => {
        const evt = allEvents.find(e => e.id === (t.eventId || 'main'));
        return sum + getEventPrice(evt);
      }, 0)
    : total * eventTicketPrice;
  const attendanceRate = total > 0 ? ((checked / total) * 100).toFixed(1) : '0';

  // Filtered tickets (Search + Filters + Event selection)
  const filteredTickets = tickets.filter(t => {
    const ticketEventId = t.eventId || 'main';
    const matchesEvent = selectedEventId === 'all' || ticketEventId === selectedEventId;
    
    const query = searchFilter.toLowerCase();
    const matchesSearch = t.email.toLowerCase().includes(query) || t.id.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const approval = t.approval || 'approved';
    const matchesApproval = approvalFilter === 'all' || approval === approvalFilter;
    return matchesEvent && matchesSearch && matchesStatus && matchesApproval;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', background: 'var(--bg-main)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{
            width: '40px', height: '40px', border: '4px solid var(--border-card)', 
            borderTop: '4px solid var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading admin panel...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page-wrapper">
      <Helmet>
        <title>Admin Dashboard - Perenti</title>
        <meta name="description" content="Manage events, registrations, and scan tickets on the Perenti Admin Dashboard." />
      </Helmet>
      <main className="admin-main-content">
        <div className="admin-top-nav-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--divider)', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <Link to="/" className="brand-link" style={{ textDecoration: 'none' }}>
              <span className="brand-name">perenti</span>
              <span className="brand-tagline">Smart Events, Seamless Outcomes</span>
            </Link>

          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {session && (
              <span className="session-email-text" id="session-email-display" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {session.displayName || session.email}
              </span>
            )}
            <Link to="/admin-dashboard" className="btn btn-secondary btn-sm" id="btn-header-admin-panel" style={{ textDecoration: 'none' }}>Admin Panel</Link>
            <button type="button" className="btn btn-outline btn-sm" id="btn-header-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="admin-header-row">
          <div className="admin-title-section">
            <h1>Admin Check-in Dashboard</h1>
            <p>Manage RSVPs, scan attendee QR codes, and review registration logs.</p>
          </div>
          <div>
            <Link to="/create-event" className="btn-create-event" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Create Event
            </Link>
          </div>
        </div>

        {/* Active Dashboard Selector */}
        <div className="admin-event-filter-bar">
          <div className="admin-event-filter-select-wrapper">
            <span className="admin-event-filter-label">
              Active Dashboard:
            </span>
            <select 
              value={selectedEventId} 
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="form-control admin-event-filter-select"
            >
              <option value="all">🌐 All Events Combined</option>
              {allEvents.map(evt => (
                <option key={evt.id} value={evt.id}>
                  📅 {evt.name || 'Untitled Event'}
                </option>
              ))}
            </select>
          </div>
          
          {selectedEventId !== 'all' && (
            <div className="admin-event-filter-clear-wrapper">
              <span className="admin-event-filter-badge">
                Filtering Active Dashboard
              </span>
              <button 
                onClick={() => setSelectedEventId('all')} 
                className="btn btn-secondary btn-sm admin-event-filter-clear-btn"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>
        
        <div className="admin-stats-row" style={{marginBottom: '1.25rem'}}>
          <div className="admin-stat-box"><span className="stat-num">{total}</span><span className="stat-label">Total Registered</span></div>
          <div className="admin-stat-box"><span className="stat-num">{checked}</span><span className="stat-label">Checked In</span></div>
          <div className="admin-stat-box"><span className="stat-num">{pending}</span><span className="stat-label">Pending Check-in</span></div>
          <div className="admin-stat-box"><span className="stat-num">₹{revenue.toFixed(2)}</span><span className="stat-label">Revenue</span></div>
          <div className="admin-stat-box"><span className="stat-num">{attendanceRate}%</span><span className="stat-label">Attendance Rate</span></div>
        </div>

        {/* Check-in Overlays */}
        {showSuccessOverlay && (
          <div id="checkin-success-overlay" className="visible" style={{display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(6px)'}}>
            <div className="checkin-success-card" style={{background: '#ffffff', borderRadius: '1.5rem', padding: '2.5rem 2rem 1.75rem', maxWidth: '380px', width: '90%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.45)', position: 'relative', overflow: 'hidden'}}>
              <div className="checkin-success-icon" style={{width: '96px', height: '96px', margin: '0 auto 1.25rem', background: '#ecfdf5', border: '4px solid #10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <p className="checkin-success-title" style={{fontFamily: '"Outfit", sans-serif', fontSize: '1.75rem', fontWeight: 800, color: '#065f46', margin: '0 0 0.5rem 0'}}>Check-in Successful!</p>
              <p className="checkin-success-sub" style={{fontSize: '0.85rem', color: '#6b7280'}}>Attendee verified & admitted</p>
              <div>
                <span className="checkin-detail-chip" style={{display: 'inline-block', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '999px', padding: '0.3rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#065f46', margin: '0.2rem 0.15rem', fontFamily: 'monospace'}}>{overlayDetails.email}</span>
                <span className="checkin-detail-chip" style={{display: 'inline-block', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '999px', padding: '0.3rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#065f46', margin: '0.2rem 0.15rem', fontFamily: 'monospace'}}>{overlayDetails.ticketId}</span>
              </div>
            </div>
          </div>
        )}

        {showAlreadyScannedOverlay && (
          <div id="already-scanned-overlay" className="visible" style={{display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(6px)'}}>
            <div className="already-scanned-card" style={{background: '#ffffff', borderRadius: '1.5rem', padding: '2.5rem 2rem 1.75rem', maxWidth: '380px', width: '90%', textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.45)', position: 'relative', overflow: 'hidden'}}>
              <div className="already-scanned-icon" style={{width: '96px', height: '96px', margin: '0 auto 1.25rem', background: '#fff7ed', border: '4px solid #f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.75rem'}}>⚠️</div>
              <p className="already-scanned-title" style={{fontFamily: '"Outfit", sans-serif', fontSize: '1.75rem', fontWeight: 800, color: '#92400e'}}>Already Scanned!</p>
              <p className="already-scanned-sub" style={{fontSize: '0.85rem', color: '#6b7280'}}>This ticket was already checked in earlier.</p>
              <div>
                <span className="already-scanned-chip" style={{display: 'inline-block', background: '#fff7ed', border: '1px solid #fcd34d', borderRadius: '999px', padding: '0.3rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#92400e', margin: '0.2rem 0.15rem', fontFamily: 'monospace'}}>{overlayDetails.email}</span>
                <span className="already-scanned-chip" style={{display: 'inline-block', background: '#fff7ed', border: '1px solid #fcd34d', borderRadius: '999px', padding: '0.3rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#92400e', margin: '0.2rem 0.15rem', fontFamily: 'monospace'}}>{overlayDetails.ticketId}</span>
              </div>
            </div>
          </div>
        )}

        <div className="admin-panel-box" style={{marginBottom: '1.25rem', paddingTop: '1rem', paddingBottom: '1rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem', marginBottom: '1rem'}}>
            <h3 style={{fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: '"Outfit", sans-serif'}}>Manage Events</h3>
          </div>
          <div className="events-grid" style={{marginTop: 0}}>
            {allEvents.map(evt => {
              const isSelected = selectedEventId === evt.id;
              return (
                <div 
                  className={`event-card ${isSelected ? 'active-event-card' : ''}`} 
                  key={evt.id}
                  onClick={() => setSelectedEventId(isSelected ? 'all' : evt.id)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-card)',
                    boxShadow: isSelected ? '0 4px 12px rgba(90, 154, 142, 0.15)' : 'none',
                    transform: isSelected ? 'scale(1.01)' : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    background: isSelected ? 'var(--bg-info-card)' : 'var(--bg-card)'
                  }}
                >
                  {isSelected && (
                    <span style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      background: 'var(--brand-primary)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.25rem',
                      zIndex: 10
                    }}>
                      ✓ Tracking
                    </span>
                  )}
                  <div className="event-card-banner">
                    <EventImage 
                      src={evt.bannerUrl || ''} 
                      alt="Event Banner" 
                      containerStyle={{ height: '140px' }}
                    />
                  </div>
                  <h4 className="event-card-title">{evt.name || 'Untitled Event'}</h4>
                  <div className="event-card-detail">{evt.startDate ? new Date(evt.startDate).toLocaleDateString() : 'TBA'}</div>
                  <div className="event-card-detail">Capacity: {evt.capacity && evt.capacity.maxAttendees ? `${evt.capacity.maxAttendees} attendees` : 'Unlimited'}</div>
                  <div className="event-card-actions" onClick={e => e.stopPropagation()}>
                    <Link to={`/create-event?id=${evt.id}`} className="btn btn-secondary btn-sm" style={{flex: 1, textAlign: 'center', textDecoration: 'none'}}>Modify</Link>
                    <button type="button" className="btn btn-danger btn-sm" style={{flex: 1}} onClick={() => handleDeleteEvent(evt.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="admin-grid-layout">
          <div id="admin-left-col">
            <div className="admin-panel-box" style={{display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem', paddingBottom: '1rem'}}>
              <div style={{borderBottom: '1px solid var(--divider)', paddingBottom: '1rem'}}>
                <h3 className="admin-panel-title" style={{margin: 0}}>QR Scanner</h3>
              </div>
              <div className="scanner-viewfinder" style={{width: '100%', aspectRatio: '4/3', position: 'relative', borderRadius: '0.5rem', overflow: 'hidden', background: '#000'}}>
                <video ref={videoRef} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, display: isScanning ? 'block' : 'none'}}></video>
                <canvas ref={canvasRef} style={{display: 'none'}}></canvas>
                {isScanning && (
                  <div className="scanner-overlay-box">
                    <div className="scanner-overlay-laser"></div>
                    <div className="scanner-overlay-corner top-left"></div>
                    <div className="scanner-overlay-corner top-right"></div>
                    <div className="scanner-overlay-corner bottom-left"></div>
                    <div className="scanner-overlay-corner bottom-right"></div>
                  </div>
                )}
                {!isScanning && (
                  <div className="scanner-placeholder-content" style={{zIndex: 2, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.75)'}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '2.5rem', height: '2.5rem', opacity: 0.5, color: '#fff', marginBottom: '0.5rem'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                    <span style={{fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8'}}>Camera Scanner Inactive</span>
                  </div>
                )}
              </div>
              <div className="scanner-actions" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                {!isScanning ? (
                  <button type="button" className="btn btn-primary btn-block btn-lg" onClick={startCameraScan}>📷 Start Camera Scanner</button>
                ) : (
                  <button type="button" className="btn btn-block btn-lg" style={{backgroundColor: '#ef4444', color: 'white', border: 'none'}} onClick={stopCameraScan}>🛑 Stop Camera Scanner</button>
                )}
              </div>
              <div style={{border: '1px dashed #cccccc', padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: '#f9f9f9'}}>
                <div style={{fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#666666'}}>SCANNER DEBUG VIEW</div>
                <div style={{fontSize: '0.7rem', fontFamily: 'monospace', color: '#333333'}}>{scanStatus}</div>
              </div>
              <div className="admin-manual-checkin">
                <div style={{marginBottom: '0.25rem'}}>
                  <span className="admin-label-small" style={{margin: 0}}>MANUAL TICKET CHECK-IN</span>
                </div>
                <div className="manual-checkin-row">
                  <input type="text" className="promo-textbox" placeholder="Enter Ticket ID" value={manualTicketId} onChange={e => setManualTicketId(e.target.value)} />
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => { processCheckIn(manualTicketId); setManualTicketId(''); }}>Verify</button>
                </div>
              </div>
            </div>

            <div className="admin-panel-box" style={{padding: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem', marginBottom: '1rem'}}>
                <div style={{width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'rgba(90,154,142,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 19-7z"/></svg>
                </div>
                <h3 className="admin-panel-title" style={{margin: 0}}>Send Announcement</h3>
              </div>
              <p className="panel-section-subtitle" style={{marginBottom: '1rem'}}>Post a message that will be displayed live on the Attendee Tickets Hub.</p>
              <div style={{marginBottom: '0.5rem'}}>
                <textarea
                  className="form-control"
                  placeholder="Write your announcement here..."
                  value={announcement}
                  onChange={e => setAnnouncement(e.target.value)}
                  style={{width: '100%', minHeight: '100px', fontFamily: 'inherit', fontSize: '0.875rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-input)', resize: 'vertical', lineHeight: 1.6, color: 'var(--text-main)', background: 'var(--bg-input)'}}
                />
                <p style={{fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0', textAlign: 'right'}}>{announcement.length} characters</p>
              </div>
              <button type="button" className="btn btn-primary btn-block btn-lg" onClick={broadcastAnnouncement} style={{width: '100%', marginBottom: broadcastedAnnouncement ? '0.75rem' : '0'}}>
                📢 Broadcast Announcement
              </button>

              {broadcastedAnnouncement && (
                <button 
                  type="button" 
                  className="btn btn-block btn-lg" 
                  onClick={deleteAnnouncement} 
                  style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                >
                  🗑️ Delete Announcement
                </button>
              )}
            </div>

            <div className="admin-panel-box" style={{display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem', paddingBottom: '1rem'}}>
              <div style={{borderBottom: '1px solid var(--divider)', paddingBottom: '1rem'}}>
                <h3 className="admin-panel-title" style={{margin: 0}}>Custom Registration Form</h3>
              </div>
              <p className="panel-section-subtitle" style={{margin: 0}}>Configure the questions asked to attendees when they register.</p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                {formConfig.map((q, idx) => (
                  <div 
                    key={q.id} 
                    draggable
                    className="custom-reg-card"
                    onDragStart={(e) => { dragItem.current = idx; e.currentTarget.style.opacity = '0.5'; }}
                    onDragEnter={(e) => { dragOverItem.current = idx; e.preventDefault(); }}
                    onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; handleSort(); }}
                    onDragOver={(e) => e.preventDefault()}
                    style={{background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '0.5rem', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s', cursor: 'grab', width: '100%', boxSizing: 'border-box'}}
                  >
                    {/* Top Section */}
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1}}>
                        {/* Drag icon */}
                        <svg className="custom-reg-drag-handle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{opacity: 0.4, cursor: 'grab', flexShrink: 0}}><circle cx="9" cy="5" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>

                        <strong style={{color: 'var(--text-main)', fontSize: '0.85rem', wordBreak: 'break-word'}}>{(q.label || '').replace(/\s*\([Oo]ptional\)/gi, '')}</strong>
                        <span style={{fontSize: '0.7rem', background: 'var(--bg-info-card)', color: 'var(--brand-primary)', border: '1px solid rgba(90, 154, 142, 0.2)', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 600, textTransform: 'uppercase', flexShrink: 0}}>{q.type}</span>
                      </div>
                      <span style={{color: (q.required === true || q.required === 'true') ? '#ef4444' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.15rem', flexShrink: 0}}>
                        ● {(q.required === true || q.required === 'true') ? 'Required' : 'Optional'}
                      </span>
                    </div>

                    {/* Bottom / Action Section */}
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', width: '100%', borderTop: '1px solid var(--divider)', paddingTop: '0.5rem', flexWrap: 'wrap'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap'}}>
                        {/* Mobile friendly Move Up/Down Controls */}
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.25rem', alignItems: 'center' }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleMove(idx, -1); }} disabled={idx === 0} style={{ padding: '0.15rem', background: 'transparent', border: 'none', color: idx === 0 ? 'var(--divider)' : 'var(--text-secondary)', cursor: idx === 0 ? 'not-allowed' : 'pointer' }} title="Move Up">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleMove(idx, 1); }} disabled={idx === formConfig.length - 1} style={{ padding: '0.15rem', background: 'transparent', border: 'none', color: idx === formConfig.length - 1 ? 'var(--divider)' : 'var(--text-secondary)', cursor: idx === formConfig.length - 1 ? 'not-allowed' : 'pointer' }} title="Move Down">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </button>
                        </div>

                        {/* Required Toggle */}
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.35rem'}}>
                          <span style={{fontSize: '0.75rem', fontWeight: 600, color: q.required ? 'var(--brand-primary)' : 'var(--text-secondary)'}}>
                            {q.required ? 'Required' : 'Optional'}
                          </span>
                          <label className="toggle-switch" style={{display: 'inline-flex', transform: 'scale(0.85)'}} title="Toggle Required/Optional">
                            <input
                              type="checkbox"
                              checked={!!q.required}
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
              <div style={{background: 'var(--bg-info-card)', border: '1px solid var(--border-input)', borderRadius: '0.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                <h4 style={{fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: '"Outfit", sans-serif'}}>Add New Question</h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  <div className="form-group" style={{margin: 0, gap: '0.35rem'}}>
                    <label className="form-label" style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)'}}>Question Label</label>
                    <input type="text" className="form-control" style={{fontSize: '0.85rem'}} value={newQuestion.label} onChange={e => setNewQuestion({...newQuestion, label: e.target.value})} placeholder="e.g. Diet Preferences" />
                  </div>
                  <div className="form-group" style={{margin: 0, gap: '0.35rem'}}>
                    <label className="form-label" style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)'}}>Type</label>
                    <select className="form-control" style={{fontSize: '0.85rem'}} value={newQuestion.type} onChange={e => setNewQuestion({...newQuestion, type: e.target.value})}>
                      <option value="text">Short Text</option>
                      <option value="textarea">Long Text</option>
                      <option value="radio">Multiple Choice (Radio)</option>
                      <option value="select">Dropdown</option>
                      <option value="toggle">Yes/No Toggle</option>
                    </select>
                  </div>
                  {(newQuestion.type === 'radio' || newQuestion.type === 'select') && (
                    <div className="form-group" style={{margin: 0, gap: '0.35rem'}}>
                      <label className="form-label" style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)'}}>Options (comma separated)</label>
                      <input type="text" className="form-control" style={{fontSize: '0.85rem'}} value={newQuestion.options} onChange={e => setNewQuestion({...newQuestion, options: e.target.value})} placeholder="e.g. Vegetarian,Vegan,Gluten-free" />
                    </div>
                  )}
                  <div style={{display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <input type="checkbox" id="fb-new-required" style={{width: '1rem', height: '1rem', cursor: 'pointer', margin: 0}} checked={newQuestion.required} onChange={e => setNewQuestion({...newQuestion, required: e.target.checked})} />
                      <label htmlFor="fb-new-required" className="form-label" style={{margin: 0, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer'}}>Required Question</label>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <input type="checkbox" id="fb-new-showonprofile" style={{width: '1rem', height: '1rem', cursor: 'pointer', margin: 0}} checked={newQuestion.showOnProfile !== false} onChange={e => setNewQuestion({...newQuestion, showOnProfile: e.target.checked})} />
                      <label htmlFor="fb-new-showonprofile" className="form-label" style={{margin: 0, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer'}}>Show on Attendee Profile</label>
                    </div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'}} onClick={handleAddQuestion}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Question
                  </button>
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-block btn-lg" onClick={handleSaveFormConfig} style={{width: '100%'}}>Save Form Configuration</button>
            </div>
          </div>

          <div className="admin-panel-box" id="admin-rsvp-box" style={{paddingTop: '1rem', paddingBottom: '1rem'}}>
            <div className="rsvp-header-row">
              <h3 className="rsvp-title">RSVP & Registration Search</h3>
              <div className="rsvp-view-tabs">
                <button type="button" className={`rsvp-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => {setActiveTab('all'); setStatusFilter('all');}}>All Registrations</button>
                <button type="button" className={`rsvp-tab-btn ${activeTab === 'checked-in' ? 'active' : ''}`} onClick={() => {setActiveTab('checked-in'); setStatusFilter('checked-in');}}>Post-Event Attendees (Checked-In)</button>
              </div>
            </div>
            {/* Filters Row */}
            <div className="rsvp-filters-grid">
              {/* Search input with magnifying glass icon */}
              <div className="rsvp-search-container">
                <span className="rsvp-search-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input 
                  type="text" 
                  className="rsvp-search-input" 
                  placeholder="Search by email or Ticket ID..." 
                  value={searchFilter} 
                  onChange={e => setSearchFilter(e.target.value)} 
                />
              </div>

              {/* Status and Approval filters */}
              <div className="rsvp-selects-group">
                <select 
                  className="rsvp-select" 
                  value={statusFilter} 
                  onChange={e => {setStatusFilter(e.target.value); setActiveTab(e.target.value === 'checked-in' ? 'checked-in' : 'all');}}
                >
                  <option value="all">All Statuses</option>
                  <option value="unused">Unused</option>
                  <option value="checked-in">Checked In</option>
                </select>

                <select 
                  className="rsvp-select" 
                  value={approvalFilter} 
                  onChange={e => setApprovalFilter(e.target.value)}
                >
                  <option value="all">All Approvals</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Active filters status and export buttons row */}
            <div className="rsvp-status-bar">
              <div className="rsvp-count-info">
                <span className="rsvp-count-text">
                  Showing {filteredTickets.length} of {tickets.length} registrations
                </span>
                {(searchFilter || statusFilter !== 'all' || approvalFilter !== 'all') && (
                  <button 
                    type="button" 
                    onClick={() => {setSearchFilter(''); setStatusFilter('all'); setApprovalFilter('all'); setActiveTab('all');}} 
                    className="rsvp-clear-btn"
                  >
                    ✕ Clear all filters
                  </button>
                )}
              </div>

              <div className="rsvp-actions-group">
                <button 
                  type="button" 
                  className="rsvp-action-btn secondary" 
                  onClick={() => exportCSV(filteredTickets, 'registrations_filtered.csv')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export Filtered CSV
                </button>
                <button 
                  type="button" 
                  className="rsvp-action-btn primary" 
                  onClick={() => exportCSV(tickets.filter(t => t.status === 'checked-in'), 'post_event_attendees.csv')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export Checked-In
                </button>
              </div>
            </div>
            <div className="checked-in-list-container" style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
              <table className="attendees-table">
                <thead>
                  <tr>
                    <th style={{padding: '0.75rem 1rem'}}>Name</th>
                    <th className="desktop-only-col" style={{padding: '0.75rem 1rem'}}>Email</th>
                    <th className="desktop-only-col" style={{padding: '0.75rem 1rem'}}>Ticket ID</th>
                    <th className="desktop-only-col" style={{padding: '0.75rem 1rem'}}>Status</th>
                    <th className="desktop-only-col" style={{padding: '0.75rem 1rem'}}>Approval</th>
                    <th style={{padding: '0.75rem 1rem', textAlign: 'center'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.length === 0 ? (
                    <tr className="empty-list-row"><td colSpan="5" style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem 0'}}>No registrations match your filters.</td></tr>
                  ) : (
                    filteredTickets.map(t => {
                      const isChecked = t.status === 'checked-in';
                      const approval = t.approval || 'approved';
                      let approvalStyle = {};
                      if (approval === 'approved') approvalStyle = {backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.2)'};
                      else if (approval === 'rejected') approvalStyle = {backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)'};
                      else approvalStyle = {backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.2)'};

                      return (
                        <tr key={t.id}>
                          <td style={{padding: '0.75rem 1rem', whiteSpace: 'nowrap'}}>
                            {(() => {
                              const user = usersMap[t.email];
                              const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
                              return (
                                <button onClick={() => setSelectedTicket(t)} style={{background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 600, borderBottom: '1px dashed var(--brand-primary)', cursor: 'pointer'}}>
                                  {name || '—'}
                                </button>
                              );
                            })()}
                          </td>
                          <td className="desktop-only-col" style={{padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-secondary)'}}>{t.email}</td>
                          <td className="desktop-only-col" style={{padding: '0.75rem 1rem', whiteSpace: 'nowrap'}}><span className="monospaced-code" style={{fontSize: '0.75rem'}}>{t.id}</span></td>
                          <td className="desktop-only-col" style={{padding: '0.75rem 1rem', whiteSpace: 'nowrap'}}><span className={`badge-status ${isChecked ? 'checked-in' : 'unused'}`}>{isChecked ? 'Checked In' : 'Unused'}</span></td>
                          <td className="desktop-only-col" style={{padding: '0.75rem 1rem', whiteSpace: 'nowrap'}}><span className="badge-status" style={approvalStyle}>{approval.toUpperCase()}</span></td>
                          <td style={{padding: '0.75rem 1rem', textAlign: 'center', verticalAlign: 'middle'}}>
                            {approval === 'pending' && (
                              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center'}}>
                                <button className="btn-action-checkin" style={{backgroundColor: '#10b981'}} onClick={() => updateAttendeeApproval(t.id, 'approved')}>Approve</button>
                                <button className="btn-action-reject" onClick={() => updateAttendeeApproval(t.id, 'rejected')}>Reject</button>
                              </div>
                            )}
                            {approval === 'approved' && !isChecked && (
                              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center'}}>
                                <button className="btn-action-checkin" style={{backgroundColor: 'var(--brand-primary)'}} onClick={() => processCheckIn(t.id)}>Check In</button>
                                <button className="btn-action-reject" onClick={() => updateAttendeeApproval(t.id, 'rejected')}>Reject</button>
                              </div>
                            )}
                             {approval === 'approved' && isChecked && (
                              <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center'}}>
                                <span className="btn-action-checkin" style={{backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.2)', cursor: 'default', pointerEvents: 'none'}}>
                                  Checked-in {formatCheckInTime(t.timestamp)}
                                </span>
                              </div>
                            )}
                            {approval === 'rejected' && (
                              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                <button className="btn-action-checkin" style={{backgroundColor: '#10b981'}} onClick={() => updateAttendeeApproval(t.id, 'approved')}>Approve</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Attendee Details Modal */}
      {selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-card" style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h3 className="modal-title" style={{fontFamily: '"Outfit", sans-serif'}}>Attendee Registration Details</h3>
              <button className="modal-close-btn" onClick={() => setSelectedTicket(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{padding: '1.25rem', maxHeight: '80vh', overflowY: 'auto'}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', background: 'var(--bg-info-card)', border: '1px solid var(--divider)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem'}}>
                <p style={{margin: 0}}><strong>Email:</strong> {selectedTicket.email}</p>
                <p style={{margin: 0}}><strong>Ticket ID:</strong> <span className="monospaced-code" style={{fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)'}}>{selectedTicket.id}</span></p>
                <p style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><strong>Status:</strong> <span className={`badge-status ${selectedTicket.status === 'checked-in' ? 'checked-in' : 'unused'}`} style={{margin: 0}}>{selectedTicket.status === 'checked-in' ? 'Checked In' : 'Unused'}</span></p>
                <p style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><strong>Approval:</strong> <span className={`badge-status ${selectedTicket.approval === 'rejected' ? '' : (selectedTicket.approval === 'approved' ? 'checked-in' : 'unused')}`} style={{margin: 0, ...(selectedTicket.approval === 'rejected' ? {backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)'} : {})}}>{(selectedTicket.approval || 'approved').toUpperCase()}</span></p>
                <p style={{margin: 0}}><strong>Payment Method:</strong> <span style={{textTransform: 'capitalize'}}>{selectedTicket.payment || 'offline'}</span></p>
                <p style={{margin: 0}}><strong>Booking Date:</strong> {selectedTicket.timestamp || '-'}</p>
              </div>
              
              {selectedTicket.answers && Object.keys(selectedTicket.answers).length > 0 ? (
                <div style={{marginTop: '1rem', borderTop: '1px solid var(--divider)', paddingTop: '1rem'}}>
                  <h4 style={{fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)', fontFamily: '"Outfit", sans-serif'}}>Attendee Registration Answers</h4>
                  {Object.entries(selectedTicket.answers)
                    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                    .map(([key, value]) => (
                    <div key={key} style={{marginBottom: '0.75rem', background: 'var(--bg-info-card)', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-card)'}}>
                      <p style={{fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.02em'}}>{key}</p>
                      <p style={{fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500, wordBreak: 'break-word', whiteSpace: 'pre-wrap', margin: 0}}>{value || 'No answer provided.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{marginTop: '1.25rem', borderTop: '1px solid var(--divider)', paddingTop: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic'}}>
                  No custom question responses available for this attendee.
                </div>
              )}
              
              <div style={{marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedTicket(null)} style={{padding: '0.5rem 1.5rem'}}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
