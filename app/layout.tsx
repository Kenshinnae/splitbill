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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fromFile = readFirebasePublicConfigFromFile();
  const fromEnv = readFirebasePublicConfigFromEnv();
  const embedded =
    fromFile ??
    (isFirebasePublicConfigReady(fromEnv) ? fromEnv : null);
  const embeddedJson = embedded
    ? JSON.stringify(embedded).replace(/</g, "\\u003c")
    : undefined;

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: firebaseConfigBootstrapScript(embeddedJson),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <FirebaseConfigGate>{children}</FirebaseConfigGate>
      </body>
    </html>
  );
}
