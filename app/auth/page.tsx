"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function AuthForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
    } else if (mode === "login") {
      window.location.href = redirect;
    } else {
      setSignupDone(true);
    }
    setLoading(false);
  }

  if (signupDone) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-hairline bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-50">
            <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h1 className="font-display text-xl text-ink mb-2">Vérifiez votre email</h1>
          <p className="text-sm text-ink-soft mb-6">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>. Cliquez dessus pour activer votre compte.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition"
          >
            Retour à l&apos;accueil
          </Link>
          <p className="mt-4 text-xs text-ink-soft">
            Déjà confirmé ?{" "}
            <button onClick={() => { setSignupDone(false); setMode("login"); }} className="text-brand hover:underline">
              Se connecter
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
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

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
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
              <button onClick={() => { setMode("register"); setError(null); }} className="text-brand hover:underline font-medium">
                S&apos;inscrire
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{" "}
              <button onClick={() => { setMode("login"); setError(null); }} className="text-brand hover:underline font-medium">
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
  );
}

export default function AuthPage() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
      <Suspense fallback={null}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
