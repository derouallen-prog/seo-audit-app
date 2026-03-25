import type { Analysis } from "./types";

export function makeRecommendations(a: Analysis): string[] {
  const rec: string[] = [];

  // Title
  if (!a.title || a.title.length < 20 || a.title.length > 60) {
    rec.push("Optimiser la balise <title> (≈ 50–60 caractères, mot-clé principal au début).");
  }

  // Meta description
  if (!a.description || a.description.length < 100 || a.description.length > 230) {
    rec.push("Rédiger une meta description attractive (120–160 caractères, bénéfices + CTA).");
  }

  // H1
  if (a.h1Count !== 1) {
    rec.push("S'assurer d'un seul <h1> par page, avec le sujet principal.");
  }

  // Heading structure
  if (a.headings.h2 === 0) {
    rec.push("Ajouter des balises <h2> pour structurer le contenu et faciliter la lecture.");
  }

  // Images alt
  if (a.imagesMissingAlt > 0) {
    rec.push(`Ajouter des attributs alt descriptifs sur ${a.imagesMissingAlt} image(s).`);
  }

  // Canonical
  if (!a.canonical) {
    rec.push("Définir une URL canonique pour éviter le contenu dupliqué.");
  }

  // JSON-LD
  if (a.jsonLdDetected === false) {
    rec.push("Ajouter des données structurées (FAQPage, Article, Product…) pertinentes.");
  }

  // Robots meta
  if (!a.robotsMeta) {
    rec.push("Vérifier la meta robots (index,follow) et robots.txt pour l'indexation.");
  }

  // External links
  if (a.externalLinks > 0) {
    rec.push("Auditer les liens externes (nofollow/sponsored si nécessaire).");
  }

  // Internal links
  if (a.internalLinks < 15) {
    rec.push("Renforcer le maillage interne (liens contextuels vers pages stratégiques).");
  }

  // Response time
  if (a.responseTimeMs > 1500) {
    rec.push("Améliorer la performance (TTFB, cache, images next-gen, CDN).");
  }

  // Robots.txt
  if (a.robotsTxt && !a.robotsTxt.found) {
    rec.push("Créer un fichier robots.txt pour guider les crawlers (règles d'indexation, lien sitemap).");
  }
  if (a.robotsTxt?.blocksGooglebot) {
    rec.push("⚠️ robots.txt bloque tout le site (Disallow: /) — vérifier que c'est intentionnel.");
  }
  if (a.robotsTxt?.found && a.robotsTxt.sitemapUrls.length === 0) {
    rec.push("Référencer l'URL du sitemap dans robots.txt (directive Sitemap:).");
  }

  // Sitemap
  if (a.sitemap && !a.sitemap.found) {
    rec.push("Créer et soumettre un sitemap XML pour faciliter l'indexation des pages.");
  } else if (!a.sitemapHref && (!a.sitemap || !a.sitemap.found)) {
    rec.push("Exposer un sitemap XML et le référencer dans robots.txt.");
  }

  // OpenGraph
  if (!a.openGraph.title || !a.openGraph.description || !a.openGraph.image) {
    rec.push("Compléter les balises OpenGraph (og:title, og:description, og:image) pour un meilleur partage sur les réseaux sociaux.");
  }

  // Twitter Card
  if (!a.twitterCard.card) {
    rec.push("Ajouter les balises Twitter Card (twitter:card, twitter:title, twitter:image) pour optimiser le partage sur X/Twitter.");
  }

  // HTTPS
  if (!a.security.https) {
    rec.push("Migrer le site en HTTPS — indispensable pour la sécurité et le référencement.");
  }

  // HSTS
  if (a.security.https && !a.security.hsts) {
    rec.push("Activer HSTS (Strict-Transport-Security) pour forcer les connexions sécurisées.");
  }

  // Security headers
  if (!a.security.xContentTypeOptions) {
    rec.push("Ajouter l'en-tête X-Content-Type-Options: nosniff pour prévenir le MIME sniffing.");
  }
  if (!a.security.xFrameOptions) {
    rec.push("Ajouter X-Frame-Options (DENY ou SAMEORIGIN) pour protéger contre le clickjacking.");
  }
  if (!a.security.csp) {
    rec.push("Mettre en place une Content Security Policy (CSP) pour réduire les risques XSS.");
  }

  return rec;
}
