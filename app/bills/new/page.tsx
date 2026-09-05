"use client";

import { useI18n } from "@/components/LanguageProvider";

import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { OwnerGuard } from "@/components/OwnerGuard";
import { AppShell } from "@/components/AppShell";
import { DeleteBillButton } from "@/components/DeleteBillButton";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeBill } from "@/hooks/useRealtimeBill";
import {
  addBillItem,
  addParticipant,
  clearSelectionsForItem,
  createDraftBill,
  deleteBillItem,
  removeParticipant,
  replaceItemsFromParsed,
  setBillImageUrl,
  startSharing,
  updateBillItem,
  updateBillTitle,
  uploadBillReceiptImage,
} from "@/lib/bill-service";
import type { ItemSplitMode } from "@/types";
import { extractReceiptViaOpenAI } from "@/lib/extract-receipt-client";
import { formatMoney } from "@/lib/currency";
import { normalizeReceiptImage } from "@/lib/receipt-image";

function NewBillInner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const billId = searchParams.get("billId");
  const [creating, setCreating] = useState(() => billId === null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (billId || !user) return;
    let cancelled = false;
    setCreating(true);
    (async () => {
      try {
        const id = await createDraftBill(user.uid, "New bill");
        if (cancelled) return;
        router.replace(`/bills/new?billId=${id}`);
      } catch (e) {
        if (!cancelled) {
          setCreateError(
            e instanceof Error ? e.message : "Could not create bill.",
          );
        }
      } finally {
        if (!cancelled) setCreating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [billId, user, router]);

  const { bill, items, participants, loading, error } =
    useRealtimeBill(billId);

  const wrongOwner =
    bill && user && bill.ownerId !== user.uid ? true : false;

  const title = bill?.title ?? "";
  const [titleDraft, setTitleDraft] = useState(title);
  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  const [participantName, setParticipantName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const uploadLock = useRef(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !billId) return "";
    return `${window.location.origin}/bill/${billId}`;
  }, [billId]);

  const itemsSubtotal = useMemo(
    () => items.reduce((s, i) => s + i.price, 0),
    [items],
  );

  const onUpload = useCallback(
    async (file: File | null, retryRead = false) => {
      if (!file || !billId || !user || uploadLock.current) return;
      uploadLock.current = true;
      setLocalErr(null);
      setUploadMessage(null);
      if (!retryRead) setRetryFile(null);
      setUploadBusy(true);
      setUploadStage("Preparing image…");
      try {
        if (navigator.onLine === false) throw new Error("You are offline. Reconnect and try again.");
        const ready = retryRead ? file : await normalizeReceiptImage(file);
        setRetryFile(ready);
        setUploadStage("Reading receipt and saving photo…");
        // Reading must not depend on Storage succeeding. Both results settle so
        // failures cannot create unhandled promises or silently replace edits later.
        const [photo, scan] = await Promise.allSettled([
          retryRead ? Promise.resolve() : (async () => {
            const url = await uploadBillReceiptImage(billId, ready);
            await setBillImageUrl(billId, url);
          })(),
          (async () => {
            const extracted = await extractReceiptViaOpenAI(ready, user);
            if (!extracted.items.length) throw new Error("No line items were detected on this receipt. Add items manually below.");
            await replaceItemsFromParsed(billId, extracted.items);
            const merchant = extracted.merchant_name?.trim();
            if (merchant && (!bill?.title?.trim() || bill.title === "New bill" || bill.title === "Untitled bill")) {
              await updateBillTitle(billId, merchant);
            }
          })(),
        ]);
        if (scan.status === "rejected") {
          setLocalErr(scan.reason instanceof Error ? scan.reason.message : "Could not read this receipt. Try again or add items manually.");
        } else {
          setRetryFile(null);
          setUploadMessage("Receipt read. Please review the items below.");
        }
        if (photo.status === "rejected") {
          setUploadMessage("Photo could not be saved. Select the photo again to retry the upload.");
        }
      } catch (error) {
        setLocalErr(error instanceof Error ? error.message : "Upload failed");
      } finally {
        uploadLock.current = false;
        setUploadBusy(false);
        setUploadStage("");
      }
    },
    [billId, user, bill?.title],
  );

  async function saveTitle() {
    if (!billId || titleDraft.trim() === title) return;
    try {
      await updateBillTitle(billId, titleDraft);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Could not save title");
    }
  }

  async function onAddParticipant(e: FormEvent) {
    e.preventDefault();
    if (!billId || !participantName.trim()) return;
    try {
      await addParticipant(billId, participantName);
      setParticipantName("");
    } catch (err) {
      setLocalErr(
        err instanceof Error ? err.message : "Could not add participant",
      );
    }
  }

  async function onAddItem(e: FormEvent) {
    e.preventDefault();
    if (!billId || !itemName.trim()) return;
    const price = parseFloat(itemPrice);
    if (Number.isNaN(price) || price < 0) {
      setLocalErr("Enter a valid price.");
      return;
    }
    try {
      await addBillItem(billId, itemName, price);
      setItemName("");
      setItemPrice("");
      setLocalErr(null);
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : "Could not add item");
    }
  }

  async function onStartSharing() {
    if (!billId) return;
    setShareBusy(true);
    setLocalErr(null);
    try {
      await startSharing(billId);
      startTransition(() => router.push(`/bill/${billId}`));
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Could not start sharing");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      setLocalErr("Could not copy link.");
    }
  }

  if (creating || (!billId && !createError)) {
    return (
      <AppShell title={t("New bill")}>
        <LoadingScreen message={t("Preparing your bill…")} />
      </AppShell>
    );
  }

  if (createError) {
    return (
      <AppShell title={t("New bill")}>
        <p className="text-sm text-red-600">{t(createError)}</p>
      </AppShell>
    );
  }

  if (loading && !bill) {
    return (
      <AppShell title={t("New bill")}>
        <LoadingScreen />
      </AppShell>
    );
  }

  if (error || !bill) {
    return (
      <AppShell title={t("New bill")}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t(error ?? "Bill not found.")}
        </p>
      </AppShell>
    );
  }

  if (wrongOwner) {
    return (
      <AppShell title={t("New bill")}>
        <p className="text-sm text-zinc-600">
          {t("This bill belongs to another account.")}</p>
      </AppShell>
    );
  }

  if (bill.status !== "draft") {
    return (
      <AppShell title={bill.title}>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t("This bill is already {status}. Open the room or summary instead.", { status: bill.status === "active" ? t("Live") : t("Finalized") })}</p>
        <button
          type="button"
          onClick={() => router.push(`/bill/${bill.id}`)}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          {t("Open bill room")}</button>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Set up bill")}>
      <fieldset disabled={uploadBusy} className="flex min-w-0 flex-col gap-8">
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("Bill name")}</h2>
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => saveTitle()}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("Receipt image")}</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("Upload a photo. Line items are read automatically (Thai, English, or mixed). Treat results as a draft — correct anything that looks off.")}</p>
          {bill.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bill.imageUrl}
              alt={t("Receipt")}
              className="mt-3 max-h-48 w-full rounded-xl object-contain"
            />
          ) : null}
          <label className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm dark:border-zinc-600 dark:bg-zinc-950">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {uploadBusy ? t(uploadStage) : t("Tap to upload image")}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadBusy}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0] ?? null;
                e.currentTarget.value = "";
                void onUpload(file);
              }}
            />
          </label>
          {uploadBusy ? <p role="status" className="mt-3 text-sm text-zinc-500">{t("Keep this screen open until the receipt is read.")}</p> : null}
          {uploadMessage ? <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{t(uploadMessage)}</p> : null}
          {retryFile && !uploadBusy ? (
            <button type="button" onClick={() => void onUpload(retryFile, true)} className="mt-3 rounded-xl border border-emerald-600 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {t("Read receipt again")}
            </button>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("Line items")}</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("After OCR, pick how each line splits in the room (shared, by units, or one payer). Changing mode clears prior selections for that line.")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input
                    defaultValue={it.name}
                    placeholder={t("Item name")}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v && v !== it.name) {
                        await updateBillItem(billId!, it.id, { name: v });
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t("Qty")}<input
                        type="number"
                        min={1}
                        max={999}
                        defaultValue={it.qty ?? 1}
                        onBlur={async (e) => {
                          const q = parseInt(e.target.value, 10);
                          if (Number.isNaN(q) || q < 1) return;
                          const prev = it.qty ?? 1;
                          if (q !== prev) {
                            await updateBillItem(billId!, it.id, { qty: q });
                          }
                        }}
                        className="w-14 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={it.price}
                      onBlur={async (e) => {
                        const p = parseFloat(e.target.value);
                        if (!Number.isNaN(p) && p >= 0 && p !== it.price) {
                          await updateBillItem(billId!, it.id, { price: p });
                        }
                      }}
                      className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => deleteBillItem(billId!, it.id)}
                      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      {t("Remove")}</button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  placeholder={t("Notes (optional, one per line)")}
                  defaultValue={it.notes?.join("\n") ?? ""}
                  onBlur={async (e) => {
                    const lines = e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const prev = it.notes ?? [];
                    const same =
                      lines.length === prev.length &&
                      lines.every((line, i) => line === prev[i]);
                    if (!same) {
                      await updateBillItem(billId!, it.id, { notes: lines });
                    }
                  }}
                  className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {t("Split mode")}</label>
                  <select
                    value={it.splitMode ?? "shared"}
                    onChange={async (e) => {
                      const v = e.target.value as ItemSplitMode;
                      try {
                        await clearSelectionsForItem(billId!, it.id);
                        await updateBillItem(billId!, it.id, { splitMode: v });
                      } catch (err) {
                        setLocalErr(
                          err instanceof Error
                            ? err.message
                            : t("Could not update split mode"),
                        );
                      }
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="shared">
                      {t("Shared — equal among who select")}</option>
                    <option value="quantity">
                      {t("Quantity — each person enters units")}</option>
                    <option value="single">
                      {t("Single — one person pays full line")}</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={onAddItem} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              placeholder={t("Item name")}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder={t("Price")}
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm sm:w-28 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {t("Add")}</button>
          </form>
        </section>

        <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                {t("Bill total")}</p>
              <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                {t("{count} items · sum of line prices", { count: items.length })}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-950 dark:text-emerald-50">
              {formatMoney(itemsSubtotal)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("Participants")}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {t("Add everyone who will split the bill. Guests pick their name when they join.")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <span className="text-sm font-medium">{p.name}</span>
                <button
                  type="button"
                  onClick={() => removeParticipant(billId!, p.id)}
                  className="text-xs text-red-600"
                >
                  {t("Remove")}</button>
              </li>
            ))}
          </ul>
          <form onSubmit={onAddParticipant} className="mt-3 flex gap-2">
            <input
              placeholder={t("Name")}
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {t("Add")}</button>
          </form>
        </section>

        {localErr ? (
          <p className="text-sm text-red-600" role="alert">
            {t(localErr)}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-zinc-200 bg-[var(--background)]/95 px-4 py-4 backdrop-blur dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-900 px-3 py-2.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <span className="text-sm font-medium opacity-90">{t("Total")}</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(itemsSubtotal)}
            </span>
          </div>
          <p className="text-center text-xs text-zinc-500">
            {t("Share link (after you start):")}{" "}
            <span className="break-all font-mono text-zinc-700 dark:text-zinc-300">
              {shareUrl || "…"}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!shareUrl}
              className="flex-1 rounded-xl border border-zinc-300 py-3 text-sm font-medium dark:border-zinc-600"
            >
              {t("Copy link")}</button>
            <button
              type="button"
              disabled={
                shareBusy || items.length === 0 || participants.length === 0
              }
              onClick={onStartSharing}
              className="flex-[2] rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {shareBusy ? t("Starting…") : t("Start sharing")}
            </button>
          </div>
          <p className="text-center text-[11px] text-zinc-400">
            {t("Requires at least one item and one participant.")}</p>
        </div>

        {billId ? (
          <DeleteBillButton
            billId={billId}
            variant="danger-block"
            label={t("Delete this bill")}
          />
        ) : null}
      </fieldset>
    </AppShell>
  );
}

export default function NewBillPage() {
  const { t } = useI18n();
  return (
    <OwnerGuard>
      <Suspense
        fallback={
          <AppShell title={t("New bill")}>
            <LoadingScreen message={t("Loading…")} />
          </AppShell>
        }
      >
        <NewBillInner />
      </Suspense>
    </OwnerGuard>
  );
}
