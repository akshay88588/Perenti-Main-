import express from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { sendPasswordResetEmailJS } from './emailjsHelper.js';

// Load .env from the root of the project
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
};

if (serviceAccount.projectId && serviceAccount.privateKey) {
  try {
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (err) {
    console.error("Firebase Admin initialization error:", err);
  }
} else {
  console.warn("WARNING: Firebase Admin is not initialized because credentials are missing in .env");
}

// Verify keys exist
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("CRITICAL: Razorpay keys are missing from .env file.");
}

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Endpoint to create a new order
 * Expects { amount: number, currency: string, receipt: string } in body
 */
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt = 'receipt#1' } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100 paise (₹1)' });
    }

    const options = {
      amount, // amount in the smallest currency unit (paise)
      currency,
      receipt,
    };

    const order = await razorpay.orders.create(options);
    
    if (!order) {
      return res.status(500).json({ error: 'Some error occurred while creating order' });
    }

    res.json(order);
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * Endpoint to verify the payment signature
 * Expects { razorpay_order_id, razorpay_payment_id, razorpay_signature } in body
 */
app.post('/api/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Creating our own signature using the order_id, payment_id and key_secret
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    // Compare our signature with the one from Razorpay
    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment is verified
      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      // Payment verification failed
      res.status(400).json({ success: false, error: 'Invalid signature. Payment verification failed.' });
    }
  } catch (error) {
    console.error("Signature verification error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Endpoint to send custom forgot password email via EmailJS
 */
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!getApps().length) {
      return res.status(500).json({ error: 'Firebase Admin is not configured. Please use standard flow or configure credentials.' });
    }

    // Generate secure reset link via Firebase Admin
    const resetLink = await getAuth().generatePasswordResetLink(email);

    // EmailJS Configuration
    const emailConfig = {
      serviceId: process.env.VITE_EMAILJS_SERVICE_ID || 'service_perenti',
      templateId: process.env.VITE_EMAILJS_TEMPLATE_ID || 'template_perenti_ticket',
      publicKey: process.env.VITE_EMAILJS_PUBLIC_KEY || 'your_public_key'
    };

    // Send using our helper
    const success = await sendPasswordResetEmailJS(email, resetLink, emailConfig);

    if (success) {
      res.json({ success: true, message: 'Password reset email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send password reset email via EmailJS' });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'auth/user-not-found' });
    }
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../dist')));

// Generate dynamic sitemap
app.get('/sitemap.xml', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // Only fetch active events if Firebase is properly configured
    let events = [];
    if (getApps().length > 0) {
      const db = getFirestore();
      const snapshot = await db.collection('events').get(); // Assuming active events don't have a status field or filter needed
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'archived') {
          events.push({
            id: doc.id,
            slug: data.slug || (data.name ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : doc.id)
          });
        }
      });
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

    events.forEach(evt => {
      xml += `
  <url>
    <loc>${baseUrl}/events/${evt.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    xml += `\n</urlset>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send("Error generating sitemap");
  }
});

// SPA fallback: serve index.html for all non-API routes
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    res.status(404).json({ error: 'Not Found' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
