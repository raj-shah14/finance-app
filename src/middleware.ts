import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  // In mock mode, skip all auth
  if (process.env.USE_MOCK_DATA === "true") {
    return NextResponse.next();
  }

  // In production, use Clerk middleware
  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");

  const isPublicRoute = createRouteMatcher([
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/invite(.*)",
    "/api/webhooks(.*)",
    "/api/invites(.*)",
  ]);

  return clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  })(request, {} as any);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
