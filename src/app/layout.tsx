import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
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
        <TooltipProvider>
          {children}
        </TooltipProvider>
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
