/**
 * JSON Schema for OpenAI structured outputs (strict mode).
 * All object properties must appear in `required`.
 */

export const RECEIPT_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    merchant_name: {
      type: "string",
      description: "Business name on the receipt, or empty string if unreadable.",
    },
    items: {
      type: "array",
      description:
        "Every purchasable line item on the receipt. Exclude subtotal, tax, service charge, tips, discounts-only, and grand total rows.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Item name exactly as printed. Keep Thai, English, mixed script, numbers, slashes, and parentheses.",
          },
          qty: {
            type: "integer",
            description:
              "Quantity for this line (minimum 1). If qty is not printed, use 1.",
            minimum: 1,
          },
          price: {
            type: "number",
            description:
              "LINE TOTAL for this row in the receipt currency (the amount charged for that line). Not unit price unless qty is 1.",
          },
          notes: {
            type: "array",
            items: { type: "string" },
            description:
              "Modifiers or indented sub-lines under this item (e.g. ไม่เอาน้ำแข็ง). Empty array if none.",
          },
        },
        required: ["name", "qty", "price", "notes"],
        additionalProperties: false,
      },
    },
    subtotal: {
      type: "number",
      description: "Subtotal before tax/service if visible, else 0.",
    },
    service_charge: {
      type: "number",
      description: "Service charge if shown separately, else 0.",
    },
    vat: {
      type: "number",
      description: "VAT/tax amount if shown, else 0.",
    },
    total: {
      type: "number",
      description: "Grand total if visible, else 0.",
    },
  },
  required: [
    "merchant_name",
    "items",
    "subtotal",
    "service_charge",
    "vat",
    "total",
  ],
  additionalProperties: false,
} as const;

export const RECEIPT_VISION_INSTRUCTIONS = `You extract structured data from a restaurant / cafe / shop receipt photo.
This is vision reading (not a separate OCR engine). Read every visible line carefully.

Language: Thai-only, English-only, and mixed Thai/English are all common. Preserve Thai characters exactly.

What to extract into items[]:
- Include every purchasable food/drink/product line with a price.
- Include combo / set lines and add-on lines that have their own price.
- Put free modifiers under the parent item's notes[] (not as separate $0 noise items unless they have a price).

What to EXCLUDE from items[]:
- Headers, table numbers, order numbers, timestamps, cashier names
- Subtotal / ส่วนลด / service charge / VAT / tax / tip / grand total / change / payment method
- "Thank you" / promotional footer lines

Prices & qty:
- price = LINE TOTAL for that row (what the guest pays for that line).
- If the receipt shows unit price × qty, set qty correctly and price = line total.
- Strip currency symbols (฿, THB, Baht). Use numbers only.
- Thai receipts often use commas as thousands separators (e.g. 1,250.00).

Completeness:
- Prefer extracting a line when it clearly has a name and an amount.
- Do not invent items that are not on the receipt.
- Scan top-to-bottom; do not stop after the first few items.

merchant_name: shop/restaurant name near the top, or "" if unreadable.
subtotal, service_charge, vat, total: numbers from the footer if present, else 0.

Return JSON that matches the schema exactly.`;
