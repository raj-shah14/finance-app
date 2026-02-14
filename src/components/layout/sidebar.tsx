"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useUser } from "@/lib/hooks";

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// Lazy-load Clerk's UserButton so it's never imported in mock mode
const ClerkUserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false, loading: () => <div className="w-8 h-8 rounded-full bg-muted animate-pulse" /> }
);

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  PiggyBank,
  Lightbulb,
  Settings,
  Menu,
  LogOut,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, emoji: "📊" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, emoji: "💳" },
  { href: "/accounts", label: "Accounts", icon: Landmark, emoji: "🏦" },
  { href: "/budgets", label: "Budgets", icon: PiggyBank, emoji: "💰" },
  { href: "/insights", label: "Insights", icon: Lightbulb, emoji: "💡" },
  { href: "/settings", label: "Settings", icon: Settings, emoji: "⚙️" },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
          💰 FinanceFlow
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Personal Finance Tracker</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="text-lg">{item.emoji}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          {isMockMode ? (
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
              {user?.firstName?.charAt(0) || "?"}
            </div>
          ) : (
            <ClerkUserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: { avatarBox: "w-8 h-8" },
              }}
            />
          )}
          <div className="text-sm flex-1">
            <p className="font-medium">{isMockMode ? (user?.fullName || "User") : "Account"}</p>
            <p className="text-xs text-muted-foreground">{isMockMode ? (user?.primaryEmailAddress?.emailAddress || "") : "Manage profile"}</p>
          </div>
          {isMockMode && (
            <button
              onClick={() => window.location.href = "/sign-in"}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r">
        <NavContent />
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
          💰 FinanceFlow
        </h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <NavContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t">
        <MobileBottomNav />
      </nav>
    </>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const bottomNavItems = navItems.slice(0, 5); // exclude settings

  return (
    <div className="flex justify-around py-2">
      {bottomNavItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors",
              isActive ? "text-emerald-600" : "text-muted-foreground"
            )}
          >
            <span className="text-xl">{item.emoji}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
