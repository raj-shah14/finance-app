"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Users, Loader2 } from "lucide-react";

interface InviteDetails {
  id: string;
  email: string;
  householdName: string;
  invitedBy: string;
  status: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { isSignedIn, isLoaded } = useAuth();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invites/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvite(data);
          if (data.status === "accepted") setAccepted(true);
        }
      })
      .catch(() => setError("Failed to load invite"))
      .finally(() => setLoading(false));
  }, [code]);

  const handleAccept = async () => {
    // Redirect to sign-up if not logged in, with redirect back
    if (isLoaded && !isSignedIn) {
      router.push(`/sign-up?redirect_url=/invite/${code}`);
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${code}/accept`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAccepted(true);
        setTimeout(() => router.push("/"), 2000);
      } else {
        setError(data.error || "Failed to accept invite");
      }
    } catch {
      setError("Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-4xl mb-4">😕</p>
            <p className="text-lg font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              This invite link may be invalid or expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
            {accepted ? (
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            ) : (
              <Users className="h-8 w-8 text-emerald-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {accepted ? "You're in! 🎉" : "You're invited! 💌"}
          </CardTitle>
          <CardDescription>
            {accepted
              ? `You've joined ${invite?.householdName}. Redirecting to dashboard...`
              : `${invite?.invitedBy} has invited you to join their household on Financial Flow.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!accepted && (
            <>
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Household</span>
                  <span className="font-medium">🏠 {invite?.householdName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invited by</span>
                  <span className="font-medium">{invite?.invitedBy}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your email</span>
                  <span className="font-medium">{invite?.email}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                By joining, you'll be able to share selected expense categories with this household.
                Your personal finances stay private by default.
              </div>
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="lg"
              >
                {accepting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                {accepting ? "Joining..." : (isLoaded && !isSignedIn) ? "Sign Up & Join" : "Accept & Join Household"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
