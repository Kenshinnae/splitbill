"use client";

import { useI18n } from "@/components/LanguageProvider";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  isFirebasePublicConfigReady,
  resolveFirebasePublicConfig,
  type FirebasePublicConfig,
} from "@/lib/firebase-public-config";

async function loadFirebaseConfig(): Promise<FirebasePublicConfig> {
  const existing = resolveFirebasePublicConfig();
  if (isFirebasePublicConfigReady(existing)) return existing;

  try {
    const staticRes = await fetch("/firebase-config.json", { cache: "no-store" });
    if (staticRes.ok) {
      const fromFile = (await staticRes.json()) as FirebasePublicConfig;
      if (isFirebasePublicConfigReady(fromFile)) {
        window.__FIREBASE_CONFIG__ = fromFile;
        return fromFile;
      }
    }
  } catch {
    /* try API next */
  }

  const res = await fetch("/api/public-config", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      "Could not load Firebase settings. Redeploy with npm run zip:hostinger (includes public/firebase-config.json).",
    );
  }
  const config = (await res.json()) as FirebasePublicConfig;
  if (!isFirebasePublicConfigReady(config)) {
    throw new Error("Firebase settings from the server are incomplete.");
  }
  window.__FIREBASE_CONFIG__ = config;
  return config;
}

/** Wait for Firebase config before any client hook touches Auth/Firestore. */
export function FirebaseConfigGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  // Match SSR and the first hydration render even when the head script has
  // already loaded config. Mount Firebase consumers only after this effect.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    loadFirebaseConfig()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Firebase config failed.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-red-600">{t(error)}</p>
      </div>
    );
  }

  if (!ready) {
    return <LoadingScreen message={t("Loading…")} />;
  }

  return <>{children}</>;
}
