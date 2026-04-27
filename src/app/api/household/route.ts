import { NextResponse } from "next/server";
import { mockHouseholdData, setMockHouseholdData } from "@/lib/mock-data";

function getMockUserFromCookie(cookieHeader: string | null): { id: string; name: string; email: string } {
  const isMockHemisha = cookieHeader?.includes("mock_user=hemisha");
  if (isMockHemisha) {
    return { id: "2", name: "Hemisha Shah", email: "hemisha@example.com" };
  }
  return { id: "1", name: "Raj Shah", email: "raj@example.com" };
}

// GET: Fetch household info + members
export async function GET(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      if (!mockHouseholdData) {
        return NextResponse.json({ household: null });
      }
      return NextResponse.json({ household: mockHouseholdData });
    }

    const { requireUser } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    const user = await requireUser();

    if (!user.householdId) {
      return NextResponse.json({ household: null });
    }

    const household = await db.household.findUnique({
      where: { id: user.householdId },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!household) {
      return NextResponse.json({ household: null });
    }

    return NextResponse.json({
      household: {
        id: household.id,
        name: household.name,
        createdAt: household.createdAt,
        members: household.users.map((m) => ({
          id: m.id,
          name: `${m.firstName} ${m.lastName}`.trim(),
          email: m.email,
          role: m.role || "member",
          joinedAt: m.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching household:", error);
    return NextResponse.json({ error: "Failed to fetch household" }, { status: 500 });
  }
}

// POST: Create a new household
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Household name is required" }, { status: 400 });
    }

    if (process.env.USE_MOCK_DATA === "true") {
      const cookieHeader = req.headers.get("cookie");
      const mockUser = getMockUserFromCookie(cookieHeader);

      if (mockHouseholdData) {
        // Check if user is already in a household
        const isMember = mockHouseholdData.members.some((m) => m.id === mockUser.id);
        if (isMember) {
          return NextResponse.json({ error: "You are already in a household" }, { status: 400 });
        }
      }

      const newHousehold = {
        id: `hh_${Date.now()}`,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        members: [
          {
            id: mockUser.id,
            name: mockUser.name,
            email: mockUser.email,
            role: "owner" as const,
            joinedAt: new Date().toISOString(),
          },
        ],
      };
      setMockHouseholdData(newHousehold);
      return NextResponse.json({ household: newHousehold });
    }

    const { requireUser } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    const user = await requireUser();

    if (user.householdId) {
      return NextResponse.json({ error: "You are already in a household" }, { status: 400 });
    }

    const household = await db.household.create({
      data: { name: name.trim() },
    });

    await db.user.update({
      where: { id: user.id },
      data: { householdId: household.id, role: "owner" },
    });

    return NextResponse.json({
      household: {
        id: household.id,
        name: household.name,
        createdAt: household.createdAt,
        members: [
          {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            role: "owner",
            joinedAt: new Date().toISOString(),
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error creating household:", error);
    return NextResponse.json({ error: "Failed to create household" }, { status: 500 });
  }
}

// DELETE: Remove a member from household
export async function DELETE(req: Request) {
  try {
    const { memberId } = await req.json();
    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
    }

    if (process.env.USE_MOCK_DATA === "true") {
      if (!mockHouseholdData) {
        return NextResponse.json({ error: "No household found" }, { status: 404 });
      }

      const cookieHeader = req.headers.get("cookie");
      const mockUser = getMockUserFromCookie(cookieHeader);

      // Only owner can remove members
      const requester = mockHouseholdData.members.find((m) => m.id === mockUser.id);
      if (!requester || requester.role !== "owner") {
        return NextResponse.json({ error: "Only the household owner can remove members" }, { status: 403 });
      }

      // Can't remove yourself as owner
      if (memberId === mockUser.id) {
        return NextResponse.json({ error: "Owner cannot remove themselves. Delete the household instead." }, { status: 400 });
      }

      const memberExists = mockHouseholdData.members.some((m) => m.id === memberId);
      if (!memberExists) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }

      mockHouseholdData.members = mockHouseholdData.members.filter((m) => m.id !== memberId);
      return NextResponse.json({ success: true, household: mockHouseholdData });
    }

    const { requireUser } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    const user = await requireUser();

    if (!user.householdId) {
      return NextResponse.json({ error: "No household found" }, { status: 404 });
    }

    // Only owner can remove members
    if (user.role !== "owner") {
      return NextResponse.json({ error: "Only the household owner can remove members" }, { status: 403 });
    }

    if (memberId === user.id) {
      return NextResponse.json({ error: "Owner cannot remove themselves" }, { status: 400 });
    }

    // Remove member from household
    await db.user.update({
      where: { id: memberId, householdId: user.householdId },
      data: { householdId: null, role: "member" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
