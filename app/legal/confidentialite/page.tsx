import Link from "next/link";

export const metadata = { title: "Politique de confidentialité — Search Mind" };

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition">
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="text-3xl font-bold text-black mb-2">Politique de confidentialité</h1>
      <p className="text-sm text-gray-500 mb-10">Dernière mise à jour : juillet 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-gray-600">
        <section>
          <h2 className="text-base font-semibold text-black mb-3">1. Présentation de l&apos;application</h2>
          <p>
            Search Mind (<a href="https://search-mind.cloud" className="underline">search-mind.cloud</a>) est un outil d&apos;analyse et d&apos;audit SEO permettant aux professionnels du référencement d&apos;analyser des sites web, de suivre des positions de mots-clés et d&apos;obtenir des recommandations via un assistant IA.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-black mb-3">2. Données collectées</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-black">Compte utilisateur :</strong> email et mot de passe (chiffré) à l&apos;inscription.</li>
            <li><strong className="text-black">Données d&apos;analyse :</strong> URLs soumises à l&apos;audit SEO et résultats associés.</li>
            <li><strong className="text-black">Conversations :</strong> messages échangés avec l&apos;assistant IA, stockés pour permettre l&apos;historique.</li>
            <li><strong className="text-black">Intégrations :</strong> tokens d&apos;accès aux applications tierces (Google Search Console) fournis volontairement par l&apos;utilisateur.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-black mb-3">3. Finalités du traitement</h2>
          <p>Les données sont utilisées exclusivement pour fournir le service Search Mind : générer des audits SEO, alimenter l&apos;assistant IA, afficher l&apos;historique des analyses.</p>
          <p className="mt-2">Elles ne sont jamais vendues ni partagées avec des tiers à des fins commerciales.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-black mb-3">4. Utilisation des données Google</h2>
          <p>
            Search Mind utilise les APIs Google (Google Search Console) via OAuth 2.0. Les données récupérées depuis Google Search Console sont utilisées uniquement pour afficher vos propres données de positionnement dans l&apos;interface. Search Mind ne stocke pas vos données Google Search Console au-delà de la session et n&apos;y accède que sur votre demande explicite.
          </p>
          <p className="mt-2">
            L&apos;utilisation de ces données est conforme aux <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline" target="_blank" rel="noopener noreferrer">Règles d&apos;utilisation des données des services d&apos;API Google</a>, y compris les exigences de partage limité.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-black mb-3">5. Conservation des données</h2>
          <p>Les données sont conservées pendant la durée d&apos;activité du compte. Vous pouvez demander leur suppression à tout moment en nous contactant.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-black mb-3">6. Sous-traitants</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong className="text-black">Supabase</strong> — base de données (hébergement EU disponible)</li>
            <li><strong className="text-black">Vercel</strong> — hébergement de l&apos;application</li>
            <li><strong className="text-black">Anthropic</strong> — modèle Claude pour les fonctions IA (données transmises uniquement lors des requêtes)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-black mb-3">7. Vos droits (RGPD)</h2>
          <p>Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression et de portabilité de vos données. Contactez-nous à <a href="mailto:hello@search-mind.cloud" className="underline">hello@search-mind.cloud</a>.</p>
        </section>
      </div>
    </div>
  );
}
