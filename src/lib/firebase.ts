import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Connectivity Test
async function testConnection() {
  try {
    const docRef = doc(db, 'system', 'health');
    console.log("Attempting connectivity verification to:", docRef.path);
    await getDocFromServer(docRef);
    console.log("Firestore connection verified.");
  } catch (error: any) {
    console.warn("Firestore connectivity warning:", {
      message: error.message,
      code: error.code,
      name: error.name
    });
    if (error.message?.includes('the client is offline') || error.code === 'unavailable') {
      console.error("Firestore is offline or unavailable. This often indicates the database is not yet provisioned or the Firebase API is not enabled for this project.");
    } else if (error.code === 'permission-denied') {
      console.error("Firestore permission denied. Check security rules for /system/health.");
    }
  }
}
testConnection();
