"use client";

import { useState } from "react";

// ── Shared primitives ─────────────────────────────────────────────────────────

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-hairline bg-background shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-ink-soft hover:bg-accent hover:text-ink transition">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
  );
}

function Field({ label, required, tooltip, children }: { label: string; required?: boolean; tooltip?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</label>
        {required && <span className="text-[10px] text-brand font-medium">Obligatoire</span>}
        {tooltip && (
          <span className="relative group/tip ml-0.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-hairline text-[10px] font-medium text-ink-soft cursor-help hover:border-brand/50 hover:text-brand transition-colors">?</span>
            <span className="pointer-events-none absolute left-0 top-5 z-50 hidden w-56 rounded-xl bg-ink px-3 py-2 text-[11px] leading-relaxed text-white shadow-xl group-hover/tip:block">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-hairline bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition";
const textareaCls = `${inputCls} resize-none`;

function SubmitBtn({ label = "Lancer", disabled }: { label?: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}

// ── Reddit Setup Modal ────────────────────────────────────────────────────────

const REDDIT_OPTIONS = [
  {
    id: "brand",
    title: "Ma marque ou mon site",
    desc: "Ce que les utilisateurs disent de toi en ligne.",
    placeholder: "ex. : Patagonia, mon-site.fr",
    buildPrompt: (v: string) => `Analyse les discussions Reddit sur la marque ou le site "${v}". Identifie les points positifs, les critiques récurrentes, les questions des utilisateurs et les opportunités de ninja linking.`,
  },
  {
    id: "keyword",
    title: "Une thématique ou un mot-clé",
    desc: "Vocabulaire réel, pain points et questions des internautes.",
    placeholder: "ex. : lampe de bureau LED, randonnée débutant",
    buildPrompt: (v: string) => `Analyse les discussions Reddit sur la thématique "${v}". Identifie le vocabulaire réel des internautes, les questions récurrentes, les pain points et les opportunités de contenu.`,
  },
  {
    id: "longtail",
    title: "Suggestions longue traîne",
    desc: "Expressions exactes utilisées par les internautes, classées par pertinence SEO.",
    placeholder: "ex. : nutrition sportive, décoration intérieure",
    buildPrompt: (v: string) => `Trouve des mots-clés de longue traîne sur la thématique "${v}" en analysant les discussions Reddit. Identifie les expressions exactes utilisées par les internautes et classe-les par pertinence SEO.`,
  },
] as const;

export function RedditSetupModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (prompt: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null || !value.trim()) return;
    onSubmit(REDDIT_OPTIONS[selected].buildPrompt(value.trim()));
  }

  return (
    <Overlay onClose={onClose}>
      <ModalHeader
        title="Popularité mots-clés et marque sur Reddit"
        subtitle="Choisissez le type d'analyse"
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-2">
          {REDDIT_OPTIONS.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setSelected(i); setValue(""); }}
              className={`w-full text-left rounded-xl border p-4 transition ${selected === i ? "border-brand bg-brand-soft/60" : "border-hairline hover:border-brand/30 hover:bg-accent"}`}
            >
              <div className="text-sm font-semibold text-ink">{opt.title}</div>
              <div className="mt-0.5 text-xs text-ink-soft">{opt.desc}</div>
            </button>
          ))}
        </div>

        {selected !== null && (
          <Field label="Votre recherche" required>
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={REDDIT_OPTIONS[selected].placeholder}
              className={inputCls}
            />
          </Field>
        )}

        <SubmitBtn label="Analyser Reddit" disabled={selected === null || !value.trim()} />
      </form>
    </Overlay>
  );
}

// ── Product Setup Modal ───────────────────────────────────────────────────────

