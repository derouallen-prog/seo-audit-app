import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSeoNewsDigest, formatDigestForPrompt } from "@/lib/seoNews";
import { getValidAccessToken, listGscSites, getGscTopQueries, getGscSiteMetrics } from "@/lib/gscOAuth";

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

Tu réponds en français, de façon claire et actionnable. Tu peux discuter de stratégie SEO, répondre à des questions techniques, donner des recommandations, et exécuter trois actions concrètes quand on te le demande :
- générer un article de blog optimisé SEO et GEO
- générer une fiche produit e-commerce optimisée SEO
- générer un plan de contenu structuré (page pilier + articles satellites)

Quand l'utilisateur demande explicitement l'une de ces trois actions, utilise l'outil correspondant plutôt que de l'écrire toi-même dans ta réponse. Si des informations essentielles manquent (sujet, produit, mot-clé principal), demande-les avant d'appeler l'outil.

Si l'utilisateur a connecté sa Google Search Console et demande des données réelles sur un domaine (mots-clés positionnés, requêtes longue traîne, performances de recherche, clics, impressions, position), utilise immédiatement l'outil get_search_console_data avec le domaine mentionné, sans poser de questions de clarification au préalable — l'outil te dira lui-même si le domaine n'est pas accessible. N'utilise PAS cet outil si l'utilisateur n'a pas mentionné de domaine précis ou ne demande pas de données chiffrées issues de la Search Console.

## Format de réponse

Structure tes réponses avec des titres markdown (## pour les sections principales, ### pour les sous-sections) afin qu'elles soient bien hiérarchisées une fois affichées. Reste concis dans chaque section : privilégie des listes à puces courtes et actionnables plutôt que des paragraphes denses. Termine par une question ou une proposition d'action concrète quand cela invite à poursuivre l'échange.`;

const tools: Anthropic.Tool[] = [
  {
    name: "generate_article",
    description: "Génère un article de blog complet optimisé SEO et GEO (titre, meta description, sommaire, structure Hn, FAQ, TL;DR, maillage interne suggéré).",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Sujet ou titre de l'article" },
        mot_cle_principal: { type: "string", description: "Mot-clé principal à cibler" },
        mots_cles_longue_traine: { type: "string", description: "Requêtes longue traîne identifiées à reprendre dans la FAQ, si disponibles" },
        plan: { type: "string", description: "Plan de contenu fourni par l'utilisateur (titres H2/H3), si disponible" },
        public_cible: { type: "string", description: "Audience cible et son niveau d'expertise" },
        longueur_mots: { type: "number", description: "Longueur cible approximative en nombre de mots" },
      },
      required: ["sujet"],
    },
  },
  {
    name: "generate_product_sheet",
    description: "Génère une fiche produit e-commerce optimisée SEO (600-900 mots, title tag, meta description, description complète).",
    input_schema: {
      type: "object",
      properties: {
        nom_produit: { type: "string", description: "Nom du produit" },
        thematique: { type: "string", description: "Thématique/secteur du produit (pour calibrer l'expertise mobilisée)" },
        caracteristiques: { type: "string", description: "Caractéristiques techniques, avantages, matériaux..." },
        mot_cle_principal: { type: "string", description: "Mot-clé principal à cibler" },
      },
      required: ["nom_produit"],
    },
  },
  {
    name: "generate_content_plan",
    description: "Génère un plan de contenu structuré (page pilier + articles satellites maillés) autour d'un sujet ou mot-clé principal.",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Sujet, secteur ou mot-clé principal autour duquel construire le plan" },
        objectif: { type: "string", description: "Objectif business (notoriété, conversion, autorité thématique...)" },
        mots_cles_disponibles: { type: "string", description: "Mots-clés déjà identifiés à exploiter, si disponibles" },
        nombre_articles: { type: "number", description: "Nombre d'articles satellites souhaités, par défaut 5" },
      },
      required: ["sujet"],
    },
  },
  {
    name: "get_search_console_data",
    description: "Récupère les vraies données Google Search Console (top requêtes, clics, impressions, position moyenne) pour un domaine auquel l'utilisateur connecté a accès.",
    input_schema: {
      type: "object",
      properties: {
        domaine: { type: "string", description: "Nom de domaine demandé, ex: laplantation.com" },
        jours: { type: "number", description: "Période en jours à analyser (par défaut 28)" },
      },
      required: ["domaine"],
    },
  },
];

