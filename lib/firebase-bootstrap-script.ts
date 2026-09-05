/**
 * Embed available runtime config without blocking parsing/painting on a request.
 * FirebaseConfigGate handles missing config asynchronously with bounded retries.
 */
export function firebaseConfigBootstrapScript(embeddedJson?: string): string {
  const embedded =
    embeddedJson && embeddedJson !== "{}" && embeddedJson.includes("apiKey")
      ? `window.__FIREBASE_CONFIG__=${embeddedJson};`
      : "";

  return embedded;
}
