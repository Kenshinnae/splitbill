import localFont from "next/font/local";
import { connection } from "next/server";
import { LanguageProvider, LanguageSwitch } from "@/components/LanguageProvider";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FirebaseConfigGate } from "@/components/FirebaseConfigGate";
import { PwaRegister } from "@/components/PwaRegister";
import { firebaseConfigBootstrapScript } from "@/lib/firebase-bootstrap-script";
import { readFirebasePublicConfigFromFile } from "@/lib/firebase-server-config";
import {
  isFirebasePublicConfigReady,
  readFirebasePublicConfigFromEnv,
} from "@/lib/firebase-public-config";

const thaiFont = localFont({ src: "../public/fonts/NotoSansThaiLooped.ttf", variable: "--font-thai", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "SplitBill — shared bill splitting",
  description:
    "Create a bill, share a link, and split items in real time with friends.",
  applicationName: "SplitBill",
  appleWebApp: {
    capable: true,
    title: "SplitBill",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Runtime config and document asset references must come from this deployment.
  // Prerendered HTML can outlive its hashed assets in a hosting/CDN cache.
  await connection();
  const fromFile = readFirebasePublicConfigFromFile();
  const fromEnv = readFirebasePublicConfigFromEnv();
  const embedded =
    fromFile ??
    (isFirebasePublicConfigReady(fromEnv) ? fromEnv : null);
  const embeddedJson = embedded
    ? JSON.stringify(embedded).replace(/</g, "\\u003c")
    : undefined;

  return (
    <html lang="th" className={`h-full antialiased ${thaiFont.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: firebaseConfigBootstrapScript(embeddedJson),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <LanguageProvider>
          <LanguageSwitch />
          <FirebaseConfigGate>{children}</FirebaseConfigGate>
        </LanguageProvider>
      </body>
    </html>
  );
}
