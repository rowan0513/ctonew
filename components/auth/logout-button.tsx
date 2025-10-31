"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-sm"
      onClick={handleLogout}
      disabled={isSigningOut}
      data-testid="logout-button"
    >
      {isSigningOut ? "Signing out…" : "Sign out"}
    </Button>
  );
}
