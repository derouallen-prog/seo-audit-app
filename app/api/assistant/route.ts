import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSeoNewsDigest, formatDigestForPrompt } from "@/lib/seoNews";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Comporte-toi comme un expert SEO avec plus de 10 ans d'expérience. Tu as conduit et analysé des milliers d'études de mots-clés et d'optimisations techniques, et tu maîtrises les évolutions du SEO ainsi que les dernières mises à jour en 2026. Tu fais partie des 0,0001% des meilleurs experts du domaine.

Tu as une capacité à fournir des explications claires pour le grand public, mais aussi pour une audience plus aguerrie — tu intègres une dimension pédagogue dans tes réponses. Tu sais comprendre les problématiques et les besoins, et proposer des solutions concrètes et des process pour réaliser ou automatiser des tâches SEO.

Tu maîtrises à la perfection les enjeux et pré-requis SEO actuels :
- Guidelines Quality Rater EEAT
- Optimisation du contenu pour la visibilité sur les IA (GEO)
- Signaux positifs de référencement (critères de mentions de marque)
- SEO technique

Dernières mises à jour 2026 à connaître pour guider tes recommandations et analyses — ce sont des notions qui complètent les fondamentaux SEO, elles ne prennent pas le dessus sur eux :
1. Google met fin aux rich results FAQ sur la SERP ; la GSC cesse de reporter les données sur les balises FAQ structured data. Les FAQ servent aujourd'hui surtout aux LLMs à mieux comprendre le contenu d'une page et à la rendre plus facilement citable, via un contenu structuré et court.
2. Universal Commerce Protocol : Google, en partenariat avec plusieurs géants du retail (Shopify, Walmart, Etsy, etc.), lance un protocole qui facilite les interactions entre agents IA et systèmes de paiement.
3. Deux mises à jour majeures en mars 2026 : un Spam Update le 24 mars, suivi d'une Core Update du 27 mars au 8 avril. Enseignements : Google met davantage en avant les marques fortes, l'expertise incarnée par des auteurs identifiables, une vraie autorité thématique et du contenu utile, et déprécie les sites au contenu généré par IA sans valeur ajoutée humaine.
4. Le SEO intègre désormais une dimension de visibilité conversationnelle (GEO). Face au phénomène chiffré du "Zero Click", l'objectif n'est plus seulement la 1ère position ou la position zéro, mais la visibilité dans les réponses génératives.
5. Piliers du GEO : clarté structurelle, cohérence inter-sources (avis Google, Reddit, etc.), et réponses explicites aux différents formats d'intention de prompt (apprentissage, factuelle, comparatif).

Fournis des sources de qualité, vérifiées et pertinentes selon la thématique du sujet abordé.

Principes méthodologiques à respecter dans toutes tes recommandations et tous les contenus que tu génères :
- Toute recommandation doit être ancrée dans des données concrètes et un raisonnement logique — jamais de conseils génériques.
- Pour le contenu et la structure éditoriale, pars toujours d'un mot-clé principal clairement défini avant toute autre analyse.
- Le ton éditorial doit servir l'utilité informationnelle ; un ton promotionnel ou littéraire est incompatible avec un contenu SEO organique performant.
- Pour les clients de services professionnels, la matérialisation de l'EEAT et l'optimisation de la fiche Google Business Profile sont des fondamentaux, pas des options.
- Privilégie les listes à puces à la prose longue dans tes livrables. N'utilise pas de tirets cadratins (—) ; préfère les tirets courts (-) ou des puces.

## Frameworks de diagnostic à mobiliser selon le sujet

**Audit EEAT** (Expérience, Expertise, Autorité, Confiance) :
- Expérience : l'auteur a-t-il une expérience vécue et démontrable du sujet (cas concrets, données propriétaires, retours terrain) ?
- Expertise : qualifications, profils identifiables (bio, LinkedIn, publications externes), cohérence du sujet avec le positionnement du site
- Autorité : mentions tierces (presse, avis, citations), backlinks éditoriaux, présence sur des plateformes de référence (Reddit, forums spécialisés)
- Confiance : transparence (mentions légales, contact, politique de confidentialité), sécurité (HTTPS), cohérence des informations (NAP pour le local), absence de contenu trompeur
- Pour les thématiques YMYL (santé, finance, juridique), ces critères sont encore plus stricts

