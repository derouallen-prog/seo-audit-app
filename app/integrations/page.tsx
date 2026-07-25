"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

interface ConnectionInfo {
  connected: boolean;
  storeUrl?: string;
  wpUsername?: string;
}

function WordPressLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.187 12c0-1.393.298-2.718.821-3.919l4.52 12.386A8.794 8.794 0 0 1 3.187 12zm8.813 8.813a8.776 8.776 0 0 1-2.512-.367l2.669-7.751 2.736 7.495a.837.837 0 0 0 .064.124 8.773 8.773 0 0 1-2.957.499zm1.216-12.98c.53-.028.01-.997-.52-.968 0 0-1.476.11-2.428.11-.895 0-2.402-.11-2.402-.11-.531-.03-.554.971-.022.97 0 0 .491-.041.994-.041l1.477 4.048-2.075 6.22-3.453-10.268c.531-.028.011-.997-.52-.968 0 0-1.476.11-2.428.11a9.06 9.06 0 0 0-.313.006A8.81 8.81 0 0 1 12 3.188c2.269 0 4.34.857 5.899 2.263-.037-.002-.073-.006-.111-.006-.895 0-1.529.778-1.529 1.613 0 .75.432 1.385.895 2.135.346.607.753 1.385.753 2.511 0 .779-.3 1.684-.69 2.943l-.904 3.019-3.097-9.213zm3.648 11.979l2.72-7.86c.507-1.268.676-2.282.676-3.185 0-.327-.022-.63-.061-.915A8.812 8.812 0 0 1 20.813 12a8.77 8.77 0 0 1-3.949 7.312z" />
    </svg>
  );
}

function WooCommerceLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
      <path d="M2.285 3.056C1.173 3.056.266 3.963.266 5.075v9.715c0 1.112.907 2.019 2.019 2.019h6.646l-.858 2.578 3.946-2.578h9.715c1.112 0 2.019-.907 2.019-2.019V5.075c0-1.112-.907-2.019-2.019-2.019H2.285zm2.109 2.715c.39-.012.748.226.885.593l1.425 3.815 1.555-2.975c.198-.38.59-.598 1.002-.558.411.04.757.326.882.727l1.011 3.369.959-1.918c.197-.394.619-.614 1.054-.546.435.068.768.421.811.86.044.437-.217.851-.629 1.004L11.72 12.5c-.196.078-.412.09-.615.033a.981.981 0 0 1-.49-.314.979.979 0 0 1-.208-.529l-.627-2.09-1.324 2.534c-.186.357-.556.572-.96.564a1.057 1.057 0 0 1-.94-.62L5.49 8.415l-.617 3.083c-.095.474-.528.808-1.01.782-.481-.026-.874-.404-.92-.884-.01-.106.003-.212.038-.312l1.05-5.25a.988.988 0 0 1 .363-.063zm10.714 0c1.23 0 2.225.997 2.225 2.225 0 1.228-.995 2.225-2.225 2.225-1.229 0-2.225-.997-2.225-2.225 0-1.228.996-2.225 2.225-2.225zm0 1.112c-.614 0-1.112.498-1.112 1.113 0 .614.498 1.112 1.112 1.112.615 0 1.113-.498 1.113-1.112 0-.615-.498-1.113-1.113-1.113z" />
    </svg>
  );
}

