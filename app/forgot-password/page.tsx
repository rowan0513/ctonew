import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forgot password | EzChat Admin",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16 text-foreground">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold">Password reset coming soon</h1>
          <p className="text-sm text-muted-foreground">
            Automated password recovery for EzChat administrators is under development. Until then,
            please contact the on-call security team to reset your credentials.
          </p>
        </div>
        <div className="rounded-lg border border-muted bg-background/60 p-6 text-left">
          <h2 className="text-lg font-medium text-foreground">Need immediate assistance?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Email <a className="font-medium text-foreground underline" href="mailto:security@ezchat.io">security@ezchat.io</a>
            </li>
            <li>Page the on-call lead via the EzChat incident bridge.</li>
            <li>
              Review the{" "}
              <Link className="font-medium text-foreground underline" href="https://updates.ezchat.io/security">
                security update log
              </Link>{" "}
              for incident communications.
            </li>
          </ul>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          <Link className="font-medium text-foreground underline" href="/login">
            Return to login
          </Link>
        </div>
      </main>
    </div>
  );
}
