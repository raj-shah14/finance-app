import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockInvitesData, mockHouseholdData } from "@/lib/mock-data";

function getMockUserFromCookie(cookieHeader: string | null): { id: string; firstName: string; lastName: string; email: string } {
  const isMockHemisha = cookieHeader?.includes("mock_user=hemisha");
  if (isMockHemisha) {
    return { id: "2", firstName: "Hemisha", lastName: "Shah", email: "hemisha@example.com" };
  }
  return { id: "1", firstName: "Raj", lastName: "Shah", email: "raj@example.com" };
}

export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json(mockInvitesData);
    }

    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ invites: [] });
    }

    const invites = await db.householdInvite.findMany({
      where: { householdId: user.householdId },
      include: {
        invitedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        status: inv.status,
        createdAt: inv.createdAt,
        invitedBy: inv.invitedBy,
      })),
    });
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const inviteCode = `mock-${Date.now()}`;

    if (process.env.USE_MOCK_DATA === "true") {
      if (!mockHouseholdData) {
        return NextResponse.json({ error: "Create a household first" }, { status: 400 });
      }

      // Use current user context
      const cookieHeader = req.headers.get("cookie");
      const mockUser = getMockUserFromCookie(cookieHeader);

      // Check duplicate invites
      const existing = mockInvitesData.invites.find(
        (i) => i.email === email && i.status === "pending"
      );
      if (existing) {
        return NextResponse.json({ error: "An invite is already pending for this email" }, { status: 400 });
      }

      mockInvitesData.invites.push({
        id: inviteCode,
        email,
        status: "pending",
        createdAt: new Date().toISOString(),
        invitedBy: { firstName: mockUser.firstName, lastName: mockUser.lastName },
      });

      const origin = new URL(req.url).origin;
      return NextResponse.json({
        success: true,
        invite: { id: inviteCode, email, status: "pending" },
        inviteLink: `${origin}/invite/${inviteCode}`,
      });
    }

    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json(
        { error: "No household found" },
        { status: 400 }
      );
    }

    const invite = await db.householdInvite.create({
      data: {
        email,
        householdId: user.householdId,
        invitedById: user.id,
        status: "pending",
      },
    });

    const origin = new URL(req.url).origin;
    return NextResponse.json({
      success: true,
      invite,
      inviteLink: `${origin}/invite/${invite.id}`,
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
