"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    group: "COMPTE",
    items: [
      { label: "Général", href: "/account/general", icon: <IconSettings /> },
      { label: "Abonnement", href: "/account/abonnement", icon: <IconCreditCard /> },
    ],
  },
  {
    group: "MON SITE",
    items: [
      { label: "À propos", href: "/account/site", icon: <IconGlobe /> },
      { label: "Intégrations", href: "/account/integrations", icon: <IconPlug /> },
    ],
  },
];

function IconSettings() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
}
function IconCreditCard() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
}
function IconGlobe() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
}
function IconPlug() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M8 6l10 10M6 8l12 12" /><path d="M7 17l-4 4M17 7l4-4" /><path d="M9 3l2 2-4 4-2-2zM21 15l-2-2-4 4 2 2z" /></svg>;
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-hairline bg-muted/30 px-3 py-6 flex flex-col gap-6">
        <div className="px-2">
          <p className="text-xs font-semibold text-brand tracking-wide">Search Mind</p>
          <p className="text-[11px] text-ink-soft mt-0.5">Paramètres</p>
        </div>

        {NAV.map(section => (
          <div key={section.group}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold text-ink-soft/60 uppercase tracking-widest">{section.group}</p>
            <nav className="flex flex-col gap-0.5">
              {section.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-brand/10 text-brand font-medium"
                        : "text-ink-soft hover:bg-accent hover:text-ink"
                    }`}
                  >
                    <span className={active ? "text-brand" : "text-ink-soft"}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="mt-auto px-2">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Retour à l&apos;app
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 px-8 py-8 max-w-3xl">
        {children}
      </main>
    </div>
  );
}
