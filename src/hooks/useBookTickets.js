import { useCallback } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendEmailJSTicket } from '../utils/emailjs';

export function useBookTickets() {
  const bookTicketsForUser = useCallback(async (email, qty, ticketsRemaining, updateTicketsRemaining, answers = {}, eventId = null, eventName = null, eventDetails = null, paymentMethod = 'offline', razorpayPaymentId = null) => {
    const ticketIdsGenerated = [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const timestamp = new Date().toLocaleString();

    let finalEventDetails = eventDetails;
    if (eventId && !finalEventDetails) {
      try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          finalEventDetails = { id: eventDoc.id, ...eventDoc.data() };
        }
      } catch (err) {
        console.error("Failed to fetch event details in useBookTickets:", err);
      }
    }

    const resolvedEventName = eventName || finalEventDetails?.name || null;
    const cleanEventName = resolvedEventName 
      ? resolvedEventName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8) 
      : 'EVENT';

    for (let i = 0; i < qty; i++) {
      let randomSuffix = '';
      for (let c = 0; c < 5; c++) {
        randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const ticketId = `PRNT-${cleanEventName}-${randomSuffix}-${i + 1}`;

      const ticketData = {
        email: email,
        qty: qty,
        status: 'unused',
        payment: paymentMethod,
        timestamp: timestamp,
        approval: 'approved',
        answers: answers,
        ...(eventId ? { eventId } : {}),
        ...(resolvedEventName ? { eventName: resolvedEventName } : {}),
        ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
      };

      try {
        await setDoc(doc(db, 'tickets', ticketId), ticketData);
        ticketIdsGenerated.push(ticketId);
      } catch (err) {
        console.error(`Failed to save ticket ${ticketId}:`, err);
      }
    }

    // Update remaining tickets
    const newRemaining = ticketsRemaining - qty;
    await updateTicketsRemaining(newRemaining);

    // Store in localStorage for UI purposes
    localStorage.setItem('lastGeneratedTickets', JSON.stringify(ticketIdsGenerated));
    localStorage.setItem('justBookedQty', String(qty));
    localStorage.setItem('justBookedEmail', email);

    // Send real email via EmailJS (fire and forget)
    const emailConfig = {
      serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_perenti',
      templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_perenti_ticket',
      publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'your_public_key'
    };
    sendEmailJSTicket(email, ticketIdsGenerated, emailConfig, finalEventDetails).catch(err => {
      console.error("EmailJS dispatch failed:", err);
    });

    return ticketIdsGenerated;
  }, []);

  return { bookTicketsForUser };
}
