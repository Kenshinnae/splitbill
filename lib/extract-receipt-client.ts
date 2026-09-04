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

/**
 * Server-side OpenAI vision extraction. Requires signed-in Firebase user (idToken).
 */
export async function extractReceiptViaOpenAI(
  file: File,
  user: User,
): Promise<ReceiptExtractionApiResult> {
  const idToken = await user.getIdToken();
  const fd = new FormData();
  fd.append("image", file);
  fd.append("idToken", idToken);

  const res = await fetch("/api/extract-receipt", {
    method: "POST",
    body: fd,
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
    items?: ParsedLineItem[];
    merchant_name?: string;
    subtotal?: number;
    service_charge?: number;
    vat?: number;
    total?: number;
  };

  if (!res.ok) {
    const base =
      typeof data.error === "string" ? data.error : "Receipt extraction failed.";
    const detail =
      typeof data.detail === "string" && data.detail.trim()
        ? ` ${data.detail.trim()}`
        : "";
    throw new Error(`${base}${detail}`.trim());
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    merchant_name: String(data.merchant_name ?? ""),
    subtotal: Number(data.subtotal) || 0,
    service_charge: Number(data.service_charge) || 0,
    vat: Number(data.vat) || 0,
    total: Number(data.total) || 0,
  };
}
