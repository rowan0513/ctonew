"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.error ?? "Unable to sign out right now.";
        setError(message);
        setIsProcessing(false);
        return;
      }

      router.push("/login");
      router.refresh();
    } catch (logoutError) {
      console.error("Failed to sign out", logoutError);
      setError("An unexpected error occurred while signing out.");
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isProcessing}
        className="hover:bg-muted inline-flex items-center rounded-md border border-muted bg-background px-3 py-1.5 text-sm font-medium text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isProcessing ? "Signing out..." : "Sign out"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
