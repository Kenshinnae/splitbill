import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  isFirebasePublicConfigReady,
  resolveFirebasePublicConfig,
} from "@/lib/firebase-public-config";

function firebaseConfig() {
  return resolveFirebasePublicConfig();
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

export function getFirebaseApp(): FirebaseApp {
  const c = firebaseConfig();
  if (!isFirebasePublicConfigReady(c)) {
    throw new Error(
      "Missing Firebase config. Ensure public/firebase-config.json exists (npm run zip:hostinger) or set NEXT_PUBLIC_FIREBASE_* in .env.local.",
    );
  }
  if (!getApps().length) {
    app = initializeApp(c);
  } else {
    app = getApps()[0]!;
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    // In-app browsers (Messenger, Instagram, etc.) often break or delay WebSockets;
    // long-polling auto-detect keeps Firestore usable there and on restrictive networks.
    db = initializeFirestore(getFirebaseApp(), {
      experimentalAutoDetectLongPolling: true,
    });
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}
