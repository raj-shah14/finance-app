import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rpID, origin, webauthnConfigured } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "applock_auth_challenge";

/**
 * Step 2 of WebAuthn authentication: verify the signed assertion.
 * On success, returns { success: true } and the App Lock overlay
 * unlocks the dashboard.
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
    const { response } = body ?? {};

    const c = await cookies();
    const expectedChallenge = c.get(CHALLENGE_COOKIE)?.value;
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "No authentication challenge in progress" },
        { status: 400 }
      );
    }

    const credentialId: string = response?.id;
    if (!credentialId) {
      return NextResponse.json({ error: "Missing credential id" }, { status: 400 });
    }

    const stored = await db.biometricCredential.findUnique({
      where: { credentialId },
    });
    if (!stored || stored.userId !== user.id) {
      return NextResponse.json({ error: "Unknown credential" }, { status: 404 });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: Buffer.from(stored.publicKey, "base64url"),
        counter: Number(stored.counter),
        transports: stored.transports as AuthenticatorTransport[] | undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    await db.biometricCredential.update({
      where: { id: stored.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    // Reset PIN failure counter on successful biometric unlock.
    await db.user.update({
      where: { id: user.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });

    c.delete(CHALLENGE_COOKIE);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WebAuthn assert-verify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
