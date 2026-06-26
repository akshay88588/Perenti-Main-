import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
};

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function deleteDummies() {
  console.log("Fetching events from Firestore...");
  const eventsRef = db.collection('events');
  const snapshot = await eventsRef.get();
  
  const adminEmails = ['akshayvarmabudigam2006@gmail.com', 'admin@perenti.com'];
  let deletedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.createdBy || !adminEmails.includes(data.createdBy)) {
      console.log(`Deleting dummy event: ${data.name || 'Untitled'} (Created By: ${data.createdBy || 'Unknown'})`);
      await doc.ref.delete();
      deletedCount++;
    } else {
      console.log(`Keeping admin event: ${data.name || 'Untitled'} (Created By: ${data.createdBy})`);
    }
  }
  console.log(`Deleted ${deletedCount} dummy events.`);
}

deleteDummies().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
