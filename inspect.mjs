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

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const eventsRef = db.collection('events');
  const snapshot = await eventsRef.get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('Event Name:', data.name);
    console.dir(data.customRegistrationFields, { depth: null });
  }
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