const COMING_SOON = [
  { name: "Shopify", color: "#96BF48", icon: "S", desc: "Boutique e-commerce Shopify" },
  { name: "Webflow", color: "#4353FF", icon: "W", desc: "Sites et CMS Webflow" },
  { name: "Wix", color: "#FAAD00", icon: "Wix", desc: "Sites Wix" },
];

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [conn, setConn] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteUrl, setSiteUrl] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") showToast("success", "WordPress connecté avec succès !");
    else if (error === "rejected") showToast("error", "Connexion annulée.");
    else if (error) showToast("error", "Erreur lors de la connexion. Réessayez.");

    fetch("/api/wc/connection")
      .then((r) => r.json())
      .then((data: ConnectionInfo) => setConn(data))
      .catch(() => setConn({ connected: false }))
      .finally(() => setLoading(false));

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    await fetch("/api/wc/connection", { method: "DELETE" });
    setConn({ connected: false });
    showToast("success", "WordPress déconnecté.");
  }

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const url = siteUrl.trim();
    if (!url) return;
    const authUrl = new URL("/api/wp/auth", window.location.origin);
    authUrl.searchParams.set("site_url", url);
    window.location.href = authUrl.toString();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-20 z-50 flex items-center gap-3 rounded-xl border px-5 py-3.5 shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "border-good/30 bg-good/10 text-good"
              : "border-bad/30 bg-bad/10 text-bad"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl text-ink">Intégrations</h1>
        <p className="mt-2 text-ink-soft">
          Connectez vos outils pour publier du contenu directement depuis l&apos;assistant.
        </p>
      </div>

      {/* WordPress card */}
      <section className="mb-8">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-soft">CMS disponibles</h2>
        <div className="rounded-2xl border border-hairline bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: info */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-hairline bg-[#21759B]/10 text-[#21759B]">
                <WordPressLogo />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">WordPress</span>
                  {conn?.connected && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good">
                      <span className="h-1.5 w-1.5 rounded-full bg-good" />
                      Connecté
                    </span>
                  )}
                </div>
                <p className="mt-1 max-w-sm text-sm text-ink-soft">
                  Publiez articles, pages et fiches produits WooCommerce en brouillon directement depuis l&apos;assistant — sans quitter l&apos;app.
                </p>
                {conn?.connected && conn.storeUrl && (
                  <p className="mt-2 text-xs text-ink-soft">
                    <span className="font-medium text-ink">{conn.storeUrl}</span>
                    {conn.wpUsername ? ` · ${conn.wpUsername}` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Right: action */}
            <div className="shrink-0">
              {loading ? (
                <div className="h-10 w-28 animate-pulse rounded-lg bg-accent" />
              ) : conn?.connected ? (
                <button
                  onClick={handleDisconnect}
                  className="rounded-lg border border-hairline px-4 py-2 text-sm text-ink-soft transition-colors hover:border-bad/40 hover:text-bad"
                >
                  Déconnecter
                </button>
              ) : null}
            </div>
          </div>

          {/* Connection form — shown when not connected */}
          {!loading && !conn?.connected && (
            <form onSubmit={handleConnect} className="mt-6 border-t border-hairline pt-6">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-ink">Connecter votre WordPress</h3>
                <p className="mt-1 text-xs text-ink-soft">
                  Utilisez le flux d&apos;autorisation natif WordPress (Application Passwords, disponible depuis WP 5.6). Aucune clé API à copier.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="site_url" className="mb-1.5 block text-xs font-medium text-ink">
                    URL de votre site
                  </label>
                  <input
                    id="site_url"
                    type="url"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://votresite.com"
                    required
                    className="w-full rounded-lg border border-hairline bg-background px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  Connecter WordPress
                </button>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                Vous serez redirigé vers votre admin WordPress pour approuver l&apos;accès. Aucune clé API, aucun plugin requis.
              </p>
            </form>
          )}

          {/* Steps guide — shown when not connected */}
          {!loading && !conn?.connected && (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { n: "1", title: "Entrez votre URL", desc: "L'adresse de votre site WordPress self-hosted." },
                { n: "2", title: "Autorisez dans WP", desc: "WordPress affiche un écran de confirmation — un clic suffit." },
                { n: "3", title: "Publiez depuis l'assistant", desc: "Articles, pages, fiches produit WooCommerce — en brouillon." },
              ].map((s) => (
                <div key={s.n} className="flex gap-3 rounded-xl bg-accent/60 p-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    {s.n}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-ink">{s.title}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* WooCommerce note */}
      {conn?.connected && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-hairline bg-accent/40 p-4 text-sm text-ink-soft">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-background text-[#7F54B3]">
            <WooCommerceLogo />
          </div>
          <div>
            <span className="font-medium text-ink">WooCommerce inclus</span> — si votre site utilise WooCommerce, l&apos;assistant peut également créer des fiches produit et des catégories de produits en brouillon avec la même connexion.
          </div>
        </div>
      )}

      {/* Coming soon */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-soft">Bientôt disponibles</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COMING_SOON.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-4 rounded-2xl border border-hairline bg-background p-5 opacity-60"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.icon}
              </div>
              <div>
                <div className="font-semibold text-ink">{p.name}</div>
                <div className="mt-0.5 text-xs text-ink-soft">{p.desc}</div>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-ink-soft">
                Bientôt
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-accent" />
          <div className="mt-4 h-4 w-72 animate-pulse rounded-lg bg-accent" />
        </div>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
