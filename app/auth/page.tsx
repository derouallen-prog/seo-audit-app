"use client";
import { useState } from "react";
import Link from "next/link";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: data.error ?? "Une erreur est survenue." });
    } else if (mode === "login") {
      window.location.href = "/dashboard";
    } else {
      setMessage({
        type: "success",
        text: "Compte créé ! Vérifiez votre email pour confirmer votre inscription.",
      });
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-hairline bg-white p-8 shadow-sm">
          <h1 className="font-display text-2xl text-ink mb-1">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="text-sm text-ink-soft mb-6">
            {mode === "login"
              ? "Accédez à vos audits et à l'historique de vos analyses."
              : "Gratuit, sans carte bancaire."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">Mot de passe</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
              />
            </div>

            {message && (
              <div className={`rounded-lg px-3 py-2 text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-ink-soft">
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <button onClick={() => { setMode("register"); setMessage(null); }} className="text-brand hover:underline font-medium">
                  S&apos;inscrire
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <button onClick={() => { setMode("login"); setMessage(null); }} className="text-brand hover:underline font-medium">
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-soft">
          <Link href="/" className="hover:text-brand">← Retour à l&apos;accueil</Link>
        </p>
      </div>
    </div>
  );
}
