/** Firebase web SDK config (all values are safe to expose to the browser). */
export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

declare global {
  interface Window {
    /** Injected from the server layout at request time (Hostinger runtime env). */
    __FIREBASE_CONFIG__?: FirebasePublicConfig;
  }
}

/** Read from server process.env (build time or Hostinger runtime). */
export function readFirebasePublicConfigFromEnv(): FirebasePublicConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

/**
 * Client: prefer window.__FIREBASE_CONFIG__ (runtime from server).
 * Server / fallback: process.env (local .env.local or build-time).
 */
export function resolveFirebasePublicConfig(): FirebasePublicConfig {
  if (typeof window !== "undefined" && window.__FIREBASE_CONFIG__) {
    const w = window.__FIREBASE_CONFIG__;
    if (w.apiKey?.trim() && w.projectId?.trim()) return w;
  }
  return readFirebasePublicConfigFromEnv();
}

export function isFirebasePublicConfigReady(c: FirebasePublicConfig): boolean {
  return Boolean(c.apiKey?.trim() && c.projectId?.trim());
}
