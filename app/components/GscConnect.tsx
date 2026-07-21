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

interface GscDimensionRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const DEVICE_LABELS: Record<string, string> = {
  DESKTOP: "🖥️ Ordinateur",
  MOBILE: "📱 Mobile",
  TABLET: "📲 Tablette",
};

const PERIODS = [
  { label: "7 jours", value: 7 },
  { label: "28 jours", value: 28 },
  { label: "90 jours", value: 90 },
];

export default function GscConnect() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sites, setSites] = useState<GscSite[]>([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [days, setDays] = useState(28);
  const [metrics, setMetrics] = useState<GscMetrics | null>(null);
  const [topQueries, setTopQueries] = useState<GscQueryRow[]>([]);
  const [topPages, setTopPages] = useState<GscDimensionRow[]>([]);
  const [devices, setDevices] = useState<GscDimensionRow[]>([]);
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

  async function fetchMetrics(siteUrl: string, period: number) {
    setMetricsLoading(true);
    setMetrics(null);
    setTopQueries([]);
    setTopPages([]);
    setDevices([]);
    try {
      const res = await fetch(`/api/gsc/metrics?site=${encodeURIComponent(siteUrl)}&days=${period}`);
      const json = await res.json();
      if (res.ok) {
        setMetrics(json.metrics);
        setTopQueries(json.topQueries || []);
        setTopPages(json.topPages || []);
        setDevices(json.devices || []);
      }
    } finally {
      setMetricsLoading(false);
    }
  }

  useEffect(() => {
    if (selectedSite) fetchMetrics(selectedSite, days);
  }, [selectedSite, days]);

  async function disconnect() {
    await fetch("/api/gsc/disconnect", { method: "POST" });
    setConnected(false);
    setSites([]);
    setSelectedSite("");
    setMetrics(null);
    setTopQueries([]);
    setTopPages([]);
    setDevices([]);
  }

  const totalDeviceClicks = devices.reduce((sum, d) => sum + d.clicks, 0);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <p className="text-sm text-gray-500">Vérification de la connexion Search Console…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
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
            className="inline-flex items-center justify-center rounded-lg bg-brand hover:bg-brand-dark text-white px-4 py-2 text-sm font-medium transition w-full sm:w-auto"
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
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
              {selectedSite && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Période</label>
                  <select
                    value={days}
                    onChange={e => setDays(parseInt(e.target.value, 10))}
                    className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                  >
                    {PERIODS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {metricsLoading && <p className="text-sm text-gray-500">Chargement des données…</p>}

          {metrics && !metricsLoading && (
            <>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div className="rounded-lg bg-brand/5 border border-brand/20 p-3">
                  <span className="text-gray-500 block text-xs">Clics ({days}j)</span>
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

              {/* Répartition par device */}
              {devices.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <h4 className="text-sm font-semibold text-black">Répartition par device</h4>
                  {devices.map((d) => {
                    const pct = totalDeviceClicks > 0 ? (d.clicks / totalDeviceClicks) * 100 : 0;
                    return (
                      <div key={d.key} className="text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-700">{DEVICE_LABELS[d.key] || d.key}</span>
                          <span className="text-gray-500">{d.clicks.toLocaleString("fr-FR")} clics ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-brand h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {topQueries.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-black px-3 pt-3 mb-2">Top requêtes</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand text-white">
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-left">Requête</th>
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-right">Clics</th>
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-right">Impr.</th>
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topQueries.map((q, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50">
                          <td className="py-1.5 px-2 sm:px-3 text-gray-800">{q.query}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-right text-gray-800">{q.clicks}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-right text-gray-800">{q.impressions}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-right text-gray-800">{q.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {topPages.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-black px-3 pt-3 mb-2">Top pages</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand text-white">
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-left">Page</th>
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-right">Clics</th>
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-right">Impr.</th>
                        <th className="py-2 px-2 sm:px-3 font-semibold text-xs uppercase tracking-wide text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPages.map((p, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50">
                          <td className="py-1.5 px-2 sm:px-3 text-gray-800 break-all text-xs">{p.key}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-right text-gray-800">{p.clicks}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-right text-gray-800">{p.impressions}</td>
                          <td className="py-1.5 px-2 sm:px-3 text-right text-gray-800">{p.position.toFixed(1)}</td>
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
