"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
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
    async (file: File | null) => {
      if (!file || !billId || !user) return;
      setLocalErr(null);
      setUploadBusy(true);
      try {
        // HEIC / huge phone photos → JPEG before Storage + OpenAI vision.
        const ready = await normalizeReceiptImage(file);
        const url = await uploadBillReceiptImage(billId, ready);
        await setBillImageUrl(billId, url);
        try {
          // OpenAI Responses API only — no local OCR / mock OCR.
          const extracted = await extractReceiptViaOpenAI(ready, user);
          if (extracted.items.length > 0) {
            await replaceItemsFromParsed(billId, extracted.items);
          } else {
            setLocalErr(
              "No line items were detected on this receipt. Add items manually below.",
            );
          }
          const m = extracted.merchant_name?.trim();
          if (
            m &&
            (bill?.title === "New bill" ||
              bill?.title === "Untitled bill" ||
              !bill?.title?.trim())
          ) {
            await updateBillTitle(billId, m);
          }
        } catch (scanErr) {
          setLocalErr(
            scanErr instanceof Error
              ? `Could not read the receipt automatically (${scanErr.message}). Your photo is saved — add or edit line items below.`
              : "Could not read the receipt automatically. Your photo is saved — add or edit line items below.",
          );
        }
      } catch (e) {
        setLocalErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploadBusy(false);
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
      <AppShell title="New bill">
        <LoadingScreen message="Preparing your bill…" />
      </AppShell>
    );
  }

  if (createError) {
    return (
      <AppShell title="New bill">
        <p className="text-sm text-red-600">{createError}</p>
      </AppShell>
    );
  }

  if (loading && !bill) {
    return (
      <AppShell title="New bill">
        <LoadingScreen />
      </AppShell>
    );
  }

  if (error || !bill) {
    return (
      <AppShell title="New bill">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {error ?? "Bill not found."}
        </p>
      </AppShell>
    );
  }

  if (wrongOwner) {
    return (
      <AppShell title="New bill">
        <p className="text-sm text-zinc-600">
          This bill belongs to another account.
        </p>
      </AppShell>
    );
  }

  if (bill.status !== "draft") {
    return (
      <AppShell title={bill.title}>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          This bill is already {bill.status === "active" ? "live" : "finalized"}
          . Open the room or summary instead.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/bill/${bill.id}`)}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
        >
          Open bill room
        </button>
      </AppShell>
    );
  }

  return (
    <AppShell title="Set up bill">
      <div className="flex flex-col gap-8">
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Bill name
          </h2>
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => saveTitle()}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Receipt image
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Upload a photo. Line items are read automatically (Thai, English, or
            mixed). Treat results as a draft — correct anything that looks off.
          </p>
          {bill.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bill.imageUrl}
              alt="Receipt"
              className="mt-3 max-h-48 w-full rounded-xl object-contain"
            />
          ) : null}
          <label className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm dark:border-zinc-600 dark:bg-zinc-950">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {uploadBusy ? "Working…" : "Tap to upload image"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadBusy}
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            />
          </label>
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Line items
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            After OCR, pick how each line splits in the room (shared, by units,
            or one payer). Changing mode clears prior selections for that line.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input
                    defaultValue={it.name}
                    placeholder="Item name"
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
                      Qty
                      <input
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
                      Remove
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  placeholder="Notes (optional, one per line)"
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
                    Split mode
                  </label>
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
                            : "Could not update split mode",
                        );
                      }
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="shared">
                      Shared — equal among who select
                    </option>
                    <option value="quantity">
                      Quantity — each person enters units
                    </option>
                    <option value="single">
                      Single — one person pays full line
                    </option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={onAddItem} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder="Price"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm sm:w-28 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Bill total
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                {items.length} item{items.length === 1 ? "" : "s"} · sum of line
                prices
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-950 dark:text-emerald-50">
              {formatMoney(itemsSubtotal)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Participants
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Add everyone who will split the bill. Guests pick their name when
            they join.
          </p>
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
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={onAddParticipant} className="mt-3 flex gap-2">
            <input
              placeholder="Name"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
          </form>
        </section>

        {localErr ? (
          <p className="text-sm text-red-600" role="alert">
            {localErr}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-zinc-200 bg-[var(--background)]/95 px-4 py-4 backdrop-blur dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-900 px-3 py-2.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <span className="text-sm font-medium opacity-90">Total</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMoney(itemsSubtotal)}
            </span>
          </div>
          <p className="text-center text-xs text-zinc-500">
            Share link (after you start):{" "}
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
              Copy link
            </button>
            <button
              type="button"
              disabled={
                shareBusy || items.length === 0 || participants.length === 0
              }
              onClick={onStartSharing}
              className="flex-[2] rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {shareBusy ? "Starting…" : "Start sharing"}
            </button>
          </div>
          <p className="text-center text-[11px] text-zinc-400">
            Requires at least one item and one participant.
          </p>
        </div>

        {billId ? (
          <DeleteBillButton
            billId={billId}
            variant="danger-block"
            label="Delete this bill"
          />
        ) : null}
      </div>
    </AppShell>
  );
}

export default function NewBillPage() {
  return (
    <OwnerGuard>
      <Suspense
        fallback={
          <AppShell title="New bill">
            <LoadingScreen message="Loading…" />
          </AppShell>
        }
      >
        <NewBillInner />
      </Suspense>
    </OwnerGuard>
  );
}
