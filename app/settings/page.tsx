"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OwnerGuard } from "@/components/OwnerGuard";
import { AppShell } from "@/components/AppShell";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import {
  clearOwnerPaymentQr,
  getUserProfile,
  updateOwnerSettings,
  uploadOwnerPaymentQr,
} from "@/lib/bill-service";
import { toUserFacingFirebaseError } from "@/lib/firebase-client-errors";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notify";
import { normalizePaymentQrImage } from "@/lib/receipt-image";
import type { UserProfile } from "@/types";

function SettingsInner() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const p = await getUserProfile(user.uid);
      setProfile(p);
      setDisplayName(p?.displayName ?? "");
    } catch (e) {
      setErr(
        toUserFacingFirebaseError(
          e instanceof Error ? e.message : "Could not load settings.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
    setPerm(notificationPermission());
  }, [reload]);

  async function saveName() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await updateOwnerSettings(user.uid, {
        displayName: displayName.trim(),
      });
      setMsg("Saved.");
      await reload();
    } catch (e) {
      setErr(
        toUserFacingFirebaseError(
          e instanceof Error ? e.message : "Could not save.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onQrUpload(file: File | null) {
    if (!file || !user) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const ready = await normalizePaymentQrImage(file);
      await uploadOwnerPaymentQr(user.uid, ready);
      setMsg("Payment QR updated. It will show on finalized bills.");
      await reload();
    } catch (e) {
      setErr(
        toUserFacingFirebaseError(
          e instanceof Error ? e.message : "Upload failed.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onClearQr() {
    if (!user) return;
    if (!window.confirm("Remove your payment QR?")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await clearOwnerPaymentQr(user.uid);
      setMsg("Payment QR removed.");
      await reload();
    } catch (e) {
      setErr(
        toUserFacingFirebaseError(
          e instanceof Error ? e.message : "Could not remove QR.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function enableNotifications() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const next = await requestNotificationPermission();
      setPerm(next);
      const enabled = next === "granted";
      await updateOwnerSettings(user.uid, { notifyEnabled: enabled });
      if (enabled) {
        setMsg("Notifications enabled for this device.");
      } else if (next === "denied") {
        setErr(
          "Notifications are blocked. Enable them in your browser or phone settings.",
        );
      } else if (next === "unsupported") {
        setErr("This browser does not support notifications.");
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Settings">
        <LoadingScreen />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Settings"
      action={
        <Link
          href="/dashboard"
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
        >
          Bills
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Display name
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Optional label for yourself (not shown to guests yet).
          </p>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user?.email ?? "Your name"}
            className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveName()}
            className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save name
          </button>
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Payment QR
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Upload your bank / PromptPay QR. When you finalize a bill, guests
            will see it on the summary so they can pay you.
          </p>
          {profile?.paymentQrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.paymentQrUrl}
              alt="Your payment QR"
              className="mx-auto mt-4 max-h-56 w-auto rounded-xl border border-zinc-200 bg-white object-contain p-2 dark:border-zinc-700"
            />
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No QR uploaded yet.</p>
          )}
          <label className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm dark:border-zinc-600 dark:bg-zinc-950">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {busy ? "Working…" : "Upload QR image"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) =>
                void onQrUpload(e.target.files?.[0] ?? null)
              }
            />
          </label>
          {profile?.paymentQrUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onClearQr()}
              className="mt-2 w-full rounded-xl border border-red-200 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
            >
              Remove QR
            </button>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Notifications
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            When everyone marks done on a live bill and you have this app open
            (or installed as PWA), you can get a local alert. Does not wake the
            phone if the app is fully closed.
          </p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Status:{" "}
            <span className="font-medium">
              {perm === "granted"
                ? "Enabled"
                : perm === "denied"
                  ? "Blocked"
                  : perm === "unsupported"
                    ? "Unsupported"
                    : "Not enabled"}
            </span>
          </p>
          <button
            type="button"
            disabled={busy || perm === "granted" || perm === "unsupported"}
            onClick={() => void enableNotifications()}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {perm === "granted" ? "Notifications on" : "Enable notifications"}
          </button>
        </section>

        {msg ? (
          <p className="text-center text-sm text-emerald-700 dark:text-emerald-400">
            {msg}
          </p>
        ) : null}
        {err ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <OwnerGuard>
      <SettingsInner />
    </OwnerGuard>
  );
}
