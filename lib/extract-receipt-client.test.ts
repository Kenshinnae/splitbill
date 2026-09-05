import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { extractReceiptViaOpenAI } from "./extract-receipt-client";

const file = new File(["photo"], "receipt.jpg", { type: "image/jpeg" });
const result = { items: [{ name: "น้ำ", price: 20 }], merchant_name: "ร้าน" };
const user = () => ({ getIdToken: vi.fn().mockResolvedValue("token") });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("receipt requests from a resumed PWA", () => {
  it("refreshes an expired token once and rebuilds the multipart request", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 401 })).mockResolvedValueOnce(Response.json(result));
    vi.stubGlobal("fetch", fetcher);
    const u = user();
    expect((await extractReceiptViaOpenAI(file, u as unknown as User)).items).toEqual(result.items);
    expect(u.getIdToken.mock.calls).toEqual([[false], [true]]);
    const request = fetcher.mock.calls[1][1];
    expect(request.body.get("image").name).toBe("receipt.jpg");
    expect(request.body.get("idToken")).toBe("token");
    expect(request.cache).toBe("no-store");
  });
  it("does not retry an uncertain server error and handles host HTML errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(extractReceiptViaOpenAI(file, user() as unknown as User)).rejects.toThrow("Receipt service is unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects offline attempts before requesting a token or paid extraction", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const u = user();
    await expect(extractReceiptViaOpenAI(file, u as unknown as User)).rejects.toThrow("offline");
    expect(u.getIdToken).not.toHaveBeenCalled();
  });
  it("stops a hung request with an actionable timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const pending = expect(extractReceiptViaOpenAI(file, user() as unknown as User)).rejects.toThrow("Reading took too long");
    await vi.advanceTimersByTimeAsync(115_000);
    await pending;
  });
});
