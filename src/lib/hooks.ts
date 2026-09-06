"use client";

import { useUser as useClerkUser } from "@clerk/nextjs";

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

function getMockUserKey(): "raj" | "hemisha" {
  if (typeof document === "undefined") return "raj";
  const match = document.cookie.match(/mock_user=(\w+)/);
  return match?.[1] === "hemisha" ? "hemisha" : "raj";
}

const mockUsers = {
  raj: {
    id: "1",
    fullName: "Raj Shah",
    firstName: "Raj",
    lastName: "Shah",
    primaryEmailAddress: { emailAddress: "raj@example.com" },
    imageUrl: null,
  },
  hemisha: {
    id: "2",
    fullName: "Hemisha Shah",
    firstName: "Hemisha",
    lastName: "Shah",
    primaryEmailAddress: { emailAddress: "hemisha@example.com" },
    imageUrl: null,
  },
};

const nullUser = { user: null, isLoaded: false, isSignedIn: false };

export function useUser() {
  // isMockMode is a build-time constant (baked in from NEXT_PUBLIC_USE_MOCK_DATA),
  // so it never changes across renders for a given deployment — safe to branch on.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const clerkResult = isMockMode ? nullUser : useClerkUser();

  if (isMockMode) {
    const key = getMockUserKey();
    return { user: mockUsers[key], isLoaded: true, isSignedIn: true };
  }

  return clerkResult;
}
