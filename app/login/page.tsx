"use client";

import { useI18n } from "@/components/LanguageProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AppShell } from "@/components/AppShell";
import { TunnelHint } from "@/components/TunnelHint";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function LoginPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <AppShell title={t("Sign in")} showHomeLink={false}>
        <LoadingScreen />
      </AppShell>
    );
  }

  if (user) {
    return (
      <AppShell title={t("Sign in")} showHomeLink={false}>
        <LoadingScreen message={t("Redirecting…")} />
      </AppShell>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "Sign-in failed";
      setError(msg.replace("auth/", "").replace(/-/g, " "));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title={t("Owner sign in")} showHomeLink={false}>
      <p className="mb-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {t("This app is invite-only. Use the account your administrator created in Firebase Authentication.")}</p>
      <div className="mb-4">
        <TunnelHint />
      </div>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {t("Email")}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-zinc-900 outline-none ring-emerald-500/40 focus:border-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {t("Password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-zinc-900 outline-none ring-emerald-500/40 focus:border-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {t(error)}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? t("Signing in…") : t("Sign in")}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-zinc-500">
        {t("Guest? Open the share link you received — no account needed.")}</p>
      <p className="mt-4 text-center text-xs text-zinc-400">
        <Link href="/" className="underline underline-offset-2">
          {t("Home")}</Link>
      </p>
    </AppShell>
  );
}
