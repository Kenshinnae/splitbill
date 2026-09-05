import { afterEach, describe, expect, it, vi } from "vitest";
import { CONFIG_LOAD_ERROR, CONFIG_TIMEOUT_MS, loadFirebaseConfig } from "./load-firebase-config";
import { firebaseConfigBootstrapScript } from "./firebase-bootstrap-script";

const config = { apiKey: "test-key", projectId: "test-project" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
function setup() {
  vi.stubGlobal("window", {});
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "");
}
describe("startup recovery", () => {
  it("does not block HTML parsing with a synchronous config request", () => {
    expect(firebaseConfigBootstrapScript()).toBe("");
    expect(firebaseConfigBootstrapScript(JSON.stringify(config))).toContain("window.__FIREBASE_CONFIG__=");
  });
  it("falls back to runtime config when Hostinger has no static JSON", async () => {
    setup();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("missing", { status: 404 })).mockResolvedValueOnce(Response.json(config));
    vi.stubGlobal("fetch", fetcher);
    expect(await loadFirebaseConfig()).toEqual(config);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/firebase-config.json", "/api/public-config"]);
    expect(window.__FIREBASE_CONFIG__).toEqual(config);
  });
  it("bounds a stalled response body, aborts it and uses the fallback", async () => {
    setup(); vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) }).mockResolvedValueOnce(Response.json(config));
    vi.stubGlobal("fetch", fetcher);
    const pending = loadFirebaseConfig();
    await vi.advanceTimersByTimeAsync(CONFIG_TIMEOUT_MS);
    expect(await pending).toEqual(config);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("finishes with a retryable error if both endpoints stall, then succeeds on retry", async () => {
    setup(); vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const result = expect(loadFirebaseConfig()).rejects.toThrow(CONFIG_LOAD_ERROR);
    await vi.advanceTimersByTimeAsync(CONFIG_TIMEOUT_MS * 2);
    await result;
    fetcher.mockResolvedValue(Response.json(config));
    expect(await loadFirebaseConfig()).toEqual(config);
  });
});