export function ProductSetupModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (prompt: string) => void }) {
  const [mode, setMode] = useState<"new" | "existing" | null>(null);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [features, setFeatures] = useState("");
  const [audience, setAudience] = useState("");
  const [url, setUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "new") {
      if (!name.trim()) return;
      const prompt = [
        `Génère une fiche produit e-commerce complète et optimisée SEO/GEO pour le produit suivant.`,
        `**Nom du produit :** ${name}`,
        keyword ? `**Mot-clé cible :** ${keyword}` : "",
        features ? `**Caractéristiques :** ${features}` : "",
        audience ? `**Cible client :** ${audience}` : "",
        `\nLa fiche doit inclure : title et meta description optimisés, description structurée (600-900 mots), bénéfices mis en avant, et un appel à l'action clair.`,
      ].filter(Boolean).join("\n");
      onSubmit(prompt);
    } else if (mode === "existing") {
      if (!url.trim()) return;
      onSubmit(`Analyse la fiche produit à l'URL ${url} et propose des recommandations d'optimisation SEO/GEO 2026 : title, meta, structure du contenu, densité de mots-clés, signaux EEAT, et opportunités de rich results.`);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalHeader
        title="Fiche produit"
        subtitle="Nouvelle fiche ou optimisation d'une fiche existante ?"
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "new", label: "Nouvelle fiche produit", icon: "✦" },
            { key: "existing", label: "Optimiser une fiche existante", icon: "↗" },
          ].map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key as "new" | "existing")}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${mode === opt.key ? "border-brand bg-brand-soft/60" : "border-hairline hover:border-brand/30 hover:bg-accent"}`}
            >
              <span className="text-lg text-brand">{opt.icon}</span>
              <span className="text-xs font-semibold text-ink leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>

        {mode === "new" && (
          <div className="space-y-3">
            <Field label="Nom du produit" required>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ex. : Lampe de bureau LED tactile" className={inputCls} />
            </Field>
            <Field label="Mot-clé cible">
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="ex. : lampe bureau LED dimmable" className={inputCls} />
            </Field>
            <Field label="Caractéristiques produit">
              <textarea value={features} onChange={e => setFeatures(e.target.value)} rows={3} placeholder="ex. : 3 niveaux de luminosité, USB-C, bras articulé, base lestée 1 kg" className={textareaCls} />
            </Field>
            <Field label="Cible client">
              <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="ex. : télétravailleurs, étudiants en architecture" className={inputCls} />
            </Field>
          </div>
        )}

        {mode === "existing" && (
          <Field label="URL de la fiche produit" required>
            <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://mon-site.fr/produit/..." className={inputCls} />
          </Field>
        )}

        {mode && (
          <SubmitBtn
            label={mode === "new" ? "Générer la fiche" : "Analyser et optimiser"}
            disabled={mode === "new" ? !name.trim() : !url.trim()}
          />
        )}
      </form>
    </Overlay>
  );
}

// ── Content Plan Setup Modal ──────────────────────────────────────────────────

export function ContentPlanSetupModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (prompt: string) => void }) {
  const [keywords, setKeywords] = useState("");
  const [intent, setIntent] = useState("");
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [objective, setObjective] = useState("");
  const [constraints, setConstraints] = useState("");
  const [urls, setUrls] = useState(["", "", ""]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keywords.trim()) return;

    const lines = [
      "Rédige un plan de contenu éditorial sur la base des éléments suivants.",
      "",
      `**Mots-clés cibles :** ${keywords}`,
      intent ? `**Intention de recherche :** ${intent}` : "",
      theme ? `**Thématique générale :** ${theme}` : "",
      audience ? `**Audience cible :** ${audience}` : "",
      tone ? `**Ton de rédaction :** ${tone}` : "",
      objective ? `**Objectif du contenu :** ${objective}` : "",
      constraints ? `**Contraintes :** ${constraints}` : "",
      urls.filter(Boolean).length ? `**Exemples de pages :** ${urls.filter(Boolean).join(", ")}` : "",
      "",
      "Construis un plan avec une page pilier et des articles satellites maillés entre eux. Pour chaque article : mot-clé cible, intention de recherche, angle éditorial, priorité et maillage interne suggéré.",
    ];

    onSubmit(lines.filter(l => l !== undefined).join("\n"));
  }

  return (
    <Overlay onClose={onClose}>
      <ModalHeader
        title="Rédiger un plan de contenu"
        subtitle="Seul le premier champ est obligatoire — remplissez le maximum pour une réponse plus qualitative."
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

        <Field label="Mots-clés principaux et longue traîne" required>
          <textarea
            autoFocus
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            rows={3}
            placeholder="ex. : lampe de bureau, lampe LED bureau, meilleure lampe bureau travail"
            className={textareaCls}
          />
          <p className="mt-1 text-[10px] text-ink-soft">Si vous ne connaissez pas encore vos mots-clés, utilisez d&apos;abord l&apos;outil &ldquo;Suggestion longue traîne&rdquo;.</p>
        </Field>

        <Field label="Intention de recherche">
          <select value={intent} onChange={e => setIntent(e.target.value)} className={inputCls}>
            <option value="">Sélectionner (optionnel)</option>
            <option value="informationnelle">Informationnelle — apprendre, comprendre</option>
            <option value="commerciale">Commerciale — comparer, évaluer</option>
            <option value="transactionnelle">Transactionnelle — acheter, commander</option>
            <option value="navigationnelle">Navigationnelle — trouver un site ou une page</option>
          </select>
        </Field>

        <Field
          label="Thématique générale"
          tooltip="Le sujet global pour bien comprendre le type de contenu (par exemple, un article, un guide pratique, une fiche produit, un comparatif)."
        >
          <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="ex. : éclairage bureau pour télétravail" className={inputCls} />
        </Field>

        <Field
          label="Cible de l'audience"
          tooltip="Qui est l'audience principale ? (ex : débutants, amateurs passionnés, professionnels, entreprises)."
        >
          <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="ex. : télétravailleurs 30-50 ans, sensibles au design" className={inputCls} />
        </Field>

        <Field
          label="Ton de rédaction souhaité"
          tooltip="Précise si tu veux un style plus formel, professionnel, chaleureux, ou inspirant, en fonction de la cible."
        >
          <input value={tone} onChange={e => setTone(e.target.value)} placeholder="ex. : pédagogique et chaleureux" className={inputCls} />
        </Field>

        <Field
          label="Objectif du contenu"
          tooltip="Est-ce que l'objectif est de générer des ventes, améliorer le maillage interne, éduquer l'audience ou capter du trafic qualifié ?"
        >
          <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="ex. : capter du trafic qualifié et générer des ventes" className={inputCls} />
        </Field>

        <Field
          label="Contraintes spécifiques"
          tooltip="Y a-t-il des points spécifiques à inclure ou à éviter ? (ex : mettre en avant certaines valeurs, éviter des promesses commerciales trop agressives)."
        >
          <textarea value={constraints} onChange={e => setConstraints(e.target.value)} rows={2} placeholder="ex. : éviter de mentionner les prix, mettre en avant la durabilité" className={textareaCls} />
        </Field>

        <Field label="Exemples de pages sur cette thématique">
          <div className="space-y-2">
            {urls.map((u, i) => (
              <input
                key={i}
                value={u}
                onChange={e => setUrls(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                placeholder={`URL exemple ${i + 1}`}
                className={inputCls}
              />
            ))}
          </div>
        </Field>

        <SubmitBtn label="Créer le plan de contenu" disabled={!keywords.trim()} />
      </form>
    </Overlay>
  );
}
