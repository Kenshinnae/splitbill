import { parseReceiptHybridText } from "@/lib/receipt-pipeline";
import type { ParsedLineItem } from "@/types";

/**
 * Simulated OCR output for a noisy Thai restaurant receipt (Thai + English).
 * Replace `mockExtractReceiptText` with a real Vision/OCR API that returns raw text.
 */
export const SAMPLE_THAI_RECEIPT_OCR = `
ร้าน ตะวันแดง บาร์ แอนด์ กริลล์
Tel 02-123-4567
Receipt No. 88192
12/03/2025  14:22
Table A12
--------------------------------
4 Singha (L) 440.00
1 Rosé Beer Tawandang 100.00
3 Ice/น้ำแข็ง 90.00
- หลอดใหญ่
1 เฟรนซ์ฟรายส์ / Frenchfried 99.00
2 ผัดไทยกุ้งสด 240.00
1 แก้วเปล่า 0.00
- ไม่เอาน้ำแข็ง
ยอดรวม 729.00
ภาษี 7% 47.60
รวมทั้งสิ้น 776.60
ขอบคุณที่ใช้บริการค่ะ
`.trim();

/**
 * Raw OCR string from an image. Swap implementation for Google Vision, etc.
 */
export async function mockExtractReceiptText(file: File): Promise<string> {
  void file;
  await new Promise((r) => setTimeout(r, 600));
  return SAMPLE_THAI_RECEIPT_OCR;
}

/**
 * End-to-end mock: OCR text → hybrid rule-based parsers → line items for Firestore.
 */
export async function mockExtractLineItems(file: File): Promise<ParsedLineItem[]> {
  const raw = await mockExtractReceiptText(file);
  return parseReceiptHybridText(raw);
}
