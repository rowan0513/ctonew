"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormProps {
  redirectTo?: string | null;
}

function resolveDestination(redirectTo?: string | null): string {
  if (!redirectTo) {
    return "/admin/workspaces";
  }

  try {
    const decoded = decodeURIComponent(redirectTo);
    return decoded.startsWith("/") ? decoded : "/admin/workspaces";
  } catch {
    return "/admin/workspaces";
  }
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload?.error ?? "Unable to sign in with the provided credentials.");
        setIsSubmitting(false);
        return;
      }

      const destination = resolveDestination(redirectTo);
      router.push(destination);
      router.refresh();
    } catch (submitError) {
      console.error("Login request failed", submitError);
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Link href="mailto:security@ezchat.io" className="underline">
          Contact security
        </Link>
        <Link href="https://updates.ezchat.io/security" className="underline" target="_blank" rel="noreferrer">
          Security updates
        </Link>
      </div>
    </form>
  );
}
