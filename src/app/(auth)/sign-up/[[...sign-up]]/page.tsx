import { SignUp } from "@clerk/nextjs";
import Image from "next/image";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background py-10">
      <div className="flex flex-col items-center gap-3">
        <Image src="/logo.png" alt="The Financial Flows" width={64} height={64} priority />
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
          The Financial Flows
        </h1>
      </div>
      <SignUp />
    </div>
  );
}
