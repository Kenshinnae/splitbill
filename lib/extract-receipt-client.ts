"use client";

import type { User } from "firebase/auth";
import type { ParsedLineItem } from "@/types";

export interface ReceiptExtractionApiResult {
  items: ParsedLineItem[];
  merchant_name: string;
  subtotal: number;
  service_charge: number;
  vat: number;
  total: number;
}

/** Retry only an explicit 401, never a completed/uncertain paid extraction. */
export async function extractReceiptViaOpenAI(file: File, user: User): Promise<ReceiptExtractionApiResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You are offline. Reconnect and try again.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 115_000);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const idToken = await user.getIdToken(attempt > 0);
      if (controller.signal.aborted) throw new DOMException("Timed out", "AbortError");
      const fd = new FormData();
      fd.append("image", file, file.name);
      fd.append("idToken", idToken);
      const res = await fetch("/api/extract-receipt", {
        method: "POST", body: fd, cache: "no-store", signal: controller.signal,
      });
      if (res.status === 401 && attempt === 0) continue;
      const data = await res.json().catch(() => null) as (Partial<ReceiptExtractionApiResult> & { error?: string }) | null;
      if (res.status === 401) throw new Error("Your session expired. Sign in again and retry.");
      if (res.status === 413) throw new Error("This image is too large. Choose a smaller photo (up to 15 MB).");
      if (!res.ok) throw new Error(data?.error || "Receipt service is unavailable. Please try again later.");
      if (!data || !Array.isArray(data.items)) throw new Error("Receipt extraction failed.");
      return {
        items: data.items, merchant_name: String(data.merchant_name ?? ""),
        subtotal: Number(data.subtotal) || 0, service_charge: Number(data.service_charge) || 0,
        vat: Number(data.vat) || 0, total: Number(data.total) || 0,
      };
    }
    throw new Error("Your session expired. Sign in again and retry.");
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Reading took too long. Keep this screen open and try again.");
    if (error instanceof TypeError) throw new Error("Could not connect to the receipt service. Check your connection and try again.");
    throw error;
  } finally { clearTimeout(timer); }
}