interface ArticleParams {
  sujet: string;
  mot_cle_principal?: string;
  mots_cles_longue_traine?: string;
  plan?: string;
  public_cible?: string;
  longueur_mots?: number;
}

interface ProductSheetParams {
  nom_produit: string;
  thematique?: string;
  caracteristiques?: string;
  mot_cle_principal?: string;
}

interface ContentPlanParams {
  sujet: string;
  objectif?: string;
  mots_cles_disponibles?: string;
  nombre_articles?: number;
}

const ARTICLE_SYSTEM_PROMPT = `Tu es un expert en rédaction web SEO. Tu rédiges des contenus qui répondent aux exigences de Google en termes de qualité et de pertinence, tout en étant optimisés pour apparaître dans les réponses générées par les moteurs IA (Google AI Overviews, ChatGPT, Perplexity — approche GEO).
Tu es capable de rédiger sur tous les sujets en posant les bonnes questions. Tu adaptes la taille du contenu en fonction de la spécificité du sujet.

1. INSTRUCTIONS DE STRUCTURE ET DE RÉDACTION

a) Structure générale
- Intègre le mot-clé principal dans le titre (H1) et construis le contenu autour de ce mot-clé pour assurer une couverture sémantique optimale.
- Structure l'article de façon logique avec des sous-titres H2, H3, voire H4 si nécessaire.
- Intègre un sommaire cliquable en début d'article pour permettre aux lecteurs d'accéder directement à la section qui les intéresse.
- Formule les sous-titres H2/H3 sous forme de questions quand c'est naturel et pertinent (ex : "Comment fonctionne X ?" plutôt que "Fonctionnement de X") — cela favorise l'extraction par les moteurs IA.
- Suggère à la fin 3 à 5 liens internes potentiels à intégrer dans l'article (ancre suggérée + type de contenu cible), pour renforcer le maillage interne du site.

b) Introduction — format "réponse directe + accroche"
- Rédige une introduction qui combine deux objectifs : répondre directement et clairement au sujet dès les 2 premières phrases (pour être extrait par les AI Overviews), puis captiver le lecteur et lui donner envie de lire la suite.
- Intègre le mot-clé principal dans les 25 premiers mots.

c) Corps de l'article
- Le contenu doit être aligné avec les principes E-E-A-T de Google (Expérience, Expertise, Autorité, Confiance) : fournis des exemples concrets, cite tes sources, intègre des données chiffrées datées (année en cours de préférence), des retours d'expérience, et des citations d'experts.
- Rédige des phrases dans un style déclaratif, avec un vocabulaire adapté au niveau du lecteur cible, en privilégiant des phrases courtes et concises.
- Intègre les mots-clés prioritaires dès le début des phrases et utilise des variantes sémantiques pour enrichir le contenu.
- Utilise des verbes d'action et des formulations dynamiques.
- Mets en gras les termes importants pour faciliter la lecture et le repérage des informations clés.
- Privilégie la rédaction en phrases et paragraphes. Utilise les listes à puces uniquement pour énumérer des éléments distincts quand c'est pertinent.
- Intègre des citations qui illustrent les propos du texte.
- Ajoute un tableau comparatif ou un tableau de synthèse chaque fois que cela apporte de la clarté (comparaison de solutions, récapitulatif de données, etc.) — ce format est très bien extrait par les moteurs IA.
- Inclus une indication de date de mise à jour en début ou fin d'article (ex : "Mis à jour en [mois] [année]") pour signaler la fraîcheur du contenu.

d) Section FAQ optimisée pour un affichage IA — si pertinente selon le sujet
- Une FAQ en fin d'article qui fournit des réponses structurées et rapides, facilement citables par les LLMs.
- Les questions doivent reprendre les requêtes longue traîne fournies, si disponibles.

2. LIVRABLES FINAUX
- Balise title : intègre le mot-clé principal idéalement en début, 50 à 60 caractères maximum, incitative au clic, claire et descriptive, sans formulation trompeuse.
- Meta description : intègre le mot-clé principal, donne envie de cliquer, entre 120 et 140 caractères, utilise un verbe d'action.
- Suggestions de maillage interne : 3 à 5 liens internes (ancre + type de contenu cible).
- TL;DR : synthèse des points clés en 5 à 7 bullet points maximum.

3. CONSIGNE DE LIVRAISON
La rédaction ne doit jamais être écourtée. Réponds uniquement avec l'article complet au format markdown, structuré selon les instructions ci-dessus.`;

