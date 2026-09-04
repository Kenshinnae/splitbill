/**
 * Thai / English mixed receipt OCR text → structured line items.
 *
 * Heuristics (MVP):
 * - Item lines: leading integer = quantity, trailing decimal (or integer) = line total,
 *   middle = name (Thai, English, /, parentheses allowed).
 * - Lines matching totals/metadata keywords or phone/date patterns are skipped.
 * - Lines that are mostly separators are skipped.
 * - Lines starting with "-" after a valid item attach as notes on that item (not separate bill lines).
 */

import type { ParsedLineItem } from "@/types";
import {
  DATEISH_RE,
  EN_META_PHRASES,
  EN_META_STANDALONE,
  EN_META_WORDS,
  PHONEISH_RE,
  RECEIPT_NO_RE,
  SEPARATOR_LINE_RE,
  THAI_META_PHRASES,
  TIME_RE,
  enWordBoundaryPattern,
} from "@/lib/receipt-meta";

export interface ParsedReceiptItem {
  name: string;
  qty: number;
  /** Line total (same meaning as bill `price` elsewhere). */
  price: number;
  notes?: string[];
}

/**
 * Normalize OCR quirks: newlines, spaces, common substitutions.
 */
export function normalizeOCRText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitOCRLines(normalized: string): string[] {
  return normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** True if the line is mostly dashes / decoration. */
export function isSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3) return false;
  return SEPARATOR_LINE_RE.test(t);
}

/** Totals, tax, header/footer hints, phone, date-only-ish lines. */
export function isMetadataOrTotalLine(line: string): boolean {
  const lower = line.toLowerCase();

  for (const p of THAI_META_PHRASES) {
    if (line.includes(p)) return true;
  }
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
  // Strong date+time header lines (avoid dropping item names that mention dates)
  if (DATEISH_RE.test(line) && TIME_RE.test(line) && line.length < 45) {
    return true;
  }

  // Line is only numbers/punctuation (e.g. "123456")
  if (/^[\d\s.,:]+$/.test(line) && !/\.\d{2}\s*$/.test(line)) {
    return true;
  }

  return false;
}

/**
 * Trailing monetary token: supports 1,234.56 or 440.00 or 99
 * (last number wins as line total).
 */
export function extractTrailingPrice(line: string): {
  price: number;
  rest: string;
} | null {
  const trimmed = line.trim();
  // Last run of digits with optional commas and one optional decimal part
  const re = /^(.*?)\s+([\d,]+(?:\.\d{1,2})?)\s*$/;
  const m = trimmed.match(re);
  if (!m) return null;

  const num = m[2].replace(/,/g, "");
  const price = parseFloat(num);
  if (Number.isNaN(price) || price < 0) return null;

  const rest = m[1].trim();
  if (!rest) return null;

  return { price, rest };
}

/**
 * If `rest` starts with an integer and space, treat as quantity + name.
 * Otherwise qty = 1 and full rest is name.
 */
export function splitQtyAndName(rest: string): { qty: number; name: string } {
  const m = rest.match(/^(\d+)\s+(.+)$/);
  if (m) {
    const qty = parseInt(m[1], 10);
    if (qty > 0 && qty <= 999) {
      return { qty, name: m[2].trim() };
    }
  }
  return { qty: 1, name: rest };
}

/**
 * A plausible item line: has extractable price and non-empty name after qty split.
 * Reject if "name" is too short or looks like pure metadata.
 */
export function parseItemLine(line: string): ParsedReceiptItem | null {
  if (isSeparatorLine(line) || isMetadataOrTotalLine(line)) return null;

  const extracted = extractTrailingPrice(line);
  if (!extracted) return null;

  const { price, rest } = extracted;
  const { qty, name } = splitQtyAndName(rest);

  if (!name || name.length < 1) return null;
  // Drop lines where "name" is only digits (mis-OCR total row)
  if (/^\d+$/.test(name.replace(/\s/g, ""))) return null;

  return { name, qty, price };
}

/**
 * Note sub-line: starts with hyphen, not parseable as a full item row.
 */
export function isLikelyNoteLine(line: string): boolean {
  const t = line.trim();
  if (!/^[-–—]\s*\S/.test(t)) return false;
  // If it parses as item with price at end, it's not a note
  if (parseItemLine(t) !== null) return false;
  return true;
}

export function stripNotePrefix(line: string): string {
  return line.trim().replace(/^[-–—]\s*/, "").trim();
}

/**
 * Full pipeline: normalize → lines → items + attached notes.
 */
export function parseThaiReceiptText(raw: string): ParsedReceiptItem[] {
  const normalized = normalizeOCRText(raw);
  const lines = splitOCRLines(normalized);
  const items: ParsedReceiptItem[] = [];

  for (const line of lines) {
    if (isSeparatorLine(line)) continue;
    if (isMetadataOrTotalLine(line)) continue;

    if (isLikelyNoteLine(line)) {
      const noteText = stripNotePrefix(line);
      if (noteText && items.length > 0) {
        const prev = items[items.length - 1]!;
        if (!prev.notes) prev.notes = [];
        prev.notes.push(noteText);
      }
      continue;
    }

    const item = parseItemLine(line);
    if (item) {
      items.push({ ...item });
    }
  }

  return items;
}

/**
 * Map parser output to app `ParsedLineItem` (Firestore / UI).
 */
export function receiptItemsToParsedLineItems(
  items: ParsedReceiptItem[],
): ParsedLineItem[] {
  return items.map((it) => ({
    name: it.name,
    price: it.price,
    qty: it.qty,
    ...(it.notes?.length ? { notes: it.notes } : {}),
  }));
}