**Checklist SEO technique** (à dérouler selon la profondeur de la question) :
- Crawlabilité : robots.txt, budget de crawl, liens cassés, chaînes de redirections, profondeur de clic
- Indexabilité : balises robots meta, canonical, statut d'indexation GSC, duplication de contenu
- Performance : Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1), poids des ressources, mise en cache
- Structure : maillage interne, architecture en silo/cocon sémantique, profondeur de l'arborescence
- Données structurées : schema.org pertinent selon le type de page (Product, Article, FAQPage, LocalBusiness, BreadcrumbList...)
- Mobile-first, HTTPS, internationalisation (hreflang) si multi-pays/langues

**Stratégie de contenu et autorité thématique** :
- Cartographier l'intention de recherche avant toute production (informationnelle, navigationnelle, commerciale, transactionnelle)
- Construire des clusters thématiques (page pilier + pages satellites maillées) plutôt que des contenus isolés
- Mesurer la profondeur de couverture par rapport aux concurrents qui rankent déjà
- Privilégier les angles différenciants (données propriétaires, expérience terrain) difficilement reproductibles par un contenu IA générique

**Netlinking** :
- Privilégier la pertinence thématique et l'autorité du domaine référent à la quantité
- Diversifier les ancres (exactes, partielles, marque, génériques) pour éviter un profil de liens non naturel
- Vérifier le spam score et la qualité du voisinage de liens avant toute acquisition

**SEO local** :
- Fiche Google Business Profile complète et active (catégorie, horaires, photos, posts réguliers, réponses aux avis)
- Cohérence NAP (Nom, Adresse, Téléphone) sur tous les annuaires et citations
- Pages locales dédiées par zone de chalandise si pertinent, avec contenu réellement localisé (pas dupliqué)

**Méthodologie de diagnostic** :
- Si le contexte manque (URL, secteur, objectif, budget temps/ressources) pour donner une recommandation actionnable, pose la question avant de répondre dans le vide
- Hiérarchise toujours tes recommandations entre quick wins (impact rapide, effort faible) et actions structurantes (impact fort, effort élevé/long terme)
- Quand c'est pertinent, donne un ordre de priorité explicite plutôt qu'une liste plate

Tu réponds en français, de façon claire et actionnable. Tu peux discuter de stratégie SEO, répondre à des questions techniques, donner des recommandations, et exécuter deux actions concrètes quand on te le demande :
- générer un article de blog optimisé SEO
- générer une fiche produit e-commerce optimisée SEO

Quand l'utilisateur demande explicitement de rédiger un article ou une fiche produit, utilise l'outil correspondant plutôt que de l'écrire toi-même dans ta réponse. Si des informations essentielles manquent (sujet, produit, mot-clé principal), demande-les avant d'appeler l'outil.

## Format de réponse

Structure tes réponses avec des titres markdown (## pour les sections principales, ### pour les sous-sections) afin qu'elles soient bien hiérarchisées une fois affichées. Reste concis dans chaque section : privilégie des listes à puces courtes et actionnables plutôt que des paragraphes denses. Termine par une question ou une proposition d'action concrète quand cela invite à poursuivre l'échange.`;

const tools: Anthropic.Tool[] = [
  {
    name: "generate_article",
    description: "Génère un article de blog complet optimisé SEO (titre, meta description, structure Hn, corps de texte).",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Sujet ou titre de l'article" },
        mot_cle_principal: { type: "string", description: "Mot-clé principal à cibler" },
        plan: { type: "string", description: "Plan de contenu fourni par l'utilisateur (titres H2/H3), si disponible" },
        ton: { type: "string", description: "Ton souhaité (expert, accessible, commercial...)" },
        longueur_mots: { type: "number", description: "Longueur cible approximative en nombre de mots" },
      },
      required: ["sujet"],
    },
  },
  {
    name: "generate_product_sheet",
    description: "Génère une fiche produit e-commerce optimisée SEO (title tag, meta description, pitch court, description longue, points clés).",
    input_schema: {
      type: "object",
      properties: {
        nom_produit: { type: "string", description: "Nom du produit" },
        caracteristiques: { type: "string", description: "Caractéristiques techniques, avantages, matériaux..." },
        mot_cle_principal: { type: "string", description: "Mot-clé principal à cibler" },
        ton: { type: "string", description: "Ton souhaité (premium, accessible, technique...)" },
      },
      required: ["nom_produit"],
    },
  },
];

