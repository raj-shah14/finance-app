import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mockInvitesData, mockHouseholdData } from "@/lib/mock-data";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (process.env.USE_MOCK_DATA === "true") {
    // Update invite status in mock data
    const invite = mockInvitesData.invites.find((i) => i.id === code);
    if (invite) {
      invite.status = "accepted";
    } else if (code.startsWith("mock-")) {
      mockInvitesData.invites.push({
        id: code,
        email: "hemisha@example.com",
        status: "accepted",
        createdAt: new Date().toISOString(),
        invitedBy: { firstName: "Raj", lastName: "Shah" },
      });
    }

    // Add Hemisha to household members if not already there
    if (mockHouseholdData) {
      const alreadyMember = mockHouseholdData.members.some((m) => m.id === "2");
      if (!alreadyMember) {
        mockHouseholdData.members.push({
          id: "2",
          name: "Hemisha Shah",
          email: "hemisha@example.com",
          role: "member",
          joinedAt: new Date().toISOString(),
        });
      }
    }

    // Set a cookie to identify as Hemisha for this session
    const cookieStore = await cookies();
    cookieStore.set("mock_user", "hemisha", {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false,
    });

    return NextResponse.json({ success: true, user: "hemisha" });
  }

  // Real mode: accept invite and join household
  try {
    const { db } = await import("@/lib/db");
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
    }

    const invite = await db.householdInvite.findUnique({
      where: { id: code },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status === "accepted") {
      return NextResponse.json({ error: "Invite already accepted" }, { status: 400 });
    }

    // Update invite status
    await db.householdInvite.update({
      where: { id: code },
      data: { status: "accepted" },
    });

    // Add user to household
    await db.user.update({
      where: { clerkId: userId },
      data: {
        householdId: invite.householdId,
        role: "member",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
