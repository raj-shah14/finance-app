import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background py-10 px-4">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-2xl" />
          <div className="relative rounded-3xl bg-card ring-1 ring-primary/30 shadow-lg p-4">
            <Image src="/logo.svg" alt="The Financial Flows" width={80} height={80} priority unoptimized className="h-20 w-20 object-contain" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
            The Financial Flows
          </h1>
          <p className="mt-1.5 text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Personal Finance
          </p>
        </div>
      </div>
      <SignUp
        appearance={{
          elements: {
            // We already show our own brand header above — Clerk's default
            // logo here just duplicates it.
            logoBox: "hidden",
            // Clerk's OTP/2FA digit boxes don't reliably pick up colorText
            // in dark mode, leaving the typed digits invisible.
            otpCodeFieldInput: "text-foreground",
          },
          variables: {
            colorPrimary: "var(--primary)",
            colorBackground: "var(--card)",
            colorInputBackground: "var(--input)",
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
