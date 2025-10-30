"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  redirectTo?: string;
};

type LoginErrorState = {
  message: string;
  status?: number;
} | null;

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<LoginErrorState>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          response.status === 429
            ? "Too many login attempts. Please wait and try again."
            : payload?.error ?? "Unable to sign in with the provided credentials.";
        setError({ message, status: response.status });
        setIsSubmitting(false);
        return;
      }

      const destination = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";
      router.push(destination);
      router.refresh();
    } catch (submitError) {
      console.error("Failed to submit login form", submitError);
      setError({ message: "An unexpected error occurred. Please try again." });
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="focus-visible:ring-ring block w-full rounded-md border border-muted bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="focus-visible:ring-ring block w-full rounded-md border border-muted bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary hover:bg-primary/90 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <Link className="text-muted-foreground hover:text-foreground" href="/forgot-password">
          Forgot password?
        </Link>
        <span className="text-muted-foreground">
          Need access? Contact <a className="underline" href="mailto:team@ezchat.io">team@ezchat.io</a>
        </span>
      </div>
    </form>
  );
}
