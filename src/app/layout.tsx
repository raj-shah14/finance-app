import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

// Prevent static prerendering which fails without runtime Clerk keys
export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The Financial Flows 💰 — Personal Finance Tracker",
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
