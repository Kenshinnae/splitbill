import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
it("refreshes document HTML while preserving bill query params and leaving uploads/API/assets untouched", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const fetcher = vi.fn().mockResolvedValue(new Response("page"));
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { location: { origin: "https://example.com" }, addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; } },
    URL, Request, fetch: fetcher,
  });
  const respondWith = vi.fn();
  handlers.fetch({ request: { url: "https://example.com/bills/new?billId=abc", method: "GET", mode: "navigate", headers: new Headers() }, respondWith });
  await respondWith.mock.calls[0][0];
  const request = fetcher.mock.calls[0][0] as Request;
  expect(new URL(request.url).searchParams.get("billId")).toBe("abc");
  expect(new URL(request.url).searchParams.has("__sb_release")).toBe(true);
  expect(request.cache).toBe("no-store");
  for (const [url, method, mode] of [["/api/extract-receipt", "POST", "cors"], ["/dashboard?_rsc=123", "GET", "cors"], ["/_next/static/chunk.js", "GET", "no-cors"]]) {
    handlers.fetch({ request: { url: `https://example.com${url}`, method, mode }, respondWith });
  }
  expect(respondWith).toHaveBeenCalledTimes(1);
});
