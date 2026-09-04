"use client";

import { useEffect, useState } from "react";

/**
 * Free dev tunnels (ngrok, Cloudflare Quick Tunnels, etc.) show an interstitial
 * warning page before the app — users often mistake it for the app being
 * "down" or "coming soon".
 */
export function TunnelHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const h = window.location.hostname;
    const tunnel =
      /ngrok|loca\.lt|localtunnel|trycloudflare|serveo|localhost\.run|cloudflaretunnel/i.test(
        h,
      );
    queueMicrotask(() => setShow(tunnel));
  }, []);

  if (!show) return null;

  return (
    <p
      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
      role="note"
    >
      <strong className="font-semibold">Using a dev tunnel?</strong> The first
      screen is often from the tunnel (e.g. ngrok), not this app — tap{" "}
      <strong>Visit Site</strong> or <strong>Continue</strong> there. Then you
      should see SplitBill. Also add this exact URL host in Firebase →
      Authentication → Settings → <strong>Authorized domains</strong>.
    </p>
  );
}
