"use client";

import { useI18n } from "@/components/LanguageProvider";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { loadFirebaseConfig } from "@/lib/load-firebase-config";

/** Wait for Firebase config before any client hook touches Auth/Firestore. */
export function FirebaseConfigGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  // Match SSR and the first hydration render even when the head script has
  // already loaded config. Mount Firebase consumers only after this effect.
  const [attempt, setAttempt] = useState(0);
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
  }, [ready, attempt]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-red-600">{t(error)}</p>
        <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-white" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>
          {t("Try again")}
        </button>
      </div>
    );
  }

  if (!ready) {
    return <LoadingScreen message={t("Loading…")} />;
  }

  return <>{children}</>;
}
