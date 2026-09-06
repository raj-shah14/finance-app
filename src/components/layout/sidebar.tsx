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

// Lazy-loaded sign-out trigger that calls Clerk's signOut() directly.
// We render this as a visible button next to the UserButton so it works
// on mobile, where the UserButton's popover is unreliable inside the
// Sheet's modal overlay (clicks get swallowed by Radix's pointer-events
// trap and the Sheet auto-closes when the popover opens).
const ClerkSignOutButton = dynamic(
  () =>
    import("@clerk/nextjs").then((mod) => {
      const SignOut = ({
        className,
        title,
        children,
      }: {
        className?: string;
        title?: string;
        children: React.ReactNode;
      }) => {
        const { signOut } = mod.useClerk();
        return (
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className={className}
            title={title}
          >
            {children}
          </button>
        );
      };
      return SignOut;
    }),
  { ssr: false, loading: () => null }
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
  TrendingUp,
  TrendingDown,
  CreditCard,
  PiggyBank,
  Coins,
  LineChart,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/income", label: "Income", icon: TrendingUp },
  { href: "/expenses", label: "Expenses", icon: TrendingDown },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/savings", label: "Savings", icon: PiggyBank },
  { href: "/investments", label: "Investments", icon: Coins },
  { href: "/net-worth", label: "Net Worth", icon: LineChart },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand({ size = "lg" }: { size?: "lg" | "sm" }) {
  const dimensions = size === "lg" ? 44 : 32;
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl bg-primary/25 blur-md" />
        <div className="relative rounded-xl bg-card ring-1 ring-primary/30 shadow-sm p-1.5">
          <Image
            src="/logo.svg"
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
        {size === "lg" && (
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-primary/70">
            The
          </p>
        )}
        <h1
          className={cn(
            "font-serif font-semibold leading-tight tracking-tight text-foreground whitespace-nowrap",
            size === "lg" ? "text-lg" : "text-base"
          )}
        >
          Financial Flows
        </h1>
        {size === "lg" && (
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 whitespace-nowrap">
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
    <div className="flex flex-col h-full bg-card">
      <div className="px-5 pt-6 pb-5 border-b border-border/60 flex items-start justify-between gap-2">
        <Brand size="lg" />
        <ThemeToggle className="-mr-1.5" />
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
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  isActive
                    ? "text-accent-foreground"
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
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
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
          {isMockMode ? (
            <button
              onClick={() => (window.location.href = "/sign-in")}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <ClerkSignOutButton
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </ClerkSignOutButton>
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
        <div className="flex items-center gap-1">
        <ThemeToggle />
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
              isActive ? "text-primary" : "text-muted-foreground"
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
