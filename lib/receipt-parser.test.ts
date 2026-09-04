import { describe, expect, it } from "vitest";
import {
  isMetadataOrTotalLine,
  isSeparatorLine,
  normalizeOCRText,
  parseThaiReceiptText,
  receiptItemsToParsedLineItems,
} from "./receipt-parser";

describe("normalizeOCRText", () => {
  it("normalizes newlines and spaces", () => {
    expect(normalizeOCRText("  a  \r\n\r\n  b  ")).toBe("a\n\nb");
  });
});

describe("isSeparatorLine", () => {
  it("detects dashed rules", () => {
    expect(isSeparatorLine("--------------------------------")).toBe(true);
    expect(isSeparatorLine("———")).toBe(true);
  });
  it("does not flag very short strings", () => {
    expect(isSeparatorLine("--")).toBe(false);
  });
});

describe("isMetadataOrTotalLine", () => {
  it("flags Thai totals", () => {
    expect(isMetadataOrTotalLine("ยอดรวม 729.00")).toBe(true);
    expect(isMetadataOrTotalLine("รวมทั้งสิ้น 776.60")).toBe(true);
    expect(isMetadataOrTotalLine("ส่วนลด 20.00")).toBe(true);
  });
  it("flags English totals", () => {
    expect(isMetadataOrTotalLine("Subtotal 100.00")).toBe(true);
    expect(isMetadataOrTotalLine("Grand total 200")).toBe(true);
  });
  it("does not flag hotel (contains tel substring)", () => {
    expect(isMetadataOrTotalLine("Stay at Hotel Marriott 1200.00")).toBe(false);
  });
});

describe("parseThaiReceiptText", () => {
  it("parses user-style mixed Thai/English item lines", () => {
    const raw = `
4 Singha (L) 440.00
1 Rosé Beer Tawandang 100.00
3 Ice/น้ำแข็ง 90.00
1 เฟรนซ์ฟรายส์ / Frenchfried 99.00
    `.trim();

    const items = parseThaiReceiptText(raw);
    expect(items).toEqual([
      { name: "Singha (L)", qty: 4, price: 440 },
      { name: "Rosé Beer Tawandang", qty: 1, price: 100 },
      { name: "Ice/น้ำแข็ง", qty: 3, price: 90 },
      { name: "เฟรนซ์ฟรายส์ / Frenchfried", qty: 1, price: 99 },
    ]);
  });

  it("parses Thai-only names", () => {
    const raw = "2 ส้มตำไทย 80.00\n1 ข้าวเหนียว 15.00";
    expect(parseThaiReceiptText(raw)).toEqual([
      { name: "ส้มตำไทย", qty: 2, price: 80 },
      { name: "ข้าวเหนียว", qty: 1, price: 15 },
    ]);
  });

  it("parses English-only names", () => {
    const raw = "2 Draft Beer 180.00\n1 Lemonade 45.00";
    expect(parseThaiReceiptText(raw)).toEqual([
      { name: "Draft Beer", qty: 2, price: 180 },
      { name: "Lemonade", qty: 1, price: 45 },
    ]);
  });

  it("supports zero-price items and attaches hyphen notes", () => {
    const raw = `
1 แก้วเปล่า 0.00
- ไม่เอาน้ำแข็ง
3 Ice/น้ำแข็ง 90.00
- หลอดใหญ่
    `.trim();

    const items = parseThaiReceiptText(raw);
    expect(items[0]).toEqual({
      name: "แก้วเปล่า",
      qty: 1,
      price: 0,
      notes: ["ไม่เอาน้ำแข็ง"],
    });
    expect(items[1]).toEqual({
      name: "Ice/น้ำแข็ง",
      qty: 3,
      price: 90,
      notes: ["หลอดใหญ่"],
    });
  });

  it("implicit qty 1 when no leading quantity", () => {
    const raw = "Green curry 85.50";
    expect(parseThaiReceiptText(raw)).toEqual([
      { name: "Green curry", qty: 1, price: 85.5 },
    ]);
  });

  it("skips header, table, totals from realistic OCR blob", () => {
    const raw = `
ร้าน ทดสอบ
Tel 02-999-8888
Receipt No. 123
12/04/2025 18:30
Table B4
----------
2 Coke 60.00
ยอดรวม 60.00
ขอบคุณค่ะ
    `.trim();

    expect(parseThaiReceiptText(raw)).toEqual([{ name: "Coke", qty: 2, price: 60 }]);
  });

  it("maps to ParsedLineItem for Firestore", () => {
    const parsed = parseThaiReceiptText("1 Test 10.00");
    expect(receiptItemsToParsedLineItems(parsed)).toEqual([
      { name: "Test", qty: 1, price: 10 },
    ]);
  });
});
