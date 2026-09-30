"use client";

import { useEffect, useState } from "react";

interface Branding {
  agency_name: string;
  logo_url: string;
  accent_color: string;
  footer_text: string;
}

const EMPTY: Branding = { agency_name: "", logo_url: "", accent_color: "#2563eb", footer_text: "" };

export default function MarqueBlanchePage() {
  const [form, setForm] = useState<Branding>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/account/branding")
      .then(r => r.ok ? r.json() : null)
      .then((d: { branding: Partial<Branding> | null } | null) => {
        if (d?.branding) {
          setForm({
            agency_name: d.branding.agency_name ?? "",
            logo_url: d.branding.logo_url ?? "",
            accent_color: d.branding.accent_color ?? "#2563eb",
            footer_text: d.branding.footer_text ?? "",
          });
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/account/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json() as { error?: string };
    setStatus(res.ok ? { ok: true, msg: "Identité enregistrée." } : { ok: false, msg: data.error ?? "Erreur" });
    setSaving(false);
  }

  const set = (k: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  if (!loaded) return <div className="h-48 grid place-items-center text-sm text-ink-soft">Chargement…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Marque blanche</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Les rapports exportés depuis l&apos;assistant portent votre identité, pas celle de Search Mind.
        </p>
      </div>

      <form onSubmit={save} className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 rounded-xl border border-hairline bg-background p-5">
          <div>
            <label htmlFor="agency_name" className="mb-1.5 block text-sm font-medium text-ink">Nom de l&apos;agence ou du consultant</label>
            <input id="agency_name" value={form.agency_name} onChange={set("agency_name")} placeholder="ex : Atelier Référencement"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label htmlFor="logo_url" className="mb-1.5 block text-sm font-medium text-ink">URL du logo</label>
            <input id="logo_url" value={form.logo_url} onChange={set("logo_url")} placeholder="https://monagence.fr/logo.png"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            <p className="mt-1 text-xs text-ink-soft">Image hébergée en https, idéalement en PNG ou SVG sur fond transparent.</p>
          </div>
          <div>
            <label htmlFor="accent_color" className="mb-1.5 block text-sm font-medium text-ink">Couleur principale</label>
            <div className="flex items-center gap-3">
              <input id="accent_color" type="color" value={form.accent_color} onChange={set("accent_color")}
                className="h-9 w-12 cursor-pointer rounded border border-hairline bg-white" />
              <input aria-label="Code couleur" value={form.accent_color} onChange={set("accent_color")}
                className="w-28 rounded-lg border border-hairline px-3 py-2 font-mono text-sm focus:border-brand focus:outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="footer_text" className="mb-1.5 block text-sm font-medium text-ink">Pied de page</label>
            <textarea id="footer_text" value={form.footer_text} onChange={set("footer_text")} rows={2}
              placeholder="ex : Atelier Référencement · contact@monagence.fr · 06 12 34 56 78"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {status && <p className={`text-sm ${status.ok ? "text-green-700" : "text-red-600"}`}>{status.msg}</p>}
          </div>
        </div>

        {/* Aperçu de l'en-tête du rapport */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft/60">Aperçu de l&apos;en-tête</p>
          <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-sm">
            <div className="h-1.5" style={{ backgroundColor: form.accent_color }} />
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              {form.logo_url && /^https:\/\//.test(form.logo_url)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={form.logo_url} alt="" className="h-8 max-w-[120px] object-contain" />
                : <span className="text-sm font-bold" style={{ color: form.accent_color }}>{form.agency_name || "Votre agence"}</span>}
              <span className="text-[11px] text-gray-500">{new Date().toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="px-4 pb-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Rapport SEO</p>
              <p className="text-base font-semibold text-gray-900">client.fr</p>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-full rounded bg-gray-100" />
                <div className="h-2 w-4/5 rounded bg-gray-100" />
                <div className="h-2 w-3/5 rounded bg-gray-100" />
              </div>
            </div>
            <div className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-500">
              {form.footer_text || "Pied de page du rapport"}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
