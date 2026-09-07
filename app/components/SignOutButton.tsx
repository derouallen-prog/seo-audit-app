"use client";

export default function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      onClick={signOut}
      className="text-xs text-ink-soft hover:text-ink transition-colors"
      title="Déconnexion"
    >
      Déconnexion
    </button>
  );
}
