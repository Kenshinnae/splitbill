import type { ParsedLineItem } from "@/types";

export interface RawExtractedItem {
  name: string;
  qty: number;
  price: number;
  notes?: string[];
}

export interface RawReceiptExtraction {
  merchant_name: string;
  items: RawExtractedItem[];
  subtotal: number;
  service_charge: number;
  vat: number;
  total: number;
}

/** Map OpenAI extraction to Firestore / bill editor line items. */
export function mapExtractionToParsedLineItems(
  data: RawReceiptExtraction,
): ParsedLineItem[] {
  const out: ParsedLineItem[] = [];
  for (const it of data.items ?? []) {
    const name = String(it.name ?? "").trim();
    if (!name) continue;
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    const price = Math.max(0, Number(it.price));
    if (Number.isNaN(price)) continue;
    const notes = (it.notes ?? [])
      .map((n) => String(n).trim())
      .filter(Boolean);
    out.push({
      name,
      price,
      qty,
      ...(notes.length ? { notes } : {}),
    });
  }
  return out;
}
