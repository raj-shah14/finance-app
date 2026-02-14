"use client";

import { useState, useEffect } from "react";

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

export function useUser() {
  if (isMockMode) {
    const key = getMockUserKey();
    return { user: mockUsers[key], isLoaded: true, isSignedIn: true };
  }

  // Dynamic require to avoid loading Clerk modules in mock mode
  // eslint-disable-next-line @typescript-eslint/no-require-imports, react-hooks/rules-of-hooks
  const { useUser: useClerkUser } = require("@clerk/nextjs");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkUser();
}
