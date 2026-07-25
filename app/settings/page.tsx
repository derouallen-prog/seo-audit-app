"use client";

import { useState, useEffect } from "react";

interface ConnectionStatus {
  connected: boolean;
  storeUrl?: string;
  wpUsername?: string;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    storeUrl: "",
    wcConsumerKey: "",
    wcConsumerSecret: "",
    wpUsername: "",
    wpAppPassword: "",
  });

  useEffect(() => {
    fetch("/api/wc/connection")
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => setStatus({ connected: false }));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/wc/connection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error ?? "Erreur lors de l'enregistrement");
    } else {
      setSuccess(true);
      setStatus({ connected: true, storeUrl: form.storeUrl, wpUsername: form.wpUsername });
      setForm({ storeUrl: "", wcConsumerKey: "", wcConsumerSecret: "", wpUsername: "", wpAppPassword: "" });
    }
  }

  async function handleDisconnect() {
    if (!confirm("Déconnecter cette boutique WooCommerce ?")) return;
    setDeleting(true);
    await fetch("/api/wc/connection", { method: "DELETE" });
    setDeleting(false);
    setStatus({ connected: false });
    setSuccess(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">

      <div className="mb-10">
        <h1 className="font-display text-3xl text-ink">Paramètres</h1>
        <p className="mt-2 text-sm text-ink-soft">Connectez votre boutique WooCommerce pour publier du contenu directement depuis l&apos;assistant.</p>
      </div>

      {/* Statut connexion */}
      {status?.connected ? (
        <div className="mb-8 rounded-xl border border-good/30 bg-good/5 p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 h-5 w-5 shrink-0 text-good">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-ink">Boutique connectée</p>
              <p className="text-xs text-ink-soft mt-0.5">{status.storeUrl}</p>
              {status.wpUsername && <p className="text-xs text-ink-soft">Utilisateur WP : {status.wpUsername}</p>}
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={deleting}
            className="shrink-0 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-accent hover:text-ink transition"
          >
            {deleting ? "…" : "Déconnecter"}
          </button>
        </div>
      ) : (
        status !== null && (
          <div className="mb-8 rounded-xl border border-hairline bg-accent/40 p-4 text-xs text-ink-soft">
            Aucune boutique WooCommerce connectée.
          </div>
        )
      )}

      {success && (
        <div className="mb-6 rounded-xl border border-good/30 bg-good/5 px-4 py-3 text-sm text-good font-medium">
          Boutique connectée avec succès — l&apos;assistant peut désormais publier des contenus.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      {/* Formulaire */}
      <div className="rounded-2xl border border-hairline bg-white p-7">
        <h2 className="text-base font-semibold text-ink mb-1">
          {status?.connected ? "Modifier la connexion" : "Connecter une boutique WooCommerce"}
        </h2>
        <p className="text-xs text-ink-soft mb-6">
          Les clés API WooCommerce se génèrent dans <strong>WooCommerce → Réglages → Avancé → REST API</strong>. Le mot de passe d&apos;application WordPress se crée dans <strong>WordPress → Profil → Mots de passe d&apos;application</strong>.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <Field
            label="URL de la boutique"
            placeholder="https://www.ma-boutique.com"
            value={form.storeUrl}
            onChange={v => setForm(f => ({ ...f, storeUrl: v }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Consumer Key WooCommerce"
              placeholder="ck_..."
              value={form.wcConsumerKey}
              onChange={v => setForm(f => ({ ...f, wcConsumerKey: v }))}
              mono
            />
            <Field
              label="Consumer Secret WooCommerce"
              placeholder="cs_..."
              value={form.wcConsumerSecret}
              onChange={v => setForm(f => ({ ...f, wcConsumerSecret: v }))}
              mono
              secret
            />
          </div>
          <Field
            label="Nom d'utilisateur WordPress"
            placeholder="nicolas@example.com"
            value={form.wpUsername}
            onChange={v => setForm(f => ({ ...f, wpUsername: v }))}
          />
          <Field
            label="Mot de passe d'application WordPress"
            placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
            value={form.wpAppPassword}
            onChange={v => setForm(f => ({ ...f, wpAppPassword: v }))}
            mono
            secret
          />

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || !form.storeUrl || !form.wcConsumerKey || !form.wcConsumerSecret || !form.wpUsername || !form.wpAppPassword}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition shadow glow-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Enregistrement…
                </>
              ) : "Connecter la boutique"}
            </button>
          </div>
        </form>
      </div>

      {/* Aide */}
      <div className="mt-8 rounded-xl border border-hairline p-5 text-xs text-ink-soft space-y-2">
        <p className="font-medium text-ink text-sm">Ce qui sera possible une fois connecté</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Publier une fiche produit en brouillon WooCommerce</li>
          <li>Créer une page de catégorie produit</li>
          <li>Publier un article de blog WordPress en brouillon</li>
          <li>Créer une page WordPress (ex : page de contenu SEO)</li>
        </ul>
        <p className="mt-2">Tous les contenus sont créés en <strong>brouillon</strong> — aucune publication immédiate sur votre site sans validation manuelle.</p>
      </div>

    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  mono = false,
  secret = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  secret?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink">{label}</label>
      <div className="relative">
        <input
          type={secret && !show ? "password" : "text"}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-brand/40 ${mono ? "font-mono text-xs" : ""} ${secret ? "pr-10" : ""}`}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
          >
            {show ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
