#!/usr/bin/env node
/**
 * Optional: create an email/password user via the Firebase Identity Toolkit REST API.
 * Requires Email/Password enabled in Firebase Authentication.
 *
 * If your project has disabled public sign-up, use Firebase Console instead:
 * Authentication → Add user.
 *
 * Usage:
 *   NEXT_PUBLIC_FIREBASE_API_KEY=... node scripts/seed-owner.mjs owner@example.com 'your-password'
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const [emailArg, passwordArg] = process.argv.slice(2);

async function main() {
  if (!apiKey) {
    console.error("Set NEXT_PUBLIC_FIREBASE_API_KEY in the environment.");
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  const email =
    emailArg?.trim() ||
    (await rl.question("Owner email: "));
  const password =
    passwordArg ||
    (await rl.question("Password (min 6 chars): "));
  rl.close();

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      password,
      returnSecureToken: true,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Failed:", body.error?.message || res.statusText);
    console.error(
      "\nIf sign-up is disabled, add the user manually: Firebase Console → Authentication → Users → Add user.",
    );
    process.exit(1);
  }

  console.log("Created owner user:", body.email || email);
  console.log("You can sign in at /login in the app.");
}

main();
