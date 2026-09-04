/**
 * Alternate receipt layouts: English-heavy POS / Western metadata only.
 * Thai-heavy receipts are handled by `receipt-parser.ts`. This strategy keeps
 * item-line logic the same but uses a lighter metadata filter so English-only
 * headers/footers still parse when Thai keywords are absent.
 */

import type { ParsedReceiptItem } from "@/lib/receipt-parser";
import {
  extractTrailingPrice,
  isSeparatorLine,
  normalizeOCRText,
  splitOCRLines,
  splitQtyAndName,
  stripNotePrefix,
} from "@/lib/receipt-parser";
import {
  DATEISH_RE,
  EN_META_PHRASES,
  EN_META_STANDALONE,
  EN_META_WORDS,
  PHONEISH_RE,
  RECEIPT_NO_RE,
  TIME_RE,
  enWordBoundaryPattern,
} from "@/lib/receipt-meta";

export function isWesternMetadataOrTotalLine(line: string): boolean {
  const lower = line.toLowerCase();

  for (const p of EN_META_PHRASES) {
    if (lower.includes(p)) return true;
  }
  for (const w of EN_META_WORDS) {
    if (enWordBoundaryPattern(w).test(lower)) return true;
  }
  for (const w of EN_META_STANDALONE) {
    if (enWordBoundaryPattern(w).test(lower)) return true;
  }

  if (PHONEISH_RE.test(line)) return true;
  if (RECEIPT_NO_RE.test(line)) return true;
  if (DATEISH_RE.test(line) && TIME_RE.test(line) && line.length < 45) {
    return true;
  }

  if (/^[\d\s.,:]+$/.test(line) && !/\.\d{2}\s*$/.test(line)) {
    return true;
  }

  return false;
}

export function parseWesternItemLine(line: string): ParsedReceiptItem | null {
  if (isSeparatorLine(line) || isWesternMetadataOrTotalLine(line)) return null;

  const extracted = extractTrailingPrice(line);
  if (!extracted) return null;

  const { price, rest } = extracted;
  const { qty, name } = splitQtyAndName(rest);

  if (!name || name.length < 1) return null;
  if (/^\d+$/.test(name.replace(/\s/g, ""))) return null;

  return { name, qty, price };
}

function isLikelyWesternNoteLine(line: string): boolean {
  const t = line.trim();
  if (!/^[-–—]\s*\S/.test(t)) return false;
  if (parseWesternItemLine(t) !== null) return false;
  return true;
}

/** English-oriented OCR blob → items (Thai item names still allowed mid-line). */
export function parseWesternReceiptText(raw: string): ParsedReceiptItem[] {
  const normalized = normalizeOCRText(raw);
  const lines = splitOCRLines(normalized);
  const items: ParsedReceiptItem[] = [];

  for (const line of lines) {
    if (isSeparatorLine(line)) continue;
    if (isWesternMetadataOrTotalLine(line)) continue;

    if (isLikelyWesternNoteLine(line)) {
      const noteText = stripNotePrefix(line);
      if (noteText && items.length > 0) {
        const prev = items[items.length - 1]!;
        if (!prev.notes) prev.notes = [];
        prev.notes.push(noteText);
      }
      continue;
    }

    const item = parseWesternItemLine(line);
    if (item) {
      items.push({ ...item });
    }
  }

  return items;
}
