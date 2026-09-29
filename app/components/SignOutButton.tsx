"use client";
import { useState } from "react";

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/?signedout=1";
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="text-xs text-ink-soft hover:text-ink transition-colors disabled:opacity-50"
      title="Déconnexion"
    >
      {loading ? "…" : "Déconnexion"}
    </button>
  );
}
