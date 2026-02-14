import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  let user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { household: true },
  });

  // Auto-sync: if Clerk user exists but DB user doesn't, create it
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";
    const household = await db.household.create({
      data: { name: `${clerkUser.firstName || "My"}'s Household` },
    });

    user = await db.user.create({
      data: {
        clerkId: userId,
        email,
        firstName: clerkUser.firstName || null,
        lastName: clerkUser.lastName || null,
        imageUrl: clerkUser.imageUrl || null,
        role: "owner",
        householdId: household.id,
      },
      include: { household: true },
    });
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
