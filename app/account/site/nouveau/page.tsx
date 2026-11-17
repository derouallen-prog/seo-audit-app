"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

function hasTLD(v: string): boolean {
  const clean = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
  return /[a-z0-9-]\.[a-z]{2,10}$/i.test(clean);
}

interface DetectResult {
  positioning: string | null;
  crawlSignals?: { detectedMarket?: { code: string; label: string } | null };
}

export default function NouveauSitePage() {
  const router = useRouter();
  const [step, setStep] = useState<"url" | "review">("url");
  const [urlInput, setUrlInput] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [label, setLabel] = useState("");
  const [positioning, setPositioning] = useState("");
  const [market, setMarket] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleDetect(e: React.FormEvent) {
    e.preventDefault();
    const raw = urlInput.trim();
    if (!raw || !hasTLD(raw)) { setError("Indique un domaine valide (ex : client.fr)."); return; }
    const url = raw.startsWith("http") ? raw : `https://${raw}`;

    setDetecting(true);
    setError("");
    try {
      const hostname = new URL(url).hostname;
      const [detectRes, compRes] = await Promise.all([
        fetch("/api/onboarding/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
        fetch("/api/onboarding/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: hostname }) }),
      ]);
      const detect = detectRes.ok ? await detectRes.json() as DetectResult : null;
      const comp = compRes.ok ? await compRes.json() as { competitors: string[] } : { competitors: [] };

      setSiteUrl(url);
      setLabel(hostname);
      setPositioning(detect?.positioning ?? "");
      setMarket(detect?.crawlSignals?.detectedMarket?.code ?? null);
      setCompetitors(comp.competitors.slice(0, 5));
      setStep("review");
    } catch {
      setError("L'analyse a échoué. Réessaie dans un instant.");
    } finally {
      setDetecting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_url: siteUrl, label, positioning, market, competitors }),
      });
      if (!res.ok) throw new Error();
      router.push("/account/site");
    } catch {
      setError("L'enregistrement a échoué. Réessaie.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <h1 className="text-xl font-semibold text-ink mb-1">Changer de site</h1>
      <p className="text-sm text-ink-soft mb-8">
        Analyse rapide d&apos;un nouveau domaine. Ton site actuel reste disponible dans le sélecteur de sites en haut à droite.
      </p>

      {step === "url" && (
        <form onSubmit={handleDetect} className="space-y-3">
          <div className="flex overflow-hidden rounded-xl border border-hairline bg-background shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
            <span className="flex items-center border-r border-hairline bg-muted px-3 text-xs font-mono text-ink-soft select-none shrink-0">https://</span>
            <input
              type="text"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value.replace(/^https?:\/\//, "").replace(/^\/\//, "")); setError(""); }}
              placeholder="www.nouveau-site.fr"
              autoFocus
              disabled={detecting}
              className="flex-1 bg-transparent px-3 py-3.5 text-sm text-ink outline-none placeholder:text-ink-soft/50"
            />
          </div>
          {error && <p className="text-xs text-warning">{error}</p>}
          <button
            type="submit"
            disabled={detecting || !urlInput.trim()}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 disabled:opacity-50"
          >
            {detecting ? "Analyse en cours…" : "Analyser ce site →"}
          </button>
        </form>
      )}

      {step === "review" && (
        <div className="space-y-5">
          <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-background px-4 py-3">
            <Image src={`https://www.google.com/s2/favicons?domain=${label}&sz=32`} alt="" width={16} height={16} unoptimized className="h-4 w-4 rounded" />
            <span className="text-sm font-medium text-ink">{label}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Positionnement</label>
            <textarea
              value={positioning}
              onChange={e => setPositioning(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition"
            />
          </div>

          {competitors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink mb-1.5">Concurrents détectés</p>
              <div className="flex flex-wrap gap-1.5">
                {competitors.map(c => (
                  <span key={c} className="rounded-full border border-hairline bg-muted/30 px-2.5 py-1 text-xs text-ink-soft">{c}</span>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-warning">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep("url")} className="text-xs text-ink-soft hover:text-ink transition-colors">← Retour</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand/90 disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Ajouter ce site"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
