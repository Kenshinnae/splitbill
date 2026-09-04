import { NextResponse } from "next/server";
import { resolveFirebasePublicConfigForServer } from "@/lib/firebase-server-config";

/** Runtime Firebase client config (public values only). */
export async function GET() {
  const config = resolveFirebasePublicConfigForServer();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "Firebase not configured. Add public/firebase-config.json (via npm run zip:hostinger) or NEXT_PUBLIC_FIREBASE_* env vars.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json(config);
}
