import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

// Prevent static prerendering which fails without runtime Clerk keys
export const dynamic = "force-dynamic";

// Self-hosted (latin subset, variable weight) rather than next/font/google:
// that fetches Google's CSS at build time, and when Google changed the font
// URL format it returned, the Turbopack build failed ("next/font/google
// queries have exactly one entry") and took the deploy pipeline down with
// no code change on our side. Local files make the build offline and
// deterministic. See src/app/fonts/LICENSES.md.
const inter = localFont({
  src: "./fonts/Inter-latin-variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
});

const playfair = localFont({
  src: "./fonts/PlayfairDisplay-latin-variable.woff2",
  variable: "--font-playfair",
  weight: "400 900",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Financial Flows 💰 — Personal Finance Tracker",
  description: "Track expenses, budgets, and insights for your household",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Financial Flows",
  },
  other: {
    // Next only emits the modern, unprefixed "mobile-web-app-capable" for
    // appleWebApp.capable. Older iOS Safari versions only check this
    // legacy Apple-prefixed tag to open a home-screen icon in standalone
    // mode (no Safari chrome) instead of a plain bookmark tab — keep both.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  // Lets the installed PWA draw behind the home indicator/notch instead of
  // letterboxing — required for env(safe-area-inset-*) to report real
  // values so the fixed bottom nav can pad itself clear of it.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isMockMode = process.env.USE_MOCK_DATA === "true";

  const content = (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );

  if (isMockMode) {
    return content;
  }

  // Dynamically import ClerkProvider only when needed
  const { ClerkProvider } = await import("@clerk/nextjs");
  return <ClerkProvider>{content}</ClerkProvider>;
}