const PRODUCT_SHEET_SYSTEM_PROMPT = `Agis comme un expert en création de contenu sur la thématique fournie, spécialisé en rédaction de fiche produit optimisée pour le SEO.

Tu sais t'adapter aux évolutions du marché et aux attentes des consommateurs sur le contenu recherché.

Adopte un style rédactionnel avec un vocabulaire clair et simple, favorise l'utilisation de phrases. Réponds bien aux intentions de recherche.

Le contenu doit être aligné avec les principes EEAT de Google (expérience, expertise, autorité, confiance) : fournis des exemples concrets lorsque c'est pertinent, cite les sources des informations présentées, fournis des données chiffrées et tout autre élément pertinent qui permettrait de compléter les informations du texte (citation, retour d'expérience, etc.).

- Les phrases doivent être dans un style déclaratif, avec un vocabulaire simple et compréhensible pour l'audience, en phrases courtes et concises. Privilégie les phrases aux bullet points.
- Intègre les mots-clés prioritaires dès le début des phrases et utilise des variantes sémantiques pour enrichir le contenu.
- Développe bien chaque partie de la structure : la fiche doit être comprise entre 600 et 900 mots.

Réponds uniquement au format markdown avec ces sections dans l'ordre : "# Title SEO (≤60 car.)", "**Meta description (120-140 car.):**", puis la fiche produit complète (600-900 mots) structurée avec des sous-titres pertinents.`;

async function generateArticleContent(p: ArticleParams): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: ARTICLE_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Rédige un article complet sur : ${p.sujet}
${p.mot_cle_principal ? `Mot-clé principal à cibler : ${p.mot_cle_principal}` : ""}
${p.mots_cles_longue_traine ? `Requêtes longue traîne à reprendre dans la FAQ : ${p.mots_cles_longue_traine}` : ""}
${p.plan ? `Plan à suivre :\n${p.plan}` : "Construis un plan pertinent toi-même."}
${p.public_cible ? `Public cible : ${p.public_cible}` : "Public cible : généraliste mais averti."}
${p.longueur_mots ? `Longueur cible : environ ${p.longueur_mots} mots.` : "Longueur cible : adapte-toi à la spécificité du sujet."}`,
    }],
  });
  return (response.content[0] as { text: string }).text;
}

async function generateProductSheetContent(p: ProductSheetParams): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: PRODUCT_SHEET_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Rédige une fiche produit pour : ${p.nom_produit}
${p.thematique ? `Thématique : ${p.thematique}` : ""}
${p.caracteristiques ? `Caractéristiques / avantages : ${p.caracteristiques}` : ""}
${p.mot_cle_principal ? `Mot-clé principal à cibler : ${p.mot_cle_principal}` : ""}`,
    }],
  });
  return (response.content[0] as { text: string }).text;
}

async function generateContentPlanContent(p: ContentPlanParams): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `Tu es un stratège SEO senior spécialisé en architecture de contenu. Tu construis des plans de contenu structurés en clusters thématiques (page pilier + articles satellites maillés entre eux), en partant toujours d'un mot-clé ou sujet principal clairement défini avant toute autre analyse.

Pour chaque plan, fournis :
1. La page pilier : titre, mot-clé principal visé, intention de recherche, angle éditorial.
2. Les articles satellites (nombre demandé, 5 par défaut) : pour chacun, titre, mot-clé/longue traîne visé, intention de recherche (informationnelle, commerciale, comparative...), un plan H2 sommaire, et le lien suggéré vers la page pilier (ancre).
3. Une note de priorisation : quels articles produire en premier selon le potentiel (volume estimé, facilité de positionnement, valeur business).

Réponds en français, au format markdown, avec des listes à puces structurées. N'utilise pas de tirets cadratins (—), préfère les tirets courts (-) ou des puces.`,
    messages: [{
      role: "user",
      content: `Construis un plan de contenu pour : ${p.sujet}
${p.objectif ? `Objectif : ${p.objectif}` : ""}
${p.mots_cles_disponibles ? `Mots-clés déjà identifiés à exploiter : ${p.mots_cles_disponibles}` : "Identifie toi-même les mots-clés et angles pertinents."}
Nombre d'articles satellites souhaité : ${p.nombre_articles ?? 5}`,
    }],
  });
  return (response.content[0] as { text: string }).text;
}

