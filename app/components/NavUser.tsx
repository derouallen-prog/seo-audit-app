import Link from "next/link";
import { getAuthUser } from "@/lib/supabaseServer";
import SignOutButton from "./SignOutButton";
import LoginButton from "./LoginButton";
import SiteSwitcher from "./SiteSwitcher";
import AlertsBell from "./AlertsBell";

export default async function NavUser() {
  const user = await getAuthUser();

  if (user) {
    const initials = (user.email?.[0] ?? "U").toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:block"><SiteSwitcher /></div>
        <AlertsBell />
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
    <LoginButton
      defaultMode="login"
      redirectTo="/dashboard"
      className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white shadow transition-colors hover:bg-ink/90"
    >
      Se connecter
    </LoginButton>
  );
}
