import { splitBillIconResponse } from "@/lib/pwa-icon";

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size } = await context.params;
  const px = size === "512" ? 512 : 192;
  return splitBillIconResponse(px);
}
