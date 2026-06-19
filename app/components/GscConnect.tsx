"use client";

import { useState, useEffect } from "react";

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

interface GscMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export default function GscConnect() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sites, setSites] = useState<GscSite[]>([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [metrics, setMetrics] = useState<GscMetrics | null>(null);
  const [topQueries, setTopQueries] = useState<GscQueryRow[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [banner, setBanner] = useState<"connected" | "error" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gscParam = params.get("gsc");
    if (gscParam === "connected" || gscParam === "error") {
      setBanner(gscParam);
      params.delete("gsc");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    }
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/gsc/status");
      const json = await res.json();
      setConnected(!!json.connected);
      setSites(json.sites || []);
      if (json.sites?.length === 1) {
        setSelectedSite(json.sites[0].siteUrl);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetrics(siteUrl: string) {
    setMetricsLoading(true);
    setMetrics(null);
    setTopQueries([]);
    try {
      const res = await fetch(`/api/gsc/metrics?site=${encodeURIComponent(siteUrl)}`);
      const json = await res.json();
      if (res.ok) {
        setMetrics(json.metrics);
        setTopQueries(json.topQueries || []);
      }
    } finally {
      setMetricsLoading(false);
    }
  }

  useEffect(() => {
    if (selectedSite) fetchMetrics(selectedSite);
  }, [selectedSite]);

  async function disconnect() {
    await fetch("/api/gsc/disconnect", { method: "POST" });
    setConnected(false);
    setSites([]);
    setSelectedSite("");
    setMetrics(null);
    setTopQueries([]);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Vérification de la connexion Search Console…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-black">Google Search Console</h3>
        {connected && (
          <button onClick={disconnect} className="text-xs text-gray-500 hover:text-brand transition">
            Déconnecter
          </button>
        )}
      </div>

      {banner === "connected" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Connexion Google Search Console réussie.
        </p>
      )}
      {banner === "error" && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          La connexion à Google Search Console a échoué. Réessaie.
        </p>
      )}

      {!connected ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Connecte ta Search Console pour enrichir l&apos;audit et l&apos;assistant avec tes vraies données de clics, impressions et positions.
          </p>
          <a
            href="/api/gsc/auth"
            className="inline-flex items-center justify-center rounded-lg bg-brand hover:bg-brand-dark text-white px-4 py-2 text-sm font-medium transition"
          >
            Connecter Google Search Console
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.length === 0 && (
            <p className="text-sm text-gray-500">Aucune propriété trouvée pour ce compte Google.</p>
          )}
          {sites.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Propriété</label>
              <select
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
              >
                <option value="">Sélectionner une propriété…</option>
                {sites.map(s => (
                  <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>
                ))}
              </select>
            </div>
          )}

          {metricsLoading && <p className="text-sm text-gray-500">Chargement des données…</p>}

          {metrics && !metricsLoading && (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">Clics (28j)</span>
                  <span className="font-bold text-lg text-brand">{metrics.clicks.toLocaleString("fr-FR")}</span>
                </div>
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">Impressions</span>
                  <span className="font-bold text-lg text-brand">{metrics.impressions.toLocaleString("fr-FR")}</span>
                </div>
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">CTR</span>
                  <span className="font-bold text-lg text-brand">{(metrics.ctr * 100).toFixed(2)}%</span>
                </div>
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">Position moy.</span>
                  <span className="font-bold text-lg text-brand">{metrics.position.toFixed(1)}</span>
                </div>
              </div>

              {topQueries.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-black px-3 pt-3 mb-2">Top requêtes</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand text-white">
                        <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-left">Requête</th>
                        <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-right">Clics</th>
                        <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-right">Impr.</th>
                        <th className="py-2.5 px-3 font-semibold text-xs uppercase tracking-wide text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topQueries.map((q, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50">
                          <td className="py-2 px-3 text-gray-800">{q.query}</td>
                          <td className="py-2 px-3 text-right text-gray-800">{q.clicks}</td>
                          <td className="py-2 px-3 text-right text-gray-800">{q.impressions}</td>
                          <td className="py-2 px-3 text-right text-gray-800">{q.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
