import fs from "node:fs";
import path from "node:path";
import {
  isFirebasePublicConfigReady,
  readFirebasePublicConfigFromEnv,
  type FirebasePublicConfig,
} from "@/lib/firebase-public-config";

const CONFIG_FILENAME = "firebase-config.json";

function configFileCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "public", CONFIG_FILENAME),
    path.join(cwd, CONFIG_FILENAME),
    path.join(cwd, "..", "public", CONFIG_FILENAME),
  ];
}

/** Hostinger fallback: static file shipped in deploy zip (Firebase web keys are public). */
export function readFirebasePublicConfigFromFile(): FirebasePublicConfig | null {
  for (const filePath of configFileCandidates()) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw) as FirebasePublicConfig;
      if (isFirebasePublicConfigReady(data)) return data;
    } catch {
      /* try next path */
    }
  }
  return null;
}

export function resolveFirebasePublicConfigForServer(): FirebasePublicConfig | null {
  const fromFile = readFirebasePublicConfigFromFile();
  if (fromFile) return fromFile;
  const fromEnv = readFirebasePublicConfigFromEnv();
  return isFirebasePublicConfigReady(fromEnv) ? fromEnv : null;
}
