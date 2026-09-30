"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface Site { id: string; label: string; site_url: string; isPrimary: boolean }

function Favicon({ domain }: { domain: string }) {
  return (
    <Image src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" width={16} height={16}
      unoptimized className="h-4 w-4 shrink-0 rounded" />
  );
}

export default function SiteSwitcher() {
  const [sites, setSites] = useState<Site[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ site_url: "", label: "", competitors: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/sites");
    if (!res.ok) return;
    const data = await res.json() as { sites: Site[]; activeId: string | null };
    setSites(data.sites);
    setActiveId(data.activeId);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function select(id: string) {
    if (id === activeId) { setOpen(false); return; }
    await fetch("/api/sites/active", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    window.location.reload();
  }

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_url: form.site_url,
          label: form.label,
          competitors: form.competitors.split(/[,\n]/).map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  async function removeSite(id: string) {
    if (!window.confirm("Retirer ce site client ? Les données déjà collectées sont conservées.")) return;
    await fetch(`/api/sites?id=${id}`, { method: "DELETE" });
    window.location.reload();
  }

  if (sites.length === 0) return null;
  const active = sites.find(s => s.id === activeId) ?? sites[0]!;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex max-w-[180px] items-center gap-2 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-accent"
        aria-haspopup="listbox" aria-expanded={open} title="Site analysé">
        <Favicon domain={active.site_url} />
        <span className="truncate">{active.label}</span>
        <svg className="h-3 w-3 shrink-0 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-hairline bg-white shadow-xl">
          <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-soft/70">Site analysé</p>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {sites.map(s => (
              <li key={s.id} className="group flex items-center">
                <button role="option" aria-selected={s.id === active.id} onClick={() => select(s.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60 ${s.id === active.id ? "text-brand font-medium" : "text-ink"}`}>
                  <Favicon domain={s.site_url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{s.label}</span>
                    <span className="block truncate text-[11px] text-ink-soft">{s.isPrimary ? "Mon site" : s.site_url}</span>
                  </span>
                  {s.id === active.id && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                </button>
                {!s.isPrimary && (
                  <button onClick={() => removeSite(s.id)} title="Retirer ce site"
                    className="mr-2 hidden rounded p-1 text-ink-soft hover:bg-red-50 hover:text-red-600 group-hover:block">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-hairline p-3">
            {adding ? (
              <form onSubmit={addSite} className="space-y-2">
                <input id="client-site-url" required value={form.site_url} onChange={e => setForm(f => ({ ...f, site_url: e.target.value }))}
                  placeholder="Domaine du client (ex : client.fr)"
                  className="w-full rounded-lg border border-hairline px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
                <input id="client-site-label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Nom du client (optionnel)"
                  className="w-full rounded-lg border border-hairline px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
                <input id="client-site-competitors" value={form.competitors} onChange={e => setForm(f => ({ ...f, competitors: e.target.value }))}
                  placeholder="Concurrents, séparés par des virgules"
                  className="w-full rounded-lg border border-hairline px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setAdding(false); setError(null); }} className="px-2.5 py-1 text-xs text-ink-soft hover:text-ink">Annuler</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
                    {saving ? "Ajout…" : "Ajouter"}
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 text-sm font-medium text-brand hover:underline">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Ajouter un site client
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
