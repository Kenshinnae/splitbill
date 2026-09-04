/** Shared metadata / noise patterns for receipt OCR line filtering. */

export const THAI_META_PHRASES = [
  "ยอดรวม",
  "รวมทั้งสิ้น",
  "ส่วนลด",
  "ยอดสุทธิ",
  "ยอดขาย",
  "ภาษี",
  "รับเงิน",
  "เงินทอน",
  "ทอน",
  "โต๊ะ",
  "ชำระเงิน",
  "ขอบคุณ",
];

export const EN_META_WORDS = [
  "subtotal",
  "discount",
  "vat",
  "invoice",
  "payment",
  "promptpay",
  "mastercard",
  "visa",
  "thank",
];

export const EN_META_PHRASES = [
  "receipt no",
  "receipt #",
  "service charge",
  "grand total",
  "qr code",
  "total due",
];

export const EN_META_STANDALONE = [
  "total",
  "change",
  "cash",
  "table",
  "tel",
  "phone",
];

export const SEPARATOR_LINE_RE = /^[-–—_=.\s·|]+$/;

export const PHONEISH_RE = /(\+66|0)\d[\d\s-]{7,}\d/;

export const DATEISH_RE =
  /\b\d{1,2}[/:.-]\d{1,2}[/:.-]\d{2,4}\b|\b\d{4}[/:.-]\d{1,2}[/:.-]\d{1,2}\b/;

export const RECEIPT_NO_RE = /\b(no\.?|#)\s*[:.]?\s*\d+/i;

export const TIME_RE = /\b\d{1,2}:\d{2}(:\d{2})?\b/;

export function enWordBoundaryPattern(word: string): RegExp {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}
