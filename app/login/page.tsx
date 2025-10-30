import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in | EzChat Admin",
};

type SearchParams = {
  redirectTo?: string;
};

function resolveRedirect(target?: string): string | undefined {
  if (!target) {
    return undefined;
  }

  try {
    const decoded = decodeURIComponent(target);
    return decoded.startsWith("/") ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const redirectTo = resolveRedirect(searchParams?.redirectTo);
  const session = await getSession({ refresh: false });

  if (session) {
    redirect(redirectTo ?? "/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-6 py-16 sm:px-10">
        <div className="grid w-full gap-12 sm:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden flex-col justify-center gap-6 rounded-2xl border border-muted bg-muted/40 p-8 sm:flex">
            <div className="space-y-4">
              <span className="rounded-full bg-accent px-4 py-1 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                EzChat Admin
              </span>
              <h1 className="text-3xl font-semibold text-foreground">
                Secure access to your operations command center
              </h1>
              <p className="text-sm text-muted-foreground">
                Log in with your EzChat administrator credentials to configure workspaces, manage data
                sources, and review sensitive activity. All actions are audited and monitored for security.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>• Single-admin access with secure session handling</li>
              <li>• All configuration changes tracked in real-time audit logs</li>
              <li>• Rate limiting and anomaly detection protect your account</li>
            </ul>
          </section>

          <section className="flex flex-col justify-center rounded-2xl border border-muted bg-background p-8 shadow-sm">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold text-foreground">Welcome back</h2>
              <p className="text-sm text-muted-foreground">
                Sign in to continue to the EzChat admin dashboard.
              </p>
            </div>
            <div className="mt-8">
              <LoginForm redirectTo={redirectTo} />
            </div>
            <div className="mt-8 text-center text-xs text-muted-foreground">
              <span>Need help? Visit the </span>
              <Link className="font-medium text-foreground underline" href="https://updates.ezchat.io/security">
                security center
              </Link>
              <span> or email </span>
              <a className="font-medium text-foreground underline" href="mailto:security@ezchat.io">
                security@ezchat.io
              </a>
              .
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
