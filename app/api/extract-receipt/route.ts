import { NextResponse } from "next/server";
import {
  RECEIPT_EXTRACTION_JSON_SCHEMA,
  RECEIPT_VISION_INSTRUCTIONS,
} from "@/lib/receipt-extraction-schema";
import {
  mapExtractionToParsedLineItems,
  type RawReceiptExtraction,
} from "@/lib/map-extraction-to-parsed-items";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

/** Map OpenAI error JSON to short messages for the client (page adds “photo saved” copy). */
function openAiErrorResponse(raw: string) {
  let detail = raw.slice(0, 500);
  let code: string | undefined;
  try {
    const j = JSON.parse(raw) as {
      error?: { message?: string; code?: string; type?: string };
    };
    if (j.error?.message) detail = j.error.message;
    code = j.error?.code ?? j.error?.type;
  } catch {
    /* keep detail slice */
  }

  const lower = detail.toLowerCase();
  if (
    code === "insufficient_quota" ||
    lower.includes("exceeded your current quota") ||
    lower.includes("insufficient_quota")
  ) {
    return {
      error: "OpenAI quota or billing.",
      detail:
        "This API key has no credits or billing enabled. Open platform.openai.com → Settings → Billing (or Usage), add a payment method or credits, then try again.",
    };
  }
  if (
    code === "rate_limit_exceeded" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return {
      error: "OpenAI rate limit.",
      detail: "Wait a short time and upload the receipt again.",
    };
  }
  return { error: "Receipt extraction failed.", detail };
}

function extractAssistantJsonText(data: unknown): string | null {
  const r = data as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    output_text?: string;
  };
  if (typeof r.output_text === "string" && r.output_text.trim()) {
    return r.output_text.trim();
  }
  if (!Array.isArray(r.output)) return null;
  for (const item of r.output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (c.type === "output_text" && typeof c.text === "string" && c.text.trim()) {
        return c.text.trim();
      }
    }
  }
  return null;
}

/**
 * Validate the Firebase ID token for *this* project using Identity Toolkit.
 * Avoids oauth2/v3/tokeninfo: Firebase tokens often have aud = OAuth client id,
 * not NEXT_PUBLIC_FIREBASE_PROJECT_ID, so tokeninfo falsely rejects them.
 */
async function verifyFirebaseIdToken(idToken: string): Promise<boolean> {
  const webApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!webApiKey?.trim()) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { users?: unknown[] };
    return Array.isArray(data.users) && data.users.length > 0;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error: "OpenAI is not configured.",
        detail:
          "Add OPENAI_API_KEY to .env.local in the project root, then restart `npm run dev`.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const idToken = String(form.get("idToken") ?? "");
  if (!idToken || !(await verifyFirebaseIdToken(idToken))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const file = form.get("image");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image too large (max 15 MB)." },
      { status: 400 },
    );
  }

  const mime =
    file.type && file.type.startsWith("image/")
      ? file.type
      : "image/jpeg";
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const dataUrl = `data:${mime};base64,${base64}`;

  // gpt-5.4 is stronger on dense receipt / Thai OCR than gpt-4o.
  const model = process.env.OPENAI_RECEIPT_MODEL?.trim() || "gpt-5.4";
  // Prefer original pixels for small print; fall back to high if env forces it.
  const detailRaw = process.env.OPENAI_RECEIPT_IMAGE_DETAIL?.trim() || "original";
  const detail =
    detailRaw === "low" || detailRaw === "high" || detailRaw === "auto"
      ? detailRaw
      : "original";

  const body = {
    model,
    input: [
      {
        role: "user" as const,
        content: [
          { type: "input_text" as const, text: RECEIPT_VISION_INSTRUCTIONS },
          {
            type: "input_image" as const,
            image_url: dataUrl,
            detail,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema" as const,
        name: "receipt_extraction",
        strict: true,
        schema: RECEIPT_EXTRACTION_JSON_SCHEMA,
      },
    },
  };

  const ores = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await ores.text();
  if (!ores.ok) {
    const { error, detail } = openAiErrorResponse(raw);
    return NextResponse.json({ error, detail }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid response from extraction service." },
      { status: 502 },
    );
  }

  const jsonText = extractAssistantJsonText(parsed);
  if (!jsonText) {
    return NextResponse.json(
      { error: "No structured output in model response." },
      { status: 502 },
    );
  }

  let extraction: RawReceiptExtraction;
  try {
    extraction = JSON.parse(jsonText) as RawReceiptExtraction;
  } catch {
    return NextResponse.json(
      { error: "Model returned invalid JSON." },
      { status: 502 },
    );
  }

  const items = mapExtractionToParsedLineItems(extraction);

  return NextResponse.json({
    items,
    merchant_name: extraction.merchant_name ?? "",
    subtotal: Number(extraction.subtotal) || 0,
    service_charge: Number(extraction.service_charge) || 0,
    vat: Number(extraction.vat) || 0,
    total: Number(extraction.total) || 0,
  });
}
