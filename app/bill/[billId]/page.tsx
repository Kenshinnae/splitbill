"use client";

import { useI18n } from "@/components/LanguageProvider";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TunnelHint } from "@/components/TunnelHint";
import { DeleteBillButton } from "@/components/DeleteBillButton";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeBill } from "@/hooks/useRealtimeBill";
import {
  addGuestParticipant,
  assignSingleItem,
  finalizeBill,
  setClaimedQuantity,
  setParticipantDone,
  setSelection,
} from "@/lib/bill-service";
import {
  computeItemAssignments,
  computeParticipantTotals,
  getItemSplitMode,
  getParticipantShareForItem,
} from "@/lib/calculations";
import { formatMoney } from "@/lib/currency";
import {
  clearAllDoneNotified,
  markAllDoneNotified,
  notificationPermission,
  requestNotificationPermission,
  showLocalNotification,
  wasAllDoneNotified,
} from "@/lib/notify";

function storageKey(billId: string) {
  return `splitbill_participant_${billId}`;
}

export default function BillRoomPage() {
  const { t } = useI18n();
  const params = useParams();
  const billId = params.billId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { bill, items, participants, selections, loading, error } =
    useRealtimeBill(billId);

  const [joinedId, setJoinedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isOwner = Boolean(user && bill && user.uid === bill.ownerId);

  useEffect(() => {
    if (!billId || typeof window === "undefined") return;
    const raw = localStorage.getItem(storageKey(billId));
    if (raw) setJoinedId(raw);
  }, [billId]);

  useEffect(() => {
    if (bill?.status === "completed" || bill?.status === "closed") {
      router.replace(`/bill/${billId}/summary`);
    }
  }, [bill?.status, billId, router]);

  const me = useMemo(
    () => participants.find((p) => p.id === joinedId) ?? null,
    [participants, joinedId],
  );

  const assignments = useMemo(
    () => computeItemAssignments(items, participants, selections),
    [items, participants, selections],
  );

  const totals = useMemo(
    () => computeParticipantTotals(items, participants, selections),
    [items, participants, selections],
  );

  const doneCount = participants.filter((p) => p.isDone).length;
  const allDone =
    participants.length > 0 && doneCount === participants.length;
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/bill/${billId}`
      : "";

  useEffect(() => {
    if (!isOwner || bill?.status !== "active") return;
    if (!allDone) {
      clearAllDoneNotified(billId);
      return;
    }
    if (wasAllDoneNotified(billId)) return;
    markAllDoneNotified(billId);
    showLocalNotification(t("Everyone is done"), {
      body: t("{title} is ready to finalize.", { title: bill?.title || t("This bill") }),
      tag: `bill-all-done-${billId}`,
    });
  }, [isOwner, bill?.status, bill?.title, allDone, billId, t]);

  async function joinAs(id: string) {
    setJoinedId(id);
    localStorage.setItem(storageKey(billId), id);
  }

  async function joinWithNewName(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setJoinBusy(true);
    setLocalErr(null);
    try {
      const id = await addGuestParticipant(billId, newName.trim());
      await joinAs(id);
      setNewName("");
    } catch (err) {
      setLocalErr(
        err instanceof Error ? err.message : "Could not join with that name.",
      );
    } finally {
      setJoinBusy(false);
    }
  }

  function selectionFor(itemId: string, participantId: string) {
    return selections.find(
      (s) => s.itemId === itemId && s.participantId === participantId,
    );
  }

  function claimedQtyFor(itemId: string, participantId: string): number {
    const q = selectionFor(itemId, participantId)?.claimedQty;
    if (typeof q !== "number" || Number.isNaN(q)) return 0;
    return Math.max(0, Math.floor(q));
  }

  async function toggleSharedSelection(itemId: string, next: boolean) {
    if (!joinedId || bill?.status !== "active") return;
    try {
      await setSelection(billId, itemId, joinedId, next, { claimedQty: 0 });
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onQuantityBlur(itemId: string, raw: string) {
    if (!joinedId || bill?.status !== "active") return;
    try {
      const n = parseInt(raw, 10);
      await setClaimedQuantity(
        billId,
        itemId,
        joinedId,
        Number.isNaN(n) ? 0 : n,
      );
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function toggleSingleAssignee(itemId: string) {
    if (!joinedId || bill?.status !== "active") return;
    try {
      const s = selectionFor(itemId, joinedId);
      if (s?.selected) {
        await assignSingleItem(billId, itemId, null);
      } else {
        await assignSingleItem(billId, itemId, joinedId);
      }
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : "Update failed");
    }
  }

  function isSharedSelected(itemId: string, participantId: string) {
    return Boolean(selectionFor(itemId, participantId)?.selected);
  }

  async function toggleDone() {
    if (!joinedId || bill?.status !== "active") return;
    try {
      await setParticipantDone(billId, joinedId, !me?.isDone);
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function onFinalize() {
    if (!isOwner) return;
    if (!allDone) {
      setLocalErr(
        t("Wait until everyone is done ({done}/{total}).", { done: doneCount, total: participants.length }),
      );
      return;
    }
    setFinalizeBusy(true);
    setLocalErr(null);
    try {
      await finalizeBill(billId);
      router.push(`/bill/${billId}/summary`);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Finalize failed");
    } finally {
      setFinalizeBusy(false);
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setLocalErr("Could not copy link");
    }
  }

  if (loading && !bill) {
    return (
      <AppShell title={t("Bill")} showHomeLink={false}>
        <div className="flex flex-col gap-3">
          <TunnelHint />
          <LoadingScreen
            message={t("Connecting to room…")}
            hint={t("If this never finishes, open the link outside Messenger (Safari / Chrome). In-app browsers often block the connection Firestore needs.")}
          />
        </div>
      </AppShell>
    );
  }

  if (error || !bill) {
    return (
      <AppShell title={t("Bill")} showHomeLink={false}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t(error ?? "This bill could not be loaded.")}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {t("If you are not the owner, the host may still be setting things up.")}</p>
      </AppShell>
    );
  }

  if (bill.status === "completed" || bill.status === "closed") {
    return (
      <AppShell title={bill.title} showHomeLink={false}>
        <LoadingScreen message={t("Opening summary…")} />
      </AppShell>
    );
  }

  if (bill.status === "draft" && !isOwner) {
    return (
      <AppShell title={bill.title} showHomeLink={false}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {t("Not shared yet")}</p>
          <p className="mt-2 text-sm text-amber-800/90 dark:text-amber-200/90">
            {t("The owner is still preparing this bill. Ask them to tap “Start sharing,” then refresh this page.")}</p>
        </div>
      </AppShell>
    );
  }

  if (bill.status === "draft" && isOwner) {
    return (
      <AppShell title={bill.title}>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t("Finish adding items and participants, then start sharing from the setup screen.")}</p>
        <Link
          href={`/bills/new?billId=${billId}`}
          className="inline-block rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          {t("Continue setup")}</Link>
        <div className="mt-6">
          <DeleteBillButton billId={billId} variant="danger-block" />
        </div>
      </AppShell>
    );
  }

  const showJoin =
    bill.status === "active" && !joinedId && !isOwner;

  if (showJoin) {
    return (
      <AppShell title={t("Join bill")} showHomeLink={false}>
        <div className="mb-4">
          <TunnelHint />
        </div>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {bill.title}
        </p>
        <p className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {t("Who are you?")}</p>
        <ul className="mb-4 flex flex-col gap-2">
          {participants.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => joinAs(p.id)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
          {t("Or add yourself")}</p>
        <form onSubmit={joinWithNewName} className="flex flex-col gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("Your name")}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={joinBusy}
            className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {joinBusy ? t("Joining…") : t("Join as new person")}
          </button>
        </form>
        {localErr ? (
          <p className="mt-2 text-sm text-red-600">{t(localErr)}</p>
        ) : null}
      </AppShell>
    );
  }

  const needOwnerIdentity =
    isOwner && !joinedId && bill.status === "active";

  return (
    <AppShell
      title={bill.title}
      showHomeLink={!!isOwner}
      action={
        isOwner ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copyShare}
              className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
            >
              {copied ? t("Copied") : t("Copy link")}
            </button>
            <DeleteBillButton billId={billId} label={t("Delete")} />
          </div>
        ) : null
      }
    >
      <div className="mb-4">
        <TunnelHint />
      </div>
      {needOwnerIdentity ? (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="font-medium text-zinc-800 dark:text-zinc-100">
            {t("Optional: join as a participant")}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {t("Select yourself if you are also splitting items. You can skip this and only manage the bill.")}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {participants.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => joinAs(p.id)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {joinedId && me ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              {t("You")}</p>
            <p className="text-lg font-semibold text-emerald-950 dark:text-emerald-50">
              {me.name}
            </p>
          </div>
          {bill.status === "active" ? (
            <button
              type="button"
              onClick={toggleDone}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                me.isDone
                  ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {me.isDone ? t("Mark not done") : t("I’m done")}
            </button>
          ) : null}
        </div>
      ) : null}

      {isOwner && bill.status === "active" ? (
        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {allDone ? (
            <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3 dark:border-emerald-800 dark:bg-emerald-950/50">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {t("Everyone is done — ready to finalize")}</p>
              <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/90">
                {t("All {count} people marked done. Review totals, then finalize.", { count: participants.length })}
              </p>
              {notificationPermission() !== "granted" &&
              notificationPermission() !== "unsupported" ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-emerald-700 underline dark:text-emerald-300"
                  onClick={() => void requestNotificationPermission()}
                >
                  {t("Enable notifications next time")}</button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {t("Progress")}</p>
            <p className="text-sm text-zinc-500">
              {t("{done}/{total} done", { done: doneCount, total: participants.length })}
            </p>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-zinc-700 dark:text-zinc-200">
                  {p.name}
                </span>
                <span
                  className={
                    p.isDone
                      ? "font-medium text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {p.isDone ? t("Done") : t("Pending")}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={finalizeBusy || !allDone || participants.length === 0}
            onClick={onFinalize}
            className="mt-4 w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {finalizeBusy
              ? t("Finalizing…")
              : allDone
                ? t("Finalize bill")
                : t("Finalize locked · {done}/{total} done", { done: doneCount, total: participants.length })}
          </button>
          {!allDone && participants.length > 0 ? (
            <p className="mt-2 text-center text-[11px] text-zinc-500">
              {t("Everyone must tap “I’m done” before you can finalize.")}</p>
          ) : null}
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {t("Group progress")}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {t("{done} of {total} marked done", { done: doneCount, total: participants.length })}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  p.isDone
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                }`}
              >
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("Items")}</h2>
        <ul className="flex flex-col gap-3">
          {assignments.map((row) => {
            const mode = getItemSplitMode(row.item);
            const assigneeName =
              row.assigneeId &&
              participants.find((p) => p.id === row.assigneeId)?.name;
            const myShare =
              joinedId && participants.length > 0
                ? getParticipantShareForItem(
                    row.item,
                    selections,
                    joinedId,
                    participants,
                  )
                : 0;
            const iSelected =
              Boolean(joinedId) && isSharedSelected(row.item.id, joinedId!);
            const iPayAll =
              Boolean(joinedId) &&
              Boolean(selectionFor(row.item.id, joinedId!)?.selected);
            const canTapSelect =
              Boolean(joinedId && me && bill.status === "active") &&
              (mode === "shared" || mode === "single");

            return (
              <li key={row.item.id}>
                <div
                  role={canTapSelect ? "button" : undefined}
                  tabIndex={canTapSelect ? 0 : undefined}
                  onClick={
                    canTapSelect
                      ? () => {
                          if (mode === "shared" && joinedId) {
                            void toggleSharedSelection(
                              row.item.id,
                              !iSelected,
                            );
                          } else if (mode === "single") {
                            void toggleSingleAssignee(row.item.id);
                          }
                        }
                      : undefined
                  }
                  onKeyDown={
                    canTapSelect
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).click();
                          }
                        }
                      : undefined
                  }
                  className={`rounded-2xl border p-4 shadow-sm transition ${
                    canTapSelect ? "cursor-pointer active:scale-[0.99]" : ""
                  } ${
                    (mode === "shared" && iSelected) ||
                    (mode === "single" && iPayAll)
                      ? "border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/40 dark:ring-emerald-800"
                      : row.assignment === "unassigned"
                        ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                        : "border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      {mode === "shared"
                        ? t("Equal split")
                        : mode === "quantity"
                          ? t("By units")
                          : t("Single payer")}
                      {canTapSelect ? t(" · tap to select") : ""}
                    </p>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {row.item.name}
                      {row.item.qty != null && row.item.qty > 1 ? (
                        <span className="ml-1.5 text-sm font-normal text-zinc-500">
                          ×{row.item.qty}
                        </span>
                      ) : null}
                    </p>
                    {row.item.notes?.length ? (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {row.item.notes.join(" · ")}
                      </p>
                    ) : null}
                    <p className="text-sm text-zinc-500">
                      {formatMoney(row.item.price)} {t("total")}</p>
                    {row.assignment === "unassigned" ? (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        {mode === "quantity"
                          ? t("Unassigned — add units to split")
                          : mode === "single"
                            ? t("Unassigned — one person must claim")
                            : t("Unassigned — not included in totals")}
                      </p>
                    ) : mode === "shared" ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("{count} people · {amount} each", { count: row.selectorCount, amount: formatMoney(row.sharePerPerson ?? 0) })}
                      </p>
                    ) : mode === "quantity" ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("{count} units claimed · share by proportion", { count: row.totalClaimedUnits })}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-500">
                        {assigneeName ? (
                          <>
                            {t("Full line:")}<strong>{assigneeName}</strong>
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                    )}
                    {joinedId &&
                    me &&
                    row.assignment === "assigned" &&
                    myShare > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {t("Your share:")}{formatMoney(myShare)}
                      </p>
                    ) : null}
                  </div>
                  {joinedId && me && bill.status === "active" ? (
                    mode === "shared" ? (
                      <span
                        aria-hidden
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          iSelected
                            ? "bg-emerald-600 text-white"
                            : "border border-zinc-300 text-zinc-400 dark:border-zinc-600"
                        }`}
                      >
                        {iSelected ? "✓" : ""}
                      </span>
                    ) : mode === "quantity" ? (
                      <label
                        className="flex shrink-0 flex-col gap-0.5 text-[10px] font-medium text-zinc-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t("Units")}<input
                          type="number"
                          min={0}
                          max={999}
                          key={`u-${row.item.id}-${joinedId}-${claimedQtyFor(row.item.id, joinedId)}`}
                          defaultValue={claimedQtyFor(row.item.id, joinedId)}
                          onBlur={(e) =>
                            onQuantityBlur(row.item.id, e.target.value)
                          }
                          className="w-16 rounded-lg border border-zinc-200 bg-white px-1.5 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                    ) : (
                      <span
                        aria-hidden
                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${
                          iPayAll
                            ? "bg-emerald-600 text-white"
                            : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                        }`}
                      >
                        {iPayAll ? t("You pay all") : t("I pay all")}
                      </span>
                    )
                  ) : null}
                </div>
                {isOwner ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {participants.map((p) => {
                      let active = false;
                      let suffix = "";
                      if (mode === "shared") {
                        active = isSharedSelected(row.item.id, p.id);
                      } else if (mode === "quantity") {
                        const u = claimedQtyFor(row.item.id, p.id);
                        active = u > 0;
                        suffix = u > 0 ? ` ${t("{count} units", { count: u })}` : "";
                      } else {
                        active = row.assigneeId === p.id;
                      }
                      return (
                        <span
                          key={p.id}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                          }`}
                        >
                          {p.name}
                          {suffix}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-24 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("Live totals")}</h2>
        <ul className="flex flex-col gap-2">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between border-b border-zinc-200/80 pb-2 last:border-0 dark:border-zinc-700/80"
            >
              <span className="text-sm text-zinc-700 dark:text-zinc-200">
                {p.name}
              </span>
              <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatMoney(totals.get(p.id) ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {localErr ? (
        <p className="mb-4 text-sm text-red-600">{t(localErr)}</p>
      ) : null}

      {bill.status === "active" && !isOwner ? (
        <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-[var(--background)]/95 p-4 backdrop-blur dark:border-zinc-800">
          <div className="mx-auto max-w-lg">
            <Link
              href={`/bill/${billId}/summary`}
              className="block text-center text-xs text-zinc-500 underline"
            >
              {t("Summary appears after the owner finalizes")}</Link>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
