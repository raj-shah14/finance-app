import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 sm:gap-10 bg-background py-6 sm:py-10 px-4">
      <div className="flex flex-col items-center gap-2 sm:gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-2xl" />
          <div className="relative rounded-3xl bg-card ring-1 ring-primary/30 shadow-lg p-3 sm:p-4">
            <Image src="/logo.svg" alt="Financial Flows" width={80} height={80} priority unoptimized className="h-12 w-12 sm:h-20 sm:w-20 object-contain" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="font-serif text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Financial Flows
          </h1>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Personal Finance
          </p>
        </div>
      </div>
      <SignIn
        appearance={{
          elements: {
            // We already show our own brand header above — Clerk's default
            // logo here just duplicates it.
            logoBox: "hidden",
          },
          variables: {
            colorPrimary: "var(--primary)",
            colorBackground: "var(--card)",
            // --input is a subtle, near-transparent border tint in dark
            // mode (not a solid fill), so using it as the input/OTP box
            // background left the default dark input text unreadable.
            // --muted is a solid, visibly dark surface instead.
            colorInputBackground: "var(--muted)",
            colorInputForeground: "var(--foreground)",
            colorText: "var(--foreground)",
            colorTextSecondary: "var(--muted-foreground)",
            colorNeutral: "var(--foreground)",
            borderRadius: "var(--radius)",
          },
        }}
      />
    </div>
  );
}
