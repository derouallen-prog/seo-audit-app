"use client";
import { useState } from "react";
import { generateMarkdown } from "@/lib/generateMarkdown";
import { computeScore } from "@/lib/score";
import type { Analysis } from "@/lib/types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugHost(url: string) {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; }
  catch { return "audit"; }
}

export default function ExportMenu({ url, data }: { url: string; data: Analysis }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleMarkdown() {
    const { score, grade } = computeScore(data);
    const md = generateMarkdown(url, data, score, grade);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `audit-seo-${slugHost(url)}-${date}.md`);
  }

  async function handlePdf() {
    setPdfLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, data }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erreur lors de la génération du PDF");
      }
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `audit-seo-${slugHost(url)}-${date}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleMarkdown}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-accent"
        title="Télécharger le rapport en Markdown"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        .md
      </button>

      <button
        onClick={handlePdf}
        disabled={pdfLoading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-accent disabled:opacity-60"
        title="Télécharger le rapport en PDF"
      >
        {pdfLoading ? (
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 18 15 15"/>
          </svg>
        )}
        {pdfLoading ? "Génération…" : ".pdf"}
      </button>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
