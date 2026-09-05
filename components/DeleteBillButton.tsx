"use client";

import { useI18n } from "@/components/LanguageProvider";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBill } from "@/lib/bill-service";
import { toUserFacingFirebaseError } from "@/lib/firebase-client-errors";

type Props = {
  billId: string;
  /** Where to go after delete. Defaults to dashboard. */
  redirectTo?: string;
  /** Button label */
  label?: string;
  className?: string;
  /** compact = icon-style text for list rows */
  variant?: "default" | "compact" | "danger-block";
};

export function DeleteBillButton({
  billId,
  redirectTo = "/dashboard",
  label = "Delete bill",
  className = "",
  variant = "default",
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onDelete() {
    if (
      !window.confirm(
        t("Delete this bill and all its items, participants, and receipt? This cannot be undone."),
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await deleteBill(billId);
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setErr(
        toUserFacingFirebaseError(
          e instanceof Error ? e.message : "Could not delete bill.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const base =
    variant === "compact"
      ? "shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
      : variant === "danger-block"
        ? "w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
        : "rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40";

  return (
    <span className="inline-flex flex-col items-stretch">
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onDelete();
        }}
        className={`${base} disabled:opacity-50 ${className}`}
        aria-label={t(label)}
      >
        {busy ? t("Deleting…") : t(label)}
      </button>
      {err ? (
        <span className="mt-1 text-xs text-red-600" role="alert">
          {t(err)}
        </span>
      ) : null}
    </span>
  );
}
