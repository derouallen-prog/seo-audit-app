"use client";
import React from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div className="mx-auto max-w-2xl p-6">
          <h2 className="text-lg font-semibold mb-2">Une erreur est survenue</h2>
          <p className="text-sm text-red-600 mb-4">
            {error?.message || "Erreur inconnue."}
          </p>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-black text-white px-4 py-2"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

