"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface SiteConnection {
  id: string;
  storeUrl: string;
  label?: string;
  isDefault: boolean;
  wpUsername?: string;
  hasProfile: boolean;
  seoPlugin?: string;
  seoCompatStatus?: string;
}

interface ConnectionsResponse {
  connected: boolean;
  connections: SiteConnection[];
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

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
  );
}

function IconSpin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<SiteConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bridgeToken, setBridgeToken] = useState<string | null>(null);
  const [bookmarkletUrl, setBookmarkletUrl] = useState<string>("");
  const [bridgeCopied, setBridgeCopied] = useState(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [compatCheckingId, setCompatCheckingId] = useState<string | null>(null);

  const hasConnections = connections.length > 0;

  useEffect(() => {
    if (bookmarkletRef.current && bookmarkletUrl) {
      bookmarkletRef.current.setAttribute("href", bookmarkletUrl);
    }
  }, [bookmarkletUrl]);

  const loadBridgeToken = useCallback(async () => {
    try {
      const res = await fetch("/api/wp/bridge-token");
      if (!res.ok) return;
      const data = await res.json() as { token: string };
      setBridgeToken(data.token);
      const t = data.token;
      const a = window.location.origin;
      const code = `(function(){`
        + `var t="${t}",a="${a}";`
        + `if(window.__mbA){return;}window.__mbA=1;`
        + `localStorage.setItem("__mb",t);`
        + `var b=document.createElement("div");`
        + `b.id="__mb_b";`
        + `b.style="position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#7c3aed;color:#fff;border-radius:12px;padding:8px 14px;font-size:13px;font-family:system-ui;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,.3)";`
        + `b.innerHTML='<span id="__mb_d" style="width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0"></span><span id="__mb_l">Mind Bridge actif</span><span style="margin-left:6px;cursor:pointer;opacity:.7;font-size:17px" onclick="clearInterval(window.__mbI);this.parentNode.remove();window.__mbA=0">×</span>';`
        + `document.body.appendChild(b);`
        + `function upd(ok,msg){var d=document.getElementById("__mb_d"),l=document.getElementById("__mb_l");if(d)d.style.background=ok===null?"#facc15":ok?"#4ade80":"#f87171";if(l)l.textContent=msg||(ok===null?"Exécution…":"Mind Bridge actif");}`
        + `function ex(s){upd(null);var ok=true,res="ok";try{eval(s.script);}catch(e){ok=false;res=String(e);}fetch(a+"/api/wp/bridge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:t,id:s.id,success:ok,result:res})}).catch(function(){});upd(ok,ok?"✓ Script exécuté":"✗ "+res.slice(0,60));setTimeout(function(){upd(true,"Mind Bridge actif");},6000);}`
        + `window.__mbI=setInterval(function(){fetch(a+"/api/wp/bridge?token="+encodeURIComponent(t)).then(function(r){return r.json();}).then(function(data){(data.scripts||[]).forEach(ex);}).catch(function(){});},2000);`
        + `})();`;
      setBookmarkletUrl("javascript:" + code);
    } catch { /* ignore */ }
  }, []);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  async function reload() {
    const res = await fetch("/api/wc/connection");
    const data = await res.json() as ConnectionsResponse;
    setConnections(data.connections ?? []);
    if (data.connected) loadBridgeToken();
  }

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") showToast("success", "WordPress connecté avec succès !");
    else if (error === "rejected") showToast("error", "Connexion annulée.");
    else if (error) showToast("error", "Erreur lors de la connexion. Réessayez.");

    reload().finally(() => setLoading(false));

    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect(id: string) {
    await fetch(`/api/wc/connection?id=${id}`, { method: "DELETE" });
    await reload();
    showToast("success", "Site déconnecté.");
  }

  async function handleSetDefault(id: string) {
    await fetch("/api/wc/connection", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await reload();
    showToast("success", "Site par défaut mis à jour.");
  }

  async function handleCompatCheck(site: SiteConnection) {
    setCompatCheckingId(site.id);
    try {
      const res = await fetch("/api/wc/compat-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeUrl: site.storeUrl }),
      });
      if (res.ok) {
        await reload();
        showToast("success", "Test de compatibilité SEO terminé.");
      } else {
        showToast("error", "Erreur lors du test de compatibilité.");
      }
    } catch {
      showToast("error", "Erreur lors du test de compatibilité.");
    } finally {
      setCompatCheckingId(null);
    }
  }

  async function handleScan(id: string) {
    setScanningId(id);
    try {
      const res = await fetch(`/api/wc/scan?id=${id}`, { method: "POST" });
      if (res.ok) {
        setScannedIds((s) => new Set([...s, id]));
        showToast("success", "Analyse du thème terminée — l'assistant connaît la structure de ce site.");
        await reload();
      } else {
        showToast("error", "Erreur lors de l'analyse du thème.");
      }
    } catch {
      showToast("error", "Erreur lors de l'analyse du thème.");
    } finally {
      setScanningId(null);
    }
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
        <div className={`fixed right-6 top-20 z-50 flex items-center gap-3 rounded-xl border px-5 py-3.5 shadow-lg text-sm font-medium transition-all ${toast.type === "success" ? "border-good/30 bg-good/10 text-good" : "border-bad/30 bg-bad/10 text-bad"}`}>
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

      {/* WordPress / WooCommerce section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">CMS connectés</h2>
          {hasConnections && (
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-accent"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Ajouter un site
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-hairline bg-background shadow-sm">
          {/* En-tête de la carte */}
          <div className="flex items-center gap-4 p-6 pb-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-hairline bg-[#21759B]/10 text-[#21759B]">
              <WordPressLogo />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">WordPress / WooCommerce</span>
                {hasConnections && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good">
                    <span className="h-1.5 w-1.5 rounded-full bg-good" />
                    {connections.length} site{connections.length > 1 ? "s" : ""} connecté{connections.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">
                Publiez articles, pages et fiches produits WooCommerce directement depuis l&apos;assistant.
              </p>
            </div>
          </div>

          {/* Liste des sites connectés */}
          {loading ? (
            <div className="border-t border-hairline px-6 py-4">
              <div className="h-16 animate-pulse rounded-xl bg-accent" />
            </div>
          ) : hasConnections ? (
            <div className="border-t border-hairline divide-y divide-hairline">
              {connections.map((site) => (
                <div key={site.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate text-sm font-medium text-ink">{site.label ?? site.storeUrl}</span>
                      {site.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                          ★ Défaut
                        </span>
                      )}
                      {site.hasProfile && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-ink-soft">
                          ✓ Thème analysé
                        </span>
                      )}
                      {/* SEO compat badge */}
                      {site.seoCompatStatus === "compatible_direct" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-xs font-medium text-good">
                          <span className="h-1.5 w-1.5 rounded-full bg-good" />
                          SEO opérationnel
                        </span>
                      )}
                      {site.seoCompatStatus === "needs_connector_plugin" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                          ⚠ Plugin requis
                        </span>
                      )}
                      {site.seoCompatStatus === "seo_not_detected" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-ink-soft">
                          Plugin SEO non détecté
                        </span>
                      )}
                      {(site.seoCompatStatus === "checking") && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-xs text-ink-soft">
                          <IconSpin className="h-3 w-3 animate-spin" /> Vérification…
                        </span>
                      )}
                    </div>
                    {site.label && (
                      <p className="mt-0.5 truncate text-xs text-ink-soft">{site.storeUrl}</p>
                    )}
                    {site.wpUsername && (
                      <p className="mt-0.5 text-xs text-ink-soft">{site.wpUsername}</p>
                    )}
                    {/* Plugin requis — CTA */}
                    {site.seoCompatStatus === "needs_connector_plugin" && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2.5 text-xs text-ink-soft">
                        <span className="mt-0.5 shrink-0">⚠</span>
                        <div>
                          <span className="font-medium text-ink">Les champs SEO ne sont pas accessibles via REST.</span>
                          {" "}Installez le plugin connecteur Search Mind pour activer la mise à jour automatique des balises.{" "}
                          <a
                            href="/downloads/searchmind-connector.zip"
                            download
                            className="font-medium text-brand hover:underline"
                          >
                            Télécharger le plugin →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Test compatibilité SEO */}
                    {(site.seoCompatStatus === "unchecked" || site.seoCompatStatus === "needs_connector_plugin" || site.seoCompatStatus === "seo_not_detected") && (
                      <button
                        onClick={() => handleCompatCheck(site)}
                        disabled={compatCheckingId === site.id}
                        title="Tester la compatibilité SEO"
                        className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {compatCheckingId === site.id ? (
                          <IconSpin className="h-3 w-3 animate-spin" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                          </svg>
                        )}
                        Tester SEO
                      </button>
                    )}
                    {/* Analyser thème */}
                    <button
                      onClick={() => handleScan(site.id)}
                      disabled={scanningId === site.id}
                      title={site.hasProfile ? "Ré-analyser le thème" : "Analyser la structure du thème"}
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {scanningId === site.id ? (
                        <IconSpin className="h-3 w-3 animate-spin" />
                      ) : (
                        <IconRefresh className="h-3 w-3" />
                      )}
                      {scannedIds.has(site.id) ? "Ré-analyser" : site.hasProfile ? "Ré-analyser" : "Analyser"}
                    </button>
                    {/* Définir par défaut */}
                    {!site.isDefault && connections.length > 1 && (
                      <button
                        onClick={() => handleSetDefault(site.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-accent"
                      >
                        Définir par défaut
                      </button>
                    )}
                    {/* Déconnecter */}
                    <button
                      onClick={() => handleDisconnect(site.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:border-bad/40 hover:text-bad"
                    >
                      Déconnecter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Formulaire d'ajout */}
          {(!loading && (!hasConnections || showAddForm)) && (
            <div className={hasConnections ? "border-t border-hairline" : ""}>
              <form onSubmit={handleConnect} className="px-6 py-6">
                {!hasConnections && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-ink">Connecter votre WordPress</h3>
                    <p className="mt-1 text-xs text-ink-soft">
                      Flux d&apos;autorisation natif WordPress (Application Passwords, WP 5.6+). Aucune clé API à copier.
                    </p>
                  </div>
                )}
                {hasConnections && (
                  <h3 className="mb-3 text-sm font-medium text-ink">Connecter un autre site</h3>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="site_url" className="mb-1.5 block text-xs font-medium text-ink">
                      URL du site WordPress
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
                  <div className="flex gap-2">
                    {hasConnections && (
                      <button
                        type="button"
                        onClick={() => { setShowAddForm(false); setSiteUrl(""); }}
                        className="rounded-lg border border-hairline px-4 py-2.5 text-sm text-ink-soft hover:bg-accent"
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Connecter
                    </button>
                  </div>
                </div>
                {!hasConnections && (
                  <>
                    <p className="mt-3 text-xs text-ink-soft">
                      Vous serez redirigé vers votre admin WordPress pour approuver l&apos;accès. Aucune clé API, aucun plugin requis.
                    </p>
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        {
                          n: "1",
                          title: "Entrez votre URL",
                          desc: "L'adresse de votre site WordPress (ex. monsite.fr).",
                          icon: (
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
                          ),
                        },
                        {
                          n: "2",
                          title: "Autorisez en un clic",
                          desc: "WordPress affiche un écran de confirmation — approuvez, Search Mind reçoit l'accès automatiquement.",
                          icon: (
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                          ),
                        },
                        {
                          n: "3",
                          title: "Test SEO automatique",
                          desc: "Search Mind détecte votre plugin SEO (Yoast, Rank Math…) et vérifie que les balises sont accessibles en écriture.",
                          icon: (
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
                          ),
                        },
                      ].map((s) => (
                        <div key={s.n} className="flex gap-3 rounded-xl bg-accent/60 p-4">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{s.n}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">{s.icon}{s.title}</div>
                            <div className="mt-0.5 text-xs text-ink-soft">{s.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-hairline bg-background p-3 text-xs text-ink-soft">
                      <span className="mt-0.5 shrink-0">ℹ</span>
                      <span>
                        <span className="font-medium text-ink">À propos de l&apos;indicateur Yoast dans votre admin WP :</span>
                        {" "}une balise mise à jour via Search Mind est <span className="font-medium text-ink">immédiatement active sur votre site</span> (le titre et la meta description sont corrects pour Google). L&apos;indicateur visuel dans l&apos;éditeur WordPress peut rester grisé tant que la page n&apos;a pas été rouverte manuellement — c&apos;est un comportement normal de Yoast, pas un problème.
                      </span>
                    </div>
                  </>
                )}
              </form>
            </div>
          )}
        </div>
      </section>

      {/* WooCommerce note */}
      {hasConnections && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-hairline bg-accent/40 p-4 text-sm text-ink-soft">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-background text-[#7F54B3]">
            <WooCommerceLogo />
          </div>
          <div>
            <span className="font-medium text-ink">WooCommerce inclus</span> — si votre site utilise WooCommerce, l&apos;assistant peut créer et mettre à jour des fiches produit avec la même connexion. L&apos;assistant connaît automatiquement la structure de votre thème (champs ACF, Yoast, répéteurs) grâce à l&apos;analyse de thème.
          </div>
        </div>
      )}

      {/* Plugin connecteur WordPress */}
      {connections.some((c) => c.seoCompatStatus === "needs_connector_plugin") && (
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-soft">Plugin connecteur WordPress</h2>
          <div className="rounded-2xl border border-warning/30 bg-background p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-xl">🔌</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">Search Mind Connector</span>
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">Requis</span>
                </div>
                <p className="mt-1 max-w-lg text-sm text-ink-soft">
                  Votre plugin SEO n&apos;expose pas ses champs via l&apos;API REST WordPress (souvent causé par Elementor ou un builder de page). Ce plugin les rend accessibles en écriture, sans modifier votre thème.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-hairline pt-6">
              <h3 className="mb-4 text-sm font-medium text-ink">Installation en 3 étapes</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { n: "1", title: "Téléchargez le plugin", desc: "Cliquez sur le bouton ci-dessous pour obtenir le fichier .zip." },
                  { n: "2", title: "Installez dans WordPress", desc: "Extensions → Ajouter une extension → Téléverser → Activer." },
                  { n: "3", title: "Relancez le test SEO", desc: "Revenez ici et cliquez « Tester SEO » — le statut passera au vert." },
                ].map((s) => (
                  <div key={s.n} className="flex gap-3 rounded-xl bg-accent/60 p-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-white">{s.n}</span>
                    <div>
                      <div className="text-xs font-semibold text-ink">{s.title}</div>
                      <div className="mt-0.5 text-xs text-ink-soft">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <a
                  href="/downloads/searchmind-connector.zip"
                  download
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Télécharger searchmind-connector.zip
                </a>
                <span className="text-xs text-ink-soft">Plugin léger — open source, aucune donnée collectée</span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent/40 p-3 text-xs text-ink-soft">
              <span className="mt-0.5">ℹ</span>
              <span>
                Le plugin enregistre les champs meta de votre plugin SEO (Yoast, Rank Math, AIOSEO, SEOPress) en REST et expose un endpoint{" "}
                <code className="rounded bg-accent px-1 py-0.5 font-mono text-[11px]">searchmind/v1/update-meta</code>{" "}
                authentifié par clé API. Une fois activé, relancez le test de compatibilité — aucune autre configuration n&apos;est nécessaire.
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Mind Bridge */}
      {hasConnections && (
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-soft">Exécution dans le navigateur</h2>
          <div className="rounded-2xl border border-hairline bg-background p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-hairline bg-brand/10 text-brand text-xl">⚡</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">Mind Bridge</span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">Bookmarklet</span>
                </div>
                <p className="mt-1 max-w-lg text-sm text-ink-soft">
                  Permet à l&apos;assistant d&apos;exécuter des scripts JavaScript directement dans votre navigateur sur les pages WP Admin — pour les cas que l&apos;API REST ne couvre pas.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-hairline pt-6">
              <h3 className="mb-4 text-sm font-medium text-ink">Installation en 2 étapes</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { n: "1", title: "Glissez le bouton dans vos favoris", desc: "Faites glisser le bouton violet ci-dessous vers la barre de favoris de votre navigateur." },
                  { n: "2", title: "Cliquez dessus sur une page WP Admin", desc: "Sur n'importe quelle page WP Admin, cliquez sur le favori — un badge violet apparaît en bas à droite." },
                ].map((s) => (
                  <div key={s.n} className="flex gap-3 rounded-xl bg-accent/60 p-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{s.n}</span>
                    <div>
                      <div className="text-xs font-semibold text-ink">{s.title}</div>
                      <div className="mt-1 text-xs text-ink-soft">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                {bookmarkletUrl ? (
                  <a
                    ref={bookmarkletRef}
                    className="inline-flex cursor-grab items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:cursor-grabbing select-none"
                    onClick={(e) => e.preventDefault()}
                    draggable
                  >
                    <span>⚡</span>Mind Bridge
                  </a>
                ) : (
                  <div className="h-10 w-36 animate-pulse rounded-xl bg-accent" />
                )}
                <span className="text-xs text-ink-soft">← Glissez ce bouton vers votre barre de favoris</span>
              </div>

              {bridgeToken && (
                <div className="mt-4">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(bookmarkletUrl);
                      setBridgeCopied(true);
                      setTimeout(() => setBridgeCopied(false), 2000);
                    }}
                    className="text-xs text-ink-soft underline underline-offset-2 hover:text-ink transition-colors"
                  >
                    {bridgeCopied ? "✓ Copié !" : "Ou copier le code du bookmarklet"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent/40 p-3 text-xs text-ink-soft">
              <span className="mt-0.5">ℹ️</span>
              <span>Mind Bridge ne fonctionne que sur les pages où vous l&apos;avez activé. Il s&apos;exécute dans votre navigateur, en utilisant votre session WP Admin — aucun accès supplémentaire n&apos;est accordé.</span>
            </div>
          </div>
        </section>
      )}

      {/* Coming soon */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-soft">Bientôt disponibles</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COMING_SOON.map((p) => (
            <div key={p.name} className="flex items-center gap-4 rounded-2xl border border-hairline bg-background p-5 opacity-60">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: p.color }}>
                {p.icon}
              </div>
              <div>
                <div className="font-semibold text-ink">{p.name}</div>
                <div className="mt-0.5 text-xs text-ink-soft">{p.desc}</div>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-ink-soft">Bientôt</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-accent" />
        <div className="mt-4 h-4 w-72 animate-pulse rounded-lg bg-accent" />
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}
