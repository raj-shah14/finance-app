import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check endpoint for App Service / load balancers.
 *
 * - GET /api/health           Liveness: app is running and can serve requests.
 * - GET /api/health?deep=1    Readiness: also pings the database.
 *
 * Returns 200 when healthy, 503 when not. Keep the response body small so
 * health probes stay cheap.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";

  if (!deep) {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { status: "error", db: "down", error: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  }
}
