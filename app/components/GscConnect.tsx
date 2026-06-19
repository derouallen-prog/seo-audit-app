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
      <div className="rounded-xl border p-6">
        <p className="text-sm text-gray-500">Vérification de la connexion Search Console…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Google Search Console</h3>
        {connected && (
          <button onClick={disconnect} className="text-xs text-gray-400 hover:text-white transition">
            Déconnecter
          </button>
        )}
      </div>

      {banner === "connected" && (
        <p className="text-sm text-green-400 bg-green-950/20 border border-green-800/40 rounded-lg px-3 py-2">
          Connexion Google Search Console réussie.
        </p>
      )}
      {banner === "error" && (
        <p className="text-sm text-red-400 bg-red-950/20 border border-red-800/40 rounded-lg px-3 py-2">
          La connexion à Google Search Console a échoué. Réessaie.
        </p>
      )}

      {!connected ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Connecte ta Search Console pour enrichir l&apos;audit et l&apos;assistant avec tes vraies données de clics, impressions et positions.
          </p>
          <a
            href="/api/gsc/auth"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium transition"
          >
            Connecter Google Search Console
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.length === 0 && (
            <p className="text-sm text-gray-400">Aucune propriété trouvée pour ce compte Google.</p>
          )}
          {sites.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Propriété</label>
              <select
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-neutral-900 px-3 py-2 text-sm text-white"
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
                <div><span className="text-gray-500 block text-xs">Clics (28j)</span><span className="font-medium text-lg text-white">{metrics.clicks.toLocaleString("fr-FR")}</span></div>
                <div><span className="text-gray-500 block text-xs">Impressions</span><span className="font-medium text-lg text-white">{metrics.impressions.toLocaleString("fr-FR")}</span></div>
                <div><span className="text-gray-500 block text-xs">CTR</span><span className="font-medium text-lg text-white">{(metrics.ctr * 100).toFixed(2)}%</span></div>
                <div><span className="text-gray-500 block text-xs">Position moy.</span><span className="font-medium text-lg text-white">{metrics.position.toFixed(1)}</span></div>
              </div>

              {topQueries.length > 0 && (
                <div className="overflow-x-auto">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Top requêtes</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-700">
                        <th className="pb-2 pr-4 font-medium">Requête</th>
                        <th className="pb-2 pr-4 font-medium text-right">Clics</th>
                        <th className="pb-2 pr-4 font-medium text-right">Impr.</th>
                        <th className="pb-2 font-medium text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topQueries.map((q, i) => (
                        <tr key={i} className="border-b border-gray-800 last:border-0">
                          <td className="py-1.5 pr-4">{q.query}</td>
                          <td className="py-1.5 pr-4 text-right">{q.clicks}</td>
                          <td className="py-1.5 pr-4 text-right">{q.impressions}</td>
                          <td className="py-1.5 text-right">{q.position.toFixed(1)}</td>
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
