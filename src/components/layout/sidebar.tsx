"use client";

import Link from "next/link";
import Image from "next/image";
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
  Menu,
  LogOut,
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  Wallet,
  Lightbulb,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand({ size = "lg" }: { size?: "lg" | "sm" }) {
  const dimensions = size === "lg" ? 44 : 32;
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-600/20 blur-md" />
        <div className="relative rounded-xl bg-white dark:bg-zinc-900 ring-1 ring-emerald-500/20 shadow-sm p-1.5">
          <Image
            src="/logo.png"
            alt="The Financial Flows"
            width={dimensions}
            height={dimensions}
            priority
            unoptimized
            className="h-8 w-8 md:h-9 md:w-9 object-contain"
          />
        </div>
      </div>
      <div className="min-w-0">
        <h1
          className={cn(
            "font-serif font-semibold leading-tight tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent",
            size === "lg" ? "text-xl" : "text-base"
          )}
        >
          The Financial Flows
        </h1>
        {size === "lg" && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 mt-0.5">
            Personal Finance
          </p>
        )}
      </div>
    </div>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-card via-card to-emerald-50/30 dark:to-emerald-950/10">
      <div className="px-5 pt-6 pb-5 border-b border-border/60">
        <Brand size="lg" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-600" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  isActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-border/60">
        <div className="flex items-center gap-3">
          {isMockMode ? (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold ring-2 ring-emerald-500/20">
              {user?.firstName?.charAt(0) || "?"}
            </div>
          ) : (
            <ClerkUserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: { avatarBox: "w-9 h-9" },
              }}
            />
          )}
          <div className="text-sm flex-1 min-w-0">
            <p className="font-medium truncate">
              {isMockMode ? user?.fullName || "User" : "Account"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {isMockMode
                ? user?.primaryEmailAddress?.emailAddress || ""
                : "Manage profile"}
            </p>
          </div>
          {isMockMode && (
            <button
              onClick={() => (window.location.href = "/sign-in")}
              className="text-muted-foreground hover:text-foreground transition-colors"
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
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r border-border/60 shadow-sm">
        <NavContent />
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-b border-border/60 px-4 py-3 flex items-center justify-between">
        <Brand size="sm" />
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border/60">
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
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] transition-colors",
              isActive ? "text-emerald-600" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