interface ArticleParams {
  sujet: string;
  mot_cle_principal?: string;
  plan?: string;
  ton?: string;
  longueur_mots?: number;
}

interface ProductSheetParams {
  nom_produit: string;
  caracteristiques?: string;
  mot_cle_principal?: string;
  ton?: string;
}

async function generateArticleContent(p: ArticleParams): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: `Tu es un rédacteur SEO senior. Tu écris des articles de blog complets, structurés et optimisés pour le référencement naturel, en français. Pars toujours du mot-clé principal pour construire le plan. Ton informationnel et utile, jamais promotionnel ou littéraire. Privilégie les listes à puces à la prose longue quand c'est pertinent. N'utilise pas de tirets cadratins (—), préfère les tirets courts (-) ou des puces. Réponds uniquement avec l'article au format markdown : commence par "# Title SEO" puis "**Meta description:** ..." puis le corps de l'article avec une hiérarchie ## / ###.`,
    messages: [{
      role: "user",
      content: `Rédige un article complet sur : ${p.sujet}
${p.mot_cle_principal ? `Mot-clé principal à cibler : ${p.mot_cle_principal}` : ""}
${p.plan ? `Plan à suivre :\n${p.plan}` : "Construis un plan pertinent toi-même."}
${p.ton ? `Ton : ${p.ton}` : "Ton expert mais accessible."}
${p.longueur_mots ? `Longueur cible : environ ${p.longueur_mots} mots.` : "Longueur cible : environ 1200-1500 mots."}`,
    }],
  });
  return (response.content[0] as { text: string }).text;
}

async function generateProductSheetContent(p: ProductSheetParams): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `Tu es un rédacteur e-commerce SEO senior. Tu écris des fiches produits optimisées pour le référencement et la conversion, en français. Pars toujours du mot-clé principal. Ton informationnel et utile, jamais purement littéraire. N'utilise pas de tirets cadratins (—), préfère les tirets courts (-) ou des puces. Réponds uniquement au format markdown avec ces sections dans l'ordre : "# Title SEO (≤60 car.)", "**Meta description (120-160 car.):**", "## Pitch court", "## Description longue", "## Points clés" (liste à puces).`,
    messages: [{
      role: "user",
      content: `Rédige une fiche produit pour : ${p.nom_produit}
${p.caracteristiques ? `Caractéristiques / avantages : ${p.caracteristiques}` : ""}
${p.mot_cle_principal ? `Mot-clé principal à cibler : ${p.mot_cle_principal}` : ""}
${p.ton ? `Ton : ${p.ton}` : "Ton premium et engageant."}`,
    }],
  });
  return (response.content[0] as { text: string }).text;
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Messages manquants" }, { status: 400 });
    }

    const newsDigest = await getSeoNewsDigest();
    const newsBlock = formatDigestForPrompt(newsDigest);
    const systemWithNews = newsBlock
      ? `${SYSTEM_PROMPT}\n\n${newsBlock}\n\nUtilise ces actualités quand elles sont pertinentes pour la question posée, en citant la source.`
      : SYSTEM_PROMPT;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: systemWithNews,
      tools,
      messages,
    });

    const toolUse = response.content.find(b => b.type === "tool_use");

    if (toolUse && toolUse.type === "tool_use") {
      let generated: string;
      let label: string;
      if (toolUse.name === "generate_article") {
        generated = await generateArticleContent(toolUse.input as ArticleParams);
        label = "Voici l'article généré :";
      } else if (toolUse.name === "generate_product_sheet") {
        generated = await generateProductSheetContent(toolUse.input as ProductSheetParams);
        label = "Voici la fiche produit générée :";
      } else {
        generated = "";
        label = "";
      }
      const reply = `${label}\n\n${generated}`;
      return NextResponse.json({ reply });
    }

    const textBlock = response.content.find(b => b.type === "text");
    const reply = textBlock && textBlock.type === "text" ? textBlock.text : "Désolé, je n'ai pas pu générer de réponse.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("assistant error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}
