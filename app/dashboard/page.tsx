"use client";

import { useI18n } from "@/components/LanguageProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { OwnerGuard } from "@/components/OwnerGuard";
import { AppShell } from "@/components/AppShell";
import { DeleteBillButton } from "@/components/DeleteBillButton";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerBills } from "@/hooks/useOwnerBills";
import { getFirebaseAuth } from "@/lib/firebase";
import type { Bill } from "@/types";

function statusLabel(status: Bill["status"]) {
  switch (status) {
    case "draft":
      return "Draft";
    case "active":
      return "Live";
    case "completed":
    case "closed":
      return "Finalized";
    default:
      return status;
  }
}

function billHref(bill: Bill) {
  if (bill.status === "draft") {
    return `/bills/new?billId=${bill.id}`;
  }
  if (bill.status === "active") {
    return `/bill/${bill.id}`;
  }
  return `/bill/${bill.id}/summary`;
}

function DashboardContent() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const { bills, loading, error } = useOwnerBills(user?.uid);

  async function logout() {
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }

  return (
    <AppShell
      title={t("Your bills")}
      action={
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
          >
            {t("Settings")}</Link>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {t("Sign out")}</button>
        </div>
      }
    >
      {user?.email ? (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {t("Signed in as")} {user.email}
        </p>
      ) : null}

      <Link
        href="/bills/new"
        className="mb-6 block rounded-2xl bg-emerald-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        {t("Create new bill")}</Link>

      {loading ? <LoadingScreen message={t("Loading bills…")} /> : null}

      {error ? (
        <p className="mb-4 rounded-xl bg-zinc-100 px-3 py-2 text-center text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {t(error)}
        </p>
      ) : null}

      {!loading && !error && bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("No bills yet. Create one to upload a receipt and invite friends.")}</p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {bills.map((bill) => (
          <li key={bill.id}>
            <div className="flex items-stretch gap-2">
              <Link
                href={billHref(bill)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white px-4 py-3.5 shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {bill.title || t("Untitled bill")}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t(statusLabel(bill.status))}
                  </p>
                </div>
                <span className="shrink-0 text-zinc-400" aria-hidden>
                  →
                </span>
              </Link>
              <DeleteBillButton
                billId={bill.id}
                label={t("Delete")}
                variant="compact"
              />
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <OwnerGuard>
      <DashboardContent />
    </OwnerGuard>
  );
}
