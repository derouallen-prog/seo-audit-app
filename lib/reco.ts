import type { Analysis } from "./types";

export function makeRecommendations(a: Analysis): string[] {
  const rec: string[] = [];

  if (!a.title || a.title.length < 20 || a.title.length > 60) {
    rec.push("Optimiser la balise <title> (≈ 50–60 caractères, mot-clé principal au début).");
  }
  if (!a.description || a.description.length < 100 || a.description.length > 230) {
    rec.push("Rédiger une meta description attractive (120–160 caractères, bénéfices + CTA).");
  }
  if (a.h1Count !== 1) {
    rec.push("S’assurer d’un seul <h1> par page, avec le sujet principal.");
  }
  if (a.imagesMissingAlt > 0) {
    rec.push(`Ajouter des attributs alt descriptifs sur ${a.imagesMissingAlt} image(s).`);
  }
  if (!a.canonical) {
    rec.push("Définir une URL canonique pour éviter le contenu dupliqué.");
  }
  if (a.jsonLdDetected === false) {
    rec.push("Ajouter des données structurées (FAQPage, Article, Product…) pertinentes.");
  }
  if (!a.robotsMeta) {
    rec.push("Vérifier la meta robots (index,follow) et robots.txt pour l’indexation.");
  }
  if (a.externalLinks > 0) {
    rec.push("Auditer les liens externes (nofollow/sponsored si nécessaire).");
  }
  if (a.internalLinks < 15) {
    rec.push("Renforcer le maillage interne (liens contextuels vers pages stratégiques).");
  }
  if (a.responseTimeMs > 1500) {
    rec.push("Améliorer la performance (TTFB, cache, images next-gen, CDN).");
  }
  if (!a.sitemapHref) {
    rec.push("Exposer un sitemap XML et le référencer dans robots.txt.");
  }
  return rec;
}
