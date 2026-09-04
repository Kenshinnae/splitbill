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
        "Line items only; exclude subtotal, tax, service charge, tips, totals.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Item name as printed. Preserve Thai, English, mixed, slashes, parentheses.",
          },
          qty: {
            type: "integer",
            description: "Quantity for this line (minimum 1).",
            minimum: 1,
          },
          price: {
            type: "number",
            description:
              "Line total amount for this row (not unit price unless line shows one unit).",
          },
          notes: {
            type: "array",
            items: { type: "string" },
            description: "Modifiers or sub-lines, e.g. no ice; empty array if none.",
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

export const RECEIPT_VISION_INSTRUCTIONS = `You are a receipt digitization assistant. Read the receipt image carefully.
Support Thai-only, English-only, and mixed Thai/English text.

Rules:
- Extract ONLY purchasable line items. Do NOT put subtotal, service charge, VAT, discount-only lines, or grand total into items[].
- For each item: name as printed; qty is the quantity for that line (at least 1); price is the LINE TOTAL for that row (the amount charged for that line on the receipt).
- If the receipt shows unit price × quantity, compute or take the line total as price.
- notes[]: short modifiers (e.g. "no ice", "large size") tied to that line; use [] if none.
- merchant_name: store or restaurant name, or "" if missing.
- subtotal, service_charge, vat, total: numeric values from the receipt; use 0 if not shown or unreadable.
- Output must follow the JSON schema exactly. Be conservative: if unsure about a line, omit it from items rather than guessing.`;
