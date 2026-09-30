"use client";

import { useEffect, useRef, useState } from "react";

interface Alert {
  id: string;
  site_url: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string | null;
  read: boolean;
  created_at: string;
}

const SEVERITY_DOT: Record<Alert["severity"], string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

const KIND_LABEL: Record<string, string> = {
  positions: "Positions",
  backlinks: "Backlinks",
  citations: "Citations IA",
};

export default function AlertsBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/alerts");
    if (!res.ok) return;
    const data = await res.json() as { alerts: Alert[]; unread: number };
    setAlerts(data.alerts);
    setUnread(data.unread);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    setAlerts(a => a.map(x => ({ ...x, read: true })));
    setUnread(0);
  }

  async function checkNow() {
    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/alerts/check", { method: "POST" });
      const data = await res.json() as { error?: string; site?: string; baseline?: boolean; alerts?: number };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setMessage(data.baseline
        ? `Référence enregistrée pour ${data.site}. Les écarts seront détectés à partir de la prochaine vérification.`
        : data.alerts ? `${data.alerts} nouvelle${data.alerts > 1 ? "s" : ""} alerte${data.alerts > 1 ? "s" : ""} pour ${data.site}.` : `Aucun recul détecté pour ${data.site}.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} title="Alertes de surveillance" aria-label={`Alertes${unread ? ` (${unread} non lues)` : ""}`}
        className="relative grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-accent hover:text-ink">
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-hairline bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Alertes</p>
            {unread > 0 && <button onClick={markAllRead} className="text-xs text-brand hover:underline">Tout marquer comme lu</button>}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-ink-soft">
                Aucune alerte. La surveillance compare chaque lundi les positions, backlinks et citations IA de vos sites à la semaine précédente.
              </li>
            ) : alerts.map(a => (
              <li key={a.id} className={`border-b border-hairline px-3 py-2.5 last:border-0 ${a.read ? "" : "bg-accent/30"}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[a.severity]}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-ink">{a.title}</p>
                    {a.detail && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-soft">{a.detail}</p>}
                    <p className="mt-1 text-[11px] text-ink-soft/70">
                      {KIND_LABEL[a.kind] ?? a.kind} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-hairline p-3">
            <button onClick={checkNow} disabled={checking}
              className="w-full rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-accent disabled:opacity-50">
              {checking ? "Vérification en cours…" : "Vérifier le site actif maintenant"}
            </button>
            {message && <p className="mt-2 text-xs text-ink-soft">{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
