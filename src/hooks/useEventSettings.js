import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export function useEventSettings() {
  const [ticketsRemaining, setTicketsRemaining] = useState(60);

  useEffect(() => {
    async function init() {
      try {
        const settingsRef = doc(db, 'eventSettings', 'main');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setTicketsRemaining(settingsSnap.data().ticketsRemaining ?? 60);
        } else {
          await setDoc(settingsRef, { ticketsRemaining: 60 });
          setTicketsRemaining(60);
        }
      } catch (error) {
        if (error.code === 'permission-denied') {
          console.warn("Guest mode: using fallback ticket count.");
        } else {
          console.error("Error fetching event settings:", error);
        }
      }
    }
    init();
  }, []);

  const updateTicketsRemaining = useCallback(async (newCount) => {
    setTicketsRemaining(newCount);
    try {
      const settingsRef = doc(db, 'eventSettings', 'main');
      await updateDoc(settingsRef, { ticketsRemaining: newCount });
    } catch (e) {
      console.error("Error updating settings", e);
    }
  }, []);

  return { ticketsRemaining, setTicketsRemaining, updateTicketsRemaining };
}
