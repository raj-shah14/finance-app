import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rpID, webauthnConfigured } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "applock_auth_challenge";

/**
 * Step 1 of WebAuthn authentication: generate assertion options.
 * Used by the App Lock overlay to re-verify the user via Face ID.
 */
export async function POST() {
  try {
    if (!webauthnConfigured()) {
      return NextResponse.json(
        { error: "WebAuthn is not configured on the server" },
        { status: 503 }
      );
    }
    const user = await requireUser();
    const creds = await db.biometricCredential.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });
    if (creds.length === 0) {
      return NextResponse.json(
        { error: "No biometric credentials registered" },
        { status: 404 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    });

    const c = await cookies();
    c.set(CHALLENGE_COOKIE, options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 5,
      path: "/api/biometric",
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error("WebAuthn assert-options error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
