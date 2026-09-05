import {
  isFirebasePublicConfigReady,
  resolveFirebasePublicConfig,
  type FirebasePublicConfig,
} from "./firebase-public-config";

export const CONFIG_TIMEOUT_MS = 8000;
export const CONFIG_LOAD_ERROR = "Could not load app settings. Check your connection and try again.";

async function fetchConfig(url: string): Promise<FirebasePublicConfig> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(CONFIG_LOAD_ERROR);
        const config = await response.json();
        if (!config || !isFirebasePublicConfigReady(config)) throw new Error(CONFIG_LOAD_ERROR);
        return config as FirebasePublicConfig;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(CONFIG_LOAD_ERROR));
          controller.abort();
        }, CONFIG_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Bound both the request and response body; a missing static file is normal on Hostinger. */
export async function loadFirebaseConfig(): Promise<FirebasePublicConfig> {
  const existing = resolveFirebasePublicConfig();
  if (isFirebasePublicConfigReady(existing)) return existing;
  for (const url of ["/firebase-config.json", "/api/public-config"]) {
    try {
      const config = await fetchConfig(url);
      window.__FIREBASE_CONFIG__ = config;
      return config;
    } catch {
      // Try the runtime endpoint, or expose a retryable failure after both attempts.
    }
  }
  throw new Error(CONFIG_LOAD_ERROR);
}
