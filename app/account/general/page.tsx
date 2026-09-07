"use client";

import { useState, useEffect } from "react";

interface Profile {
  email: string;
  display_name: string | null;
  profile: {
    seo_level?: string;
    preferred_lang?: string;
    weekly_report?: boolean;
  } | null;
}

const SEO_LEVELS = [
  { value: "débutant", label: "Débutant", desc: "Explications pédagogues, peu de jargon" },
  { value: "intermédiaire", label: "Intermédiaire", desc: "Équilibre entre détail et accessibilité" },
  { value: "expert", label: "Expert SEO", desc: "Terminologie technique, analyses poussées" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft/60 mb-3">{children}</h2>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-hairline bg-background divide-y divide-hairline">{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}

export default function GeneralPage() {
  const [data, setData] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [seoLevel, setSeoLevel] = useState("intermédiaire");
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/account/profile").then(r => r.json()).then((d: Profile) => {
      setData(d);
      setDisplayName(d.display_name ?? "");
      setSeoLevel(d.profile?.seo_level ?? "intermédiaire");
      setWeeklyReport(d.profile?.weekly_report ?? true);
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: displayName, seo_level: seoLevel, weekly_report: weeklyReport }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-soft text-sm">
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Chargement…
      </div>
    );
  }

  const initials = (displayName?.[0] ?? data.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Général</h1>
        <p className="text-sm text-ink-soft mt-0.5">Personnalise ton expérience Search Mind</p>
      </div>

      {/* Profil */}
      <section className="space-y-3">
        <SectionTitle>Profil</SectionTitle>
        <Card>
          <Row>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-brand flex items-center justify-center text-white text-lg font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <label className="block text-xs text-ink-soft mb-1">Nom affiché</label>
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Ton prénom ou pseudo"
                    className="w-full rounded-lg border border-hairline bg-background px-3 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
                  />
                </div>
                <p className="text-xs text-ink-soft truncate">{data.email}</p>
              </div>
            </div>
          </Row>
        </Card>
      </section>

      {/* Niveau SEO */}
      <section className="space-y-3">
        <SectionTitle>Niveau SEO</SectionTitle>
        <p className="text-xs text-ink-soft -mt-1">Adapte la profondeur des réponses de l&apos;assistant à ton niveau d&apos;expertise</p>
        <div className="grid grid-cols-3 gap-2">
          {SEO_LEVELS.map(lvl => (
            <button
              key={lvl.value}
              onClick={() => setSeoLevel(lvl.value)}
              className={`rounded-xl border px-3 py-3 text-left transition-all ${
                seoLevel === lvl.value
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-hairline bg-background text-ink-soft hover:border-ink/20 hover:text-ink"
              }`}
            >
              <p className="text-sm font-medium">{lvl.label}</p>
              <p className="text-[11px] mt-0.5 opacity-70">{lvl.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <SectionTitle>Notifications</SectionTitle>
        <Card>
          <Row>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Rapport hebdomadaire</p>
                <p className="text-xs text-ink-soft mt-0.5">Récapitulatif SEO chaque lundi par e-mail — évolution des positions, alertes, opportunités</p>
              </div>
              <button
                role="switch"
                aria-checked={weeklyReport}
                onClick={() => setWeeklyReport(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${weeklyReport ? "bg-brand" : "bg-ink/20"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${weeklyReport ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </Row>
        </Card>
      </section>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : saved ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
