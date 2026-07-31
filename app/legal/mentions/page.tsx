import Link from "next/link";

export const metadata = { title: "Mentions légales — Search Mind" };

export default function MentionsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-brand transition">
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="font-display text-3xl text-ink mb-2">Mentions légales</h1>
      <p className="text-sm text-ink-soft mb-10">Dernière mise à jour : juillet 2026</p>

      <div className="space-y-8 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Éditeur</h2>
          <p>Search Mind est édité par une personne physique domiciliée en France.</p>
          <p className="mt-2">Contact : <a href="mailto:hello@searchmind.fr" className="text-brand hover:underline">hello@searchmind.fr</a></p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Hébergement</h2>
          <p>La plateforme est hébergée sur des serveurs situés dans l&apos;Union européenne via Vercel, Inc. (San Francisco, CA, États-Unis) et Supabase, Inc.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Propriété intellectuelle</h2>
          <p>L&apos;ensemble du contenu du site (interface, textes, logos, code) est la propriété exclusive de Search Mind. Toute reproduction sans autorisation écrite est interdite.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-3">Responsabilité</h2>
          <p>Les données et recommandations fournies par Search Mind ont une valeur indicative. Elles ne constituent pas un conseil professionnel et leur utilisation reste sous la responsabilité de l&apos;utilisateur.</p>
        </section>
      </div>
    </div>
  );
}
