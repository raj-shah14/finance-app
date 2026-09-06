import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background py-10 px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-primary/25 blur-xl" />
          <div className="relative rounded-2xl bg-card ring-1 ring-primary/30 shadow-lg p-3">
            <Image src="/logo.svg" alt="The Financial Flows" width={72} height={72} priority unoptimized className="h-16 w-16 object-contain" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            The Financial Flows
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Personal Finance
          </p>
        </div>
      </div>
      <SignIn />
    </div>
  );
}
