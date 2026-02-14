import { NextResponse } from "next/server";
import { mockInvitesData } from "@/lib/mock-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (process.env.USE_MOCK_DATA === "true") {
    // In mock mode, any code with "inv_" prefix is valid
    const invite = mockInvitesData.invites.find((i) => i.id === code);
    if (invite) {
      return NextResponse.json({
        id: invite.id,
        email: invite.email,
        householdName: "Raj's Household",
        invitedBy: `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`,
        status: invite.status,
      });
    }

    // Accept any "mock-xxx" code as a pending invite for demo
    if (code.startsWith("mock-")) {
      return NextResponse.json({
        id: code,
        email: "hemisha@example.com",
        householdName: "Raj's Household",
        invitedBy: "Raj Shah",
        status: "pending",
      });
    }

    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // Real mode: look up invite by ID
  try {
    const { db } = await import("@/lib/db");
    const invite = await db.householdInvite.findUnique({
      where: { id: code },
      include: {
        invitedBy: { select: { firstName: true, lastName: true } },
        household: { select: { name: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      householdName: invite.household.name,
      invitedBy: `${invite.invitedBy.firstName} ${invite.invitedBy.lastName}`,
      status: invite.status,
    });
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}
