/**
 * Hybrid receipt extraction: run multiple layout strategies, merge results.
 * 1) Thai + mixed (aggressive Thai/English metadata stripping)
 * 2) Western / English-heavy (English metadata only)
 *
 * Dedupe by normalized name + price. Owner corrects rows in the UI afterward.
 */

import type { ParsedLineItem } from "@/types";
import {
  parseThaiReceiptText,
  receiptItemsToParsedLineItems,
} from "@/lib/receipt-parser";
import { parseWesternReceiptText } from "@/lib/receipt-parse-strategies";

function dedupeKey(item: ParsedLineItem): string {
  return `${item.name.trim().toLowerCase()}|${item.price}`;
}

export function mergeParsedLineItems(lists: ParsedLineItem[][]): ParsedLineItem[] {
  const map = new Map<string, ParsedLineItem>();
  for (const list of lists) {
    for (const it of list) {
      const k = dedupeKey(it);
      if (!map.has(k)) {
        map.set(k, { ...it });
      }
    }
  }
  return [...map.values()];
}

/** Rule-based parse pass after OCR/AI returns raw text. */
export function parseReceiptHybridText(raw: string): ParsedLineItem[] {
  const thai = receiptItemsToParsedLineItems(parseThaiReceiptText(raw));
  const western = receiptItemsToParsedLineItems(parseWesternReceiptText(raw));
  return mergeParsedLineItems([thai, western]);
}
