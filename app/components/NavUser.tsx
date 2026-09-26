import Link from "next/link";
import { getAuthUser } from "@/lib/supabaseServer";
import SignOutButton from "./SignOutButton";

export default async function NavUser() {
  const user = await getAuthUser();

  if (user) {
    const initials = (user.email?.[0] ?? "U").toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="hidden md:block">
          <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-accent hover:text-ink">
            Mes audits
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/account" title="Paramètres du compte">
            <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0 hover:opacity-80 transition-opacity cursor-pointer">
              {initials}
            </div>
          </Link>
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <Link href="/auth">
      <button className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white shadow transition-colors hover:bg-ink/90">
        Se connecter
      </button>
    </Link>
  );
}
