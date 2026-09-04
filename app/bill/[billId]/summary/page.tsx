"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { DeleteBillButton } from "@/components/DeleteBillButton";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeBill } from "@/hooks/useRealtimeBill";
import { buildFinalSummary } from "@/lib/calculations";
import { formatMoney } from "@/lib/currency";

export default function BillSummaryPage() {
  const params = useParams();
  const billId = params.billId as string;
  const { user } = useAuth();
  const { bill, items, participants, selections, loading, error } =
    useRealtimeBill(billId);

  const isOwner = Boolean(user && bill && user.uid === bill.ownerId);

  const rows = useMemo(
    () => buildFinalSummary(items, participants, selections),
    [items, participants, selections],
  );

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + r.totalOwed, 0),
    [rows],
  );

  if (loading && !bill) {
    return (
      <AppShell title="Summary" showHomeLink={isOwner}>
        <LoadingScreen />
      </AppShell>
    );
  }

  if (error || !bill) {
    return (
      <AppShell title="Summary" showHomeLink={!!user}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {error ?? "Bill not found."}
        </p>
      </AppShell>
    );
  }

  const finalized =
    bill.status === "completed" || bill.status === "closed";

  if (!finalized) {
    return (
      <AppShell title={bill.title} showHomeLink={isOwner}>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            The owner has not finalized this bill yet. Totals may still change
            in the live room.
          </p>
          <Link
            href={`/bill/${billId}`}
            className="mt-4 inline-block text-sm font-medium text-emerald-600 underline dark:text-emerald-400"
          >
            Back to live bill
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Final summary"
      showHomeLink={isOwner}
      action={
        isOwner ? (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              Dashboard
            </Link>
            <DeleteBillButton billId={billId} label="Delete" />
          </div>
        ) : null
      }
    >
      <p className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {bill.title}
      </p>
      <p className="mb-6 text-xs text-zinc-500">
        Read-only · {participants.length} people · {items.length} items
      </p>

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div
            key={r.participantId}
            className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {r.name}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {r.assignedItemsCount} assigned item
                  {r.assignedItemsCount === 1 ? "" : "s"}
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatMoney(r.totalOwed)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-900/10 bg-zinc-900 px-4 py-4 text-white dark:border-zinc-100/10 dark:bg-zinc-100 dark:text-zinc-900">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium opacity-90">Group total</span>
          <span className="text-xl font-bold tabular-nums">
            {formatMoney(grandTotal)}
          </span>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-zinc-400">
        SplitBill · amounts split evenly per item among who selected it
      </p>
    </AppShell>
  );
}
