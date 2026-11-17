"use client";

import { useEffect, useState } from "react";
import { ONBOARDING_DRAFT_KEY } from "@/lib/onboardingDraft";

type Status = "saving" | "error";

export default function OnboardingCompletePage() {
  const [status, setStatus] = useState<Status>("saving");

  useEffect(() => {
    let draftRaw: string | null = null;
    try { draftRaw = localStorage.getItem(ONBOARDING_DRAFT_KEY); } catch { /* stockage indisponible */ }

    if (!draftRaw) {
      // Lien ouvert sur un autre appareil/navigateur : pas de brouillon local, on relance
      // l'onboarding plutôt que d'afficher un échec — l'analyse est rapide et gratuite à refaire.
      window.location.href = "/onboarding";
      return;
    }

    fetch("/api/onboarding/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: draftRaw,
    })
      .then(res => {
        if (!res.ok) throw new Error("save_failed");
        try { localStorage.removeItem(ONBOARDING_DRAFT_KEY); } catch { /* stockage indisponible */ }
        window.location.href = "/?welcome=1";
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        {status === "saving" ? (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm text-ink-soft">Récupération de ton analyse…</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">L&apos;enregistrement a échoué.</p>
            <a href="/onboarding" className="mt-2 inline-block text-sm text-brand hover:underline">Relancer l&apos;onboarding</a>
          </>
        )}
      </div>
    </div>
  );
}
