import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/session";

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();

  if (session) {
    redirect("/admin/workspaces");
  }

  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">EzChat Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your admin account</p>
        </div>

        <div className="rounded-lg border border-muted bg-background p-8 shadow-sm">
          <LoginForm redirectTo={params.redirectTo} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Secure admin access powered by EzChat
        </p>
      </div>
    </div>
  );
}
