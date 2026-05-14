import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
