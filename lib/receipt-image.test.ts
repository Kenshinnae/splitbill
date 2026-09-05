import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeReceiptImage } from "./receipt-image";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function webkitFallback(fail = false) {
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported")));
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receipt");
  vi.stubGlobal("Image", class {
    naturalWidth = 4000; naturalHeight = 3000;
    onload = () => {}; onerror = () => {};
    set src(value: string) { if (value) queueMicrotask(() => fail ? this.onerror() : this.onload()); }
  });
  const draw = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: "", fillRect: vi.fn(), drawImage: draw }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["jpeg"], { type: "image/jpeg" })) };
  vi.stubGlobal("document", { createElement: () => canvas });
  return { revoke, draw, canvas };
}
describe("iPhone library photo normalization", () => {
  it("uses HTMLImageElement when bitmap decoding fails, shrinks and releases memory", async () => {
    const { revoke, draw, canvas } = webkitFallback();
    const result = await normalizeReceiptImage(new File(["heic"], "IMG.HEIC", { type: "image/heic" }));
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("IMG.jpg");
    expect(draw.mock.calls[0].slice(1)).toEqual([0, 0, 2048, 1536]);
    expect(revoke).toHaveBeenCalledWith("blob:receipt");
    expect(canvas.width).toBe(0);
  });
  it("does not rename undecodable HEIC bytes as JPEG", async () => {
    const { revoke } = webkitFallback(true);
    await expect(normalizeReceiptImage(new File(["heic"], "IMG.HEIC", { type: "image/heic" }))).rejects.toThrow("For HEIC");
    expect(revoke).toHaveBeenCalled();
  });
  it("keeps a small supported image when canvas/decoding is unavailable", async () => {
    webkitFallback(true);
    const file = new File(["jpeg"], "image.jpg", { type: "image/jpeg" });
    expect(await normalizeReceiptImage(file)).toBe(file);
  });
});
