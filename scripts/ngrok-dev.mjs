/**
 * Dev tunnel to local Next.js (default port 3000).
 * Set NGROK_AUTHTOKEN in .env.local (https://dashboard.ngrok.com/get-started/your-authtoken).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ngrok from "@ngrok/ngrok";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const port = Number(process.env.NGROK_PORT || process.env.PORT || 3000) || 3000;
const token = process.env.NGROK_AUTHTOKEN?.trim();

async function waitForDevServer(maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok || res.status === 307 || res.status === 308) return true;
    } catch {
      /* dev still starting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

if (!token) {
  console.error(`
Missing NGROK_AUTHTOKEN.

1. Sign up / log in at https://dashboard.ngrok.com
2. Copy your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
3. Add to .env.local:

   NGROK_AUTHTOKEN=your_token_here

4. Run: npm run ngrok
`);
  process.exit(1);
}

const devUp = await waitForDevServer(5_000);
if (!devUp) {
  console.error(`
⚠  Nothing is responding on http://127.0.0.1:${port}

ngrok only forwards traffic — it does NOT start Next.js.

1. In another terminal, run:  npm run dev
2. Wait until you see:       ✓ Ready  and  Local: http://localhost:${port}
3. Keep that terminal open (do not Ctrl+C)
4. Then run:                  npm run ngrok

If port ${port} is busy, stop old servers first:
  pkill -f "next dev"
`);
  process.exit(1);
}

const listener = await ngrok.forward({
  addr: port,
  authtoken: token,
});

const url = listener.url();
console.log("");
console.log("  ngrok tunnel →", url);
console.log("  forwarding   →", `http://127.0.0.1:${port}`);
console.log("");
console.log("  Keep this process running. Open the ngrok URL on your phone.");
console.log("");

function shutdown() {
  listener.close().finally(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Stay alive without stdin (background shells close stdin immediately).
setInterval(() => {}, 60_000);
