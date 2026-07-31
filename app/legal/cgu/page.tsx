import Link from "next/link";

export const metadata = { title: "Conditions générales d'utilisation — Search Mind" };

export default function CguPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-brand transition">
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="font-display text-3xl text-ink mb-2">Conditions générales d&apos;utilisation</h1>
      <p className="text-sm text-ink-soft mb-10">Dernière mise à jour : juillet 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Objet</h2>
          <p>Les présentes CGU régissent l&apos;accès et l&apos;utilisation de la plateforme Search Mind (ci-après « le Service »), outil d&apos;analyse SEO et d&apos;assistance IA accessible via searchmind.fr.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Accès au service</h2>
          <p>Le Service est accessible après création d&apos;un compte utilisateur. L&apos;utilisateur s&apos;engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants.</p>
          <p className="mt-2">Durant la phase bêta, l&apos;accès est gratuit et les fonctionnalités peuvent évoluer sans préavis.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Utilisation acceptable</h2>
          <p>L&apos;utilisateur s&apos;engage à ne pas utiliser le Service pour :</p>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>Analyser des sites sans autorisation de leur propriétaire</li>
            <li>Générer du contenu contraire aux lois en vigueur</li>
            <li>Tenter de contourner les mécanismes de sécurité de la plateforme</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Responsabilité</h2>
          <p>Search Mind fournit des analyses à titre indicatif. Les recommandations générées par l&apos;IA ne constituent pas un conseil professionnel certifié. Search Mind ne saurait être tenu responsable des décisions prises sur la base de ces données.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Propriété intellectuelle</h2>
          <p>Les analyses et rapports générés par le Service sont la propriété de l&apos;utilisateur. Le code, les interfaces et les modèles d&apos;IA restent la propriété de Search Mind.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Modification et résiliation</h2>
          <p>Search Mind se réserve le droit de modifier les CGU ou de suspendre l&apos;accès au Service à tout moment. L&apos;utilisateur peut supprimer son compte en contactant <a href="mailto:hello@searchmind.fr" className="text-brand hover:underline">hello@searchmind.fr</a>.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Droit applicable</h2>
          <p>Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.</p>
        </section>
      </div>
    </div>
  );
}
