"use client";

import { useEffect } from "react";

/** Register service worker for PWA install (Android) and standalone display. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional — app still works without SW */
    });
  }, []);

  return null;
}