interface GscDataParams {
  domaine: string;
  jours?: number;
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

async function getSearchConsoleDataForChat(sessionId: string | undefined, p: GscDataParams): Promise<string> {
  if (!sessionId) {
    return "Aucune Search Console connectée. Invite l'utilisateur à cliquer sur \"Connecter Google Search Console\" sur la page d'accueil avant de pouvoir consulter ses données.";
  }

  const accessToken = await getValidAccessToken(sessionId);
  if (!accessToken) {
    return "Aucune Search Console connectée ou la connexion a expiré. Invite l'utilisateur à cliquer sur \"Connecter Google Search Console\" sur la page d'accueil.";
  }

  let sites;
  try {
    sites = await listGscSites(accessToken);
  } catch {
    return "Erreur lors de la récupération des propriétés Search Console de l'utilisateur.";
  }

  const target = normalizeDomain(p.domaine);
  const match = sites.find(s => normalizeDomain(s.siteUrl) === target || normalizeDomain(s.siteUrl).includes(target));

  if (!match) {
    const available = sites.map(s => s.siteUrl).join(", ") || "aucune";
    return `Le domaine "${p.domaine}" n'est pas accessible avec le compte Google connecté. Propriétés disponibles : ${available}. Informe l'utilisateur de cette liste et demande-lui de préciser s'il voulait l'une d'entre elles.`;
  }

  try {
    const [metrics, topQueries] = await Promise.all([
      getGscSiteMetrics(accessToken, match.siteUrl, p.jours ?? 28),
      getGscTopQueries(accessToken, match.siteUrl, p.jours ?? 28, 50),
    ]);
    return JSON.stringify({
      domaine: match.siteUrl,
      periode_jours: p.jours ?? 28,
      metriques_globales: metrics,
      requetes: topQueries,
    });
  } catch (e) {
    console.error("[assistant gsc] error:", e);
    return "Erreur lors de la récupération des données Search Console pour ce domaine.";
  }
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
      if (toolUse.name === "generate_article") {
        const generated = await generateArticleContent(toolUse.input as ArticleParams);
        return NextResponse.json({ reply: `Voici l'article généré :\n\n${generated}` });
      }

      if (toolUse.name === "generate_product_sheet") {
        const generated = await generateProductSheetContent(toolUse.input as ProductSheetParams);
        return NextResponse.json({ reply: `Voici la fiche produit générée :\n\n${generated}` });
      }

      if (toolUse.name === "generate_content_plan") {
        const generated = await generateContentPlanContent(toolUse.input as ContentPlanParams);
        return NextResponse.json({ reply: `Voici le plan de contenu généré :\n\n${generated}` });
      }

      if (toolUse.name === "get_search_console_data") {
        const sessionId = req.cookies.get("gsc_session")?.value;
        const toolResultContent = await getSearchConsoleDataForChat(sessionId, toolUse.input as GscDataParams);

        const followUp = await client.messages.create({
          model: MODEL,
          max_tokens: 2500,
          system: systemWithNews,
          tools,
          messages: [
            ...messages,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: toolResultContent,
                },
              ],
            },
          ],
        });

        const followUpText = followUp.content.find(b => b.type === "text");
        const reply = followUpText && followUpText.type === "text" ? followUpText.text : "Désolé, je n'ai pas pu analyser ces données.";
        return NextResponse.json({ reply });
      }
    }

    const textBlock = response.content.find(b => b.type === "text");
    const reply = textBlock && textBlock.type === "text" ? textBlock.text : "Désolé, je n'ai pas pu générer de réponse.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("assistant error:", e);
    return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
  }
}
