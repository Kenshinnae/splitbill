/**
 * Create a Hostinger upload zip.
 * Writes public/firebase-config.json + .env.production from .env.hostinger.
 *
 * Run: npm run zip:hostinger
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "bill-calculation-hostinger.zip");
const envHostinger = path.join(root, ".env.hostinger");
const envProduction = path.join(root, ".env.production");
const firebaseJson = path.join(root, "public", "firebase-config.json");

function parseEnvFile(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

if (!fs.existsSync(envHostinger)) {
  console.error("Missing .env.hostinger — create it from .env.example first.");
  process.exit(1);
}

const envRaw = fs.readFileSync(envHostinger, "utf8");
const vars = parseEnvFile(envRaw);

const firebaseConfig = {
  apiKey: vars.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: vars.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(".env.hostinger is missing NEXT_PUBLIC_FIREBASE_* values.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(firebaseJson), { recursive: true });
fs.writeFileSync(firebaseJson, `${JSON.stringify(firebaseConfig, null, 2)}\n`, "utf8");

const envBody = envRaw
  .split("\n")
  .filter((line) => {
    const t = line.trim();
    return t && !t.startsWith("#") && !t.startsWith("NGROK_");
  })
  .join("\n");
fs.writeFileSync(envProduction, `${envBody}\n`, "utf8");

if (fs.existsSync(out)) fs.unlinkSync(out);

const excludes = [
  "node_modules/*",
  ".next/*",
  ".git/*",
  ".env.local",
  ".env.hostinger",
  ".env.example",
  "*.zip",
  ".DS_Store",
  "coverage/*",
];

try {
  execSync(
    `zip -r "${out}" . ${excludes.map((x) => `-x "${x}"`).join(" ")}`,
    { cwd: root, stdio: "inherit" },
  );
} finally {
  if (fs.existsSync(envProduction)) fs.unlinkSync(envProduction);
  if (fs.existsSync(firebaseJson)) fs.unlinkSync(firebaseJson);
}

console.log("\nCreated:", out);
console.log("Includes: public/firebase-config.json + .env.production");
console.log("After deploy, test: https://YOUR-DOMAIN/firebase-config.json");
