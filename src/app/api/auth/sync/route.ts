import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// One-time sync: creates the current Clerk user in the database if they don't exist
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { clerkId: userId } });
    if (existing) {
      return NextResponse.json({ message: "User already synced", user: existing });
    }

    // Fetch user details from Clerk
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Could not fetch user from Clerk" }, { status: 500 });
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";

    // Create household + user
    const household = await db.household.create({
      data: { name: `${clerkUser.firstName || "My"}'s Household` },
    });

    const user = await db.user.create({
      data: {
        clerkId: userId,
        email,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        imageUrl: clerkUser.imageUrl || null,
        role: "owner",
        householdId: household.id,
      },
    });

    return NextResponse.json({ message: "User synced", user });
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
