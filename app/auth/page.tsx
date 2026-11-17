"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import Button from "@/app/components/Button";

function AuthForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirect)}` },
    });

    if (error) setError(error.message || "Une erreur est survenue.");
    else setLinkSent(true);
    setLoading(false);
  }

  if (linkSent) {
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
            Un lien de connexion a été envoyé à <strong>{email}</strong>. Cliquez dessus pour accéder à votre espace.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition"
          >
            Retour à l&apos;accueil
          </Link>
          <p className="mt-4 text-xs text-ink-soft">
            <button onClick={() => setLinkSent(false)} className="text-brand hover:underline">
              Utiliser une autre adresse
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-hairline bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl text-ink mb-1">Connexion</h1>
        <p className="text-sm text-ink-soft mb-6">
          Accède à ton espace Search Mind : audits sauvegardés, assistant IA et suivi de positionnement. Recevez un lien de connexion par email, sans mot de passe à retenir.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1.5">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand/40 transition"
            />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            {loading ? "Envoi…" : "Recevoir le lien de connexion"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-soft">
          Pas encore de compte ? <Link href="/commencer" className="font-medium text-brand hover:underline">Lance ta première analyse gratuite</Link>
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-ink-soft">
        <Link href="/" className="hover:text-brand">← Retour à l&apos;accueil</Link>
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="flex justify-center px-4 py-10 sm:min-h-[calc(100dvh-4rem)] sm:items-center sm:py-16">
      <Suspense fallback={null}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
