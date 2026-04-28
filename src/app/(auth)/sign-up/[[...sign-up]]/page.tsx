import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-background via-background to-emerald-50/40 dark:to-emerald-950/20 py-10 px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-teal-600/30 blur-xl" />
          <div className="relative rounded-2xl bg-white dark:bg-zinc-900 ring-1 ring-emerald-500/20 shadow-lg p-3">
            <Image src="/logo.png" alt="The Financial Flows" width={72} height={72} priority unoptimized className="h-16 w-16 object-contain" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
            The Financial Flows
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Personal Finance
          </p>
        </div>
      </div>
      <SignUp />
    </div>
  );
}
