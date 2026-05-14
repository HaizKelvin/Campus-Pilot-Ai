import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    serverSide: true
  };
  console.error('Firestore Server Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase for server-side persistence
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// In-memory store for challenges (short-lived)
const challenges: Record<string, string> = {};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // --- WebAuthn Registration ---
  app.get('/api/webauthn/register-options', async (req, res) => {
    const { userId, userName } = req.query;
    if (!userId || !userName) return res.status(400).json({ error: 'Missing params' });

    const rpName = 'CampusPilot AI';
    const host = req.headers.host || 'localhost';
    const rpID = host.split(':')[0];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(String(userId)),
      userName: String(userName),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    challenges[String(userId)] = options.challenge;
    res.json(options);
  });

  app.post('/api/webauthn/register-verify', async (req, res) => {
    const { userId, body } = req.body;
    const expectedChallenge = challenges[userId];

    if (!expectedChallenge) return res.status(400).json({ error: 'Challenge not found' });

    const host = req.headers.host || 'localhost';
    const rpID = host.split(':')[0];
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const origin = `${protocol}://${host}`;

    try {
      const verification = await verifyRegistrationResponse({
        response: body as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: [origin, `https://${host}`, `http://${host}`],
        expectedRPID: rpID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { id, publicKey, counter } = verification.registrationInfo.credential;
        
        // Persist to Firestore
        const userRef = doc(db, 'users', userId);
        try {
          await setDoc(userRef, {
            webauthnCredentials: arrayUnion({
              id,
              publicKey: Buffer.from(publicKey).toString('base64'),
              counter,
              transports: (body as RegistrationResponseJSON).response.transports,
            })
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
        }

        delete challenges[userId];
        return res.json({ verified: true });
      }
      res.status(400).json({ verified: false });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });

  // --- WebAuthn Authentication ---
  app.get('/api/webauthn/login-options', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // Fetch credentials from Firestore
    let userSnap;
    try {
      userSnap = await getDoc(doc(db, 'users', String(userId)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    }

    if (!userSnap || !userSnap.exists()) return res.status(404).json({ error: 'User not found' });
    
    const userCredentials = userSnap.data().webauthnCredentials || [];
    if (userCredentials.length === 0) return res.status(404).json({ error: 'No credentials for user' });

    const host = req.headers.host || 'localhost';
    const rpID = host.split(':')[0];

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userCredentials.map((cred: any) => ({
        id: cred.id,
        type: 'public-key',
        transports: cred.transports,
      })),
      userVerification: 'preferred',
    });

    challenges[String(userId)] = options.challenge;
    res.json(options);
  });

  app.post('/api/webauthn/login-verify', async (req, res) => {
    const { userId, body } = req.body;
    const expectedChallenge = challenges[userId];
    
    let userSnap;
    try {
      userSnap = await getDoc(doc(db, 'users', String(userId)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    }

    const userCredentials = userSnap?.data()?.webauthnCredentials || [];

    if (!expectedChallenge || userCredentials.length === 0) {
      return res.status(400).json({ error: 'Session mismatch' });
    }

    const dbCredential = userCredentials.find((c: any) => c.id === body.id);
    if (!dbCredential) return res.status(404).json({ error: 'Credential not found' });

    const host = req.headers.host || 'localhost';
    const rpID = host.split(':')[0];
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const origin = `${protocol}://${host}`;

    try {
      // @ts-ignore
      const verification = await verifyAuthenticationResponse({
        response: body as AuthenticationResponseJSON,
        expectedChallenge,
        expectedOrigin: [origin, `https://${host}`, `http://${host}`],
        expectedRPID: rpID,
        credential: {
          id: dbCredential.id,
          publicKey: Buffer.from(dbCredential.publicKey, 'base64'),
          counter: dbCredential.counter,
        },
      });

      if (verification.verified) {
        // Update counter in background (optional but recommended)
        delete challenges[userId];
        return res.json({ verified: true });
      }
      res.status(400).json({ verified: false });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
