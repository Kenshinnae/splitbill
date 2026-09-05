"use client";

import { useI18n } from "@/components/LanguageProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TunnelHint } from "@/components/TunnelHint";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <TunnelHint />
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            SplitBill
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("Shared bill splitting")}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t("Real-time receipts with friends — no app store install.")}</p>
        </div>
        <Link
          href="/login"
          className="block w-full rounded-2xl bg-emerald-600 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          {t("Owner sign in")}</Link>
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          {t("Joining a bill? Open the link your host sent — you don't need an account.")}
        </p>
        {loading ? (
          <p className="text-center text-xs text-zinc-400">{t("Checking session…")}</p>
        ) : null}
      </div>
    </div>
  );
}
