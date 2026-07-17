import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClaimForm } from "@/components/auth/claim-form";
import Link from "next/link";

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const worker = await db.worker.findUnique({
    where: { claimToken: token },
    select: { name: true, userId: true, claimTokenExpiresAt: true },
  });

  const invalid = !worker || worker.userId !== null || !worker.claimTokenExpiresAt || worker.claimTokenExpiresAt <= new Date();

  if (invalid) {
    return (
      <Card className="border-none shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Invite link invalid</CardTitle>
          <CardDescription>This link is invalid or has expired. Contact your administrator for a new one.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm">
          <Link href="/login" className="text-primary hover:underline font-medium">Back to login</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Set up your account</CardTitle>
        <CardDescription>Confirm your name and set a password to finish.</CardDescription>
      </CardHeader>
      <CardContent>
        <ClaimForm token={token} initialName={worker.name} />
      </CardContent>
    </Card>
  );
}
