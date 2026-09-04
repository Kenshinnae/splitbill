/** Exact wording from Firestore / Storage JS SDK for permission-denied. */
const PERMISSION_SNIPPET = "Missing or insufficient permissions";

const FRIENDLY: Record<string, string> = {
  [PERMISSION_SNIPPET]: "Could not load data. Sign out and sign in again.",
};

/** Short message for UI — no Firebase setup instructions. */
export function toUserFacingFirebaseError(message: string): string {
  for (const [snippet, friendly] of Object.entries(FRIENDLY)) {
    if (message.includes(snippet)) return friendly;
  }
  if (message.length > 120) {
    return "Something went wrong. Please try again.";
  }
  return message;
}

/** Dev-only: log full hint when rules are missing or misconfigured. */
export function logFirebasePermissionHint(message: string): void {
  if (process.env.NODE_ENV !== "development") return;
  if (!message.includes(PERMISSION_SNIPPET)) return;
  console.warn(
    `[Firebase] ${message}\n\nDeploy rules: npm run deploy:firebase-rules\nOr paste firebase/firestore.rules and firebase/storage.rules in the Firebase console.`,
  );
}
