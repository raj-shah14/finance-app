import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rpID, origin, webauthnConfigured } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "applock_reg_challenge";

/**
 * Step 2 of WebAuthn registration: verify the browser's
 * AuthenticatorAttestationResponse and persist the credential.
 *
 * Body: the raw response from navigator.credentials.create(), already
 * serialized via @simplewebauthn/browser's `startRegistration` helper,
 * plus an optional `deviceLabel` from the client (e.g. "iPhone 15").
 */
export async function POST(req: Request) {
  try {
    if (!webauthnConfigured()) {
      return NextResponse.json(
        { error: "WebAuthn is not configured on the server" },
        { status: 503 }
      );
    }
    const user = await requireUser();
    const body = await req.json();
    const { response, deviceLabel } = body ?? {};

    const c = await cookies();
    const expectedChallenge = c.get(CHALLENGE_COOKIE)?.value;
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "No registration challenge in progress" },
        { status: 400 }
      );
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Registration verification failed" },
        { status: 400 }
      );
    }

    const { credential } = verification.registrationInfo;
    const credentialID = credential.id;
    const credentialPublicKey = credential.publicKey;
    const counter = credential.counter;

    await db.biometricCredential.create({
      data: {
        credentialId: credentialID,
        publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
        counter: BigInt(counter),
        transports: response.response?.transports ?? [],
        deviceLabel: typeof deviceLabel === "string" ? deviceLabel : null,
        userId: user.id,
        lastUsedAt: new Date(),
      },
    });

    // Enabling App Lock for the first time also flips the user-level
    // toggle on so the gate starts rendering immediately.
    await db.user.update({
      where: { id: user.id },
      data: { appLockEnabled: true },
    });

    c.delete(CHALLENGE_COOKIE);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WebAuthn register-verify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
