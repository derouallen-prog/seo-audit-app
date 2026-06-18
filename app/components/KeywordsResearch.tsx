"use client";

import { useState } from "react";

interface SecondaryKeyword {
  keyword: string;
  volume: number;
  kd: number;
  intent: string;
}

interface KeywordsResult {
  mot_cle_principal: string;
  volume: number;
  kd: number;
  intent: string;
  mots_cles_secondaires: SecondaryKeyword[];
  justification: string;
}

interface Props {
  url: string;
  onSelectKeyword: (kw: string) => void;
}

function KdBadge({ kd }: { kd: number }) {
  const color = kd >= 70 ? "bg-red-100 text-red-800" : kd >= 40 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800";
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>{kd}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs text-gray-400 hover:text-white transition"
    >
      {copied ? "✓" : "Copier"}
    </button>
  );
}

export default function KeywordsResearch({ url, onSelectKeyword }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KeywordsResult | null>(null);

  // Step 1 — Profil client
  const [secteur, setSecteur] = useState("");
  const [description, setDescription] = useState("");
  const [personas, setPersonas] = useState("");
  const [args, setArgs] = useState("");

  // Step 2 — Concurrents
  const [competitors, setCompetitors] = useState(["", "", "", ""]);

  function updateCompetitor(i: number, val: string) {
    setCompetitors(prev => prev.map((c, idx) => idx === i ? val : c));
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          clientProfile: { secteur, description, personas, arguments: args },
          competitors: competitors.filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Erreur lors de la génération");
        return;
      }
      setResult(json);
      setStep(3);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Recherche de mots-clés</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 bg-neutral-800 px-2 py-1 rounded">Semrush + IA Claude</span>
          {result && (
            <button onClick={() => { setStep(1); setResult(null); }} className="text-xs text-gray-400 hover:text-white transition">
              Recommencer
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {["Profil client", "Concurrents", "Résultats"].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center font-medium text-xs ${step === i + 1 ? "bg-indigo-600 text-white" : step > i + 1 ? "bg-green-600 text-white" : "bg-neutral-700 text-gray-400"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={step === i + 1 ? "text-white" : "text-gray-500"}>{label}</span>
            {i < 2 && <span className="text-gray-700">›</span>}
          </div>
        ))}
      </div>

      {/* Step 1 — Profil client */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Secteur d&apos;activité *</label>
              <input
                value={secteur}
                onChange={e => setSecteur(e.target.value)}
                placeholder="ex: SaaS RH, e-commerce mode, cabinet comptable…"
                className="w-full rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Description courte *</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="ex: Logiciel de paie pour PME françaises"
                className="w-full rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Personas cibles</label>
              <input
                value={personas}
                onChange={e => setPersonas(e.target.value)}
                placeholder="ex: DRH, gérant TPE, comptable"
                className="w-full rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Arguments différenciants</label>
              <input
                value={args}
                onChange={e => setArgs(e.target.value)}
                placeholder="ex: IA native, intégration DSN, 100% français"
                className="w-full rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
              />
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!secteur || !description}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 font-medium transition"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Step 2 — Concurrents */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">Entrez jusqu&apos;à 4 domaines concurrents (sans https://). Vous pouvez laisser des champs vides.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {competitors.map((c, i) => (
              <div key={i}>
                <label className="text-xs text-gray-400 block mb-1">Concurrent {i + 1}</label>
                <input
                  value={c}
                  onChange={e => updateCompetitor(i, e.target.value)}
                  placeholder="ex: concurrent.fr"
                  className="w-full rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-gray-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-gray-700 text-gray-300 hover:text-white px-4 py-2.5 text-sm transition"
            >
              ← Retour
            </button>
            <button
              onClick={generate}
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 font-medium transition"
            >
              {loading ? "Analyse en cours…" : "✨ Générer les mots-clés"}
            </button>
          </div>
          {loading && (
            <p className="text-xs text-gray-500 text-center">Récupération Semrush + analyse IA en cours (15-30s)…</p>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {/* Step 3 — Résultats */}
      {step === 3 && result && (
        <div className="space-y-5">
          {/* Mot-clé principal */}
          <div className="rounded-lg border border-green-800/50 bg-green-950/20 p-4">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Mot-clé principal</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-lg font-semibold text-white">{result.mot_cle_principal}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Vol. <span className="text-white font-medium">{result.volume.toLocaleString("fr-FR")}</span></span>
                <KdBadge kd={result.kd} />
                <span className="text-xs text-gray-400">{result.intent}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <CopyButton text={result.mot_cle_principal} />
              <button
                onClick={() => onSelectKeyword(result.mot_cle_principal)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                Utiliser dans TagsGenerator →
              </button>
            </div>
          </div>

          {/* Mots-clés secondaires */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mots-clés secondaires</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-700">
                    <th className="pb-2 pr-4 font-medium">Mot-clé</th>
                    <th className="pb-2 pr-4 font-medium text-right">Volume</th>
                    <th className="pb-2 pr-4 font-medium text-right">KD</th>
                    <th className="pb-2 pr-4 font-medium">Intention</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.mots_cles_secondaires.map((kw, i) => (
                    <tr key={i} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 pr-4 font-medium text-white">{kw.keyword}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{kw.volume.toLocaleString("fr-FR")}</td>
                      <td className="py-2 pr-4 text-right"><KdBadge kd={kw.kd} /></td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{kw.intent}</td>
                      <td className="py-2">
                        <div className="flex gap-3 justify-end">
                          <CopyButton text={kw.keyword} />
                          <button
                            onClick={() => onSelectKeyword(kw.keyword)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                          >
                            Utiliser →
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Justification */}
          {result.justification && (
            <div className="rounded-lg bg-neutral-800/50 p-3">
              <p className="text-xs text-gray-400 font-medium mb-1">Justification IA</p>
              <p className="text-xs text-gray-300">{result.justification}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
