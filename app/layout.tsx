import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/*
 * Three faces, three jobs. The scaffold's Geist is gone — it ships with every
 * Next.js project, which makes it a tell rather than a choice.
 */

/** Display only: hero and section titles. The width axis carries the signage feel. */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

/** Body copy and UI chrome. */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});

/** Every metric, service name, latency and status label. Used heavily. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const TITLE = "Glass Box — one box, every layer visible";
const DESCRIPTION =
  "Click a real control and watch a real backend react. Every number is measured, not mocked — copy the command under any panel and check it yourself.";

export const metadata: Metadata = {
  // Resolves the OG image and other relative URLs against the real origin, so a
  // shared link renders a card wherever it is pasted.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Glass Box",
  authors: [{ name: "walonCode" }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Glass Box",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/*
         * Sets the theme before first paint so there is no flash of the wrong
         * palette. Reads the saved choice, else the OS preference; defaults to
         * dark. Inline and synchronous on purpose — a deferred script would
         * paint dark first and swap.
         */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: this is a trusted, static string with no user input, and it must run before hydration.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
