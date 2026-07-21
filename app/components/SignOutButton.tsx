"use client";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
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
