import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rpID, rpName, webauthnConfigured, b64UrlToBuf } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "applock_reg_challenge";

/**
 * Step 1 of WebAuthn registration: generate options for the browser's
 * navigator.credentials.create() call. Stores the challenge in a short-
 * lived httpOnly cookie so step 2 can verify it.
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

    const existing = await db.biometricCredential.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email ?? user.id,
      userID: new TextEncoder().encode(user.id),
      attestationType: "none",
      authenticatorSelection: {
        // Require a platform authenticator (Face ID / Touch ID / Windows
        // Hello) so users can't accidentally enroll a roaming key.
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      // Exclude credentials the user has already registered so the
      // browser doesn't prompt to overwrite the same device.
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    });

    const c = await cookies();
    c.set(CHALLENGE_COOKIE, options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 5, // 5 minutes to complete the ceremony
      path: "/api/biometric",
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error("WebAuthn register-options error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export { b64UrlToBuf };
