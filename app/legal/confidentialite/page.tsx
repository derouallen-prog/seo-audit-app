import Link from "next/link";

export const metadata = { title: "Politique de confidentialité — Search Mind" };

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-brand transition">
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="font-display text-3xl text-ink mb-2">Politique de confidentialité</h1>
      <p className="text-sm text-ink-soft mb-10">Dernière mise à jour : juillet 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Données collectées</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-ink">Compte utilisateur :</strong> email et mot de passe (chiffré) à l&apos;inscription.</li>
            <li><strong className="text-ink">Données d&apos;analyse :</strong> URLs soumises à l&apos;audit SEO et résultats associés.</li>
            <li><strong className="text-ink">Conversations :</strong> messages échangés avec l&apos;assistant IA, stockés pour permettre l&apos;historique.</li>
            <li><strong className="text-ink">Intégrations :</strong> identifiants d&apos;applications tierces (Google Search Console, WooCommerce) fournis volontairement.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Finalités du traitement</h2>
          <p>Les données sont utilisées exclusivement pour fournir le service Search Mind : générer des audits SEO, alimenter l&apos;assistant IA, afficher l&apos;historique des analyses.</p>
          <p className="mt-2">Elles ne sont jamais vendues ni partagées avec des tiers à des fins commerciales.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Conservation</h2>
          <p>Les données sont conservées pendant la durée d&apos;activité du compte. Vous pouvez demander leur suppression à tout moment en nous contactant.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Sous-traitants</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-ink">Supabase</strong> — base de données (hébergement EU disponible)</li>
            <li><strong className="text-ink">Vercel</strong> — hébergement de l&apos;application</li>
            <li><strong className="text-ink">Anthropic</strong> — modèle Claude pour les fonctions IA (données transmises uniquement lors des requêtes)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Vos droits</h2>
          <p>Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression et de portabilité de vos données. Contactez-nous à <a href="mailto:hello@searchmind.fr" className="text-brand hover:underline">hello@searchmind.fr</a>.</p>
        </section>
      </div>
    </div>
  );
}
