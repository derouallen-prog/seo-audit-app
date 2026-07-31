import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSeoNewsDigest, formatDigestForPrompt } from "@/lib/seoNews";
import { getValidAccessToken, listGscSites, getGscQueriesWithPages, getGscQueriesByTopics, getGscQueriesByPatterns, getGscSiteMetrics, GSC_INTENT_PATTERNS } from "@/lib/gscOAuth";
import { createDraftProduct, createProductCategory, searchProducts, searchCategories, getProduct, updateProduct } from "@/lib/woocommerce";
import { enqueueScript } from "@/lib/wpBridge";
import { checkGeoVisibility } from "@/lib/geoVisibilityCheck";
import { createDraftPost, createDraftPage } from "@/lib/wpPublish";
import { getWcConnection } from "@/lib/wcConnections";
import { getAuthUser } from "@/lib/supabaseServer";
import { buildLinkGraphWithSignals } from "@/lib/linkGraph";
import { fetchWpContentForUrls } from "@/lib/wpContent";
import { searchRedditPosts, getSubredditTopPosts, extractSemanticCorpus, findLinkOpportunities } from "@/lib/reddit";
import { listGbpLocations, getGbpInsightsForLocation } from "@/lib/gbp";
import { getSemrushDomainKeywords, getSemrushDomainTopPages, getSemrushBacklinks, getSemrushKeywordIdeas } from "@/lib/semrush";
import { getKeKeywordData, getKeKeywordTrends } from "@/lib/keywordsEverywhere";
import { getKpuPeopleAlsoAsk, getKpuSuggestions, formatPaaForAssistant, formatSuggestionsForAssistant } from "@/lib/keywordspeopleuse";
import { getSerpResults, getLongTailKeywords, getDomainRanking, getBacklinks } from "@/lib/fetchserp";
import { marked } from "marked";
import { loadAudit } from "@/lib/auditStore";
import { computeScore, formatAuditForAssistant } from "@/lib/score";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

// Cache du digest d'actualités SEO — évite un aller-retour Supabase à chaque requête
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let _newsCacheValue: string = "";
let _newsCacheExpiry: number = 0;

async function getCachedNewsBlock(): Promise<string> {
  if (_newsCacheExpiry > Date.now()) return _newsCacheValue;
  const items = await getSeoNewsDigest();
  _newsCacheValue = formatDigestForPrompt(items);
  _newsCacheExpiry = Date.now() + NEWS_CACHE_TTL_MS;
  return _newsCacheValue;
}

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

Tu réponds en français, de façon claire et actionnable. Tu peux discuter de stratégie SEO, répondre à des questions techniques, donner des recommandations, et exécuter quatre actions concrètes quand on te le demande :
- générer un article de blog optimisé SEO et GEO
- générer une fiche produit e-commerce optimisée SEO
- générer un plan de contenu structuré (page pilier + articles satellites)
- générer un plan d'action stratégique sur un axe précis : SEO local, GEO, netlinking, ou maillage interne
- analyser les données Semrush d'un domaine (mots-clés positionnés, backlinks, top pages) ou explorer les mots-clés d'une thématique (idées connexes, questions)
- analyser les données Google Business Profile (mots-clés locaux, métriques de performance, audit de la fiche)
- analyser les discussions Reddit sur une thématique : recherche sémantique (vocabulaire réel, pain points, intentions), ninja linking / mentions de marque, ou découverte de sujets à fort engagement
- analyser la SERP Google pour un mot-clé (top 10, formats dominants, featured snippets), trouver des mots-clés longue traîne, vérifier le ranking d'un domaine, analyser les backlinks d'un concurrent
- extraire les questions "People Also Ask" Google réelles pour un mot-clé (via Keywords People Use), et obtenir des suggestions Google Autocomplete + mots-clés sémantiques + questions Reddit/Quora

Quand l'utilisateur demande explicitement l'une de ces actions, utilise l'outil correspondant plutôt que de l'écrire toi-même dans ta réponse. Si des informations essentielles manquent (sujet, produit, mot-clé principal), demande-les avant d'appeler l'outil.

Pour le plan d'action stratégique (generate_strategy_action_plan), si l'utilisateur a une Search Console connectée et mentionne un domaine, transmets-le à l'outil pour ancrer le plan dans des données réelles plutôt que des recommandations génériques — c'est particulièrement déterminant pour l'axe maillage interne, où les vraies requêtes/pages permettent de proposer des liens internes précis et justifiés plutôt que des principes abstraits. Si l'utilisateur cible une thématique précise (ex: "maillage interne pour le curry"), transmets-la aussi dans le paramètre thematique — pour l'axe maillage_interne, cela permet en plus de crawler réellement les pages de cette thématique pour vérifier quels liens existent déjà. Important : generate_strategy_action_plan récupère lui-même les données Search Console nécessaires si tu lui passes le paramètre domaine — n'appelle PAS get_search_console_data séparément avant, ce serait redondant.

Pour get_keyword_trends : utilise cet outil dès que l'utilisateur veut voir les tendances de recherche d'un ou plusieurs mots-clés, comparer leur saisonnalité, ou vérifier leur volume mensuel et CPC via Keywords Everywhere. Passe jusqu'à 10 mots-clés par appel. Le paramètre country prend le code pays ISO ('fr', 'us', 'uk', 'de' — défaut 'fr').

Pour get_semrush_data : utilise cet outil dans deux situations — (1) l'utilisateur mentionne un domaine spécifique mais n'a pas de Search Console connectée → mode 'domain' pour récupérer les mots-clés positionnés, top pages et backlinks ; (2) l'utilisateur demande des idées de mots-clés, une étude thématique, ou des opportunités de contenu autour d'un sujet → mode 'keyword' pour obtenir les mots-clés connexes et questions Semrush. Ce tool est complémentaire à get_search_console_data : GSC donne les vraies données du site, Semrush donne le potentiel du marché et les mots-clés concurrentiels. En mode 'keyword', utilise toujours un terme seed court (1-3 mots), pas une phrase longue — Semrush indexe des keywords courts, pas des requêtes conversationnelles. Pour la base 'fr', utilise le français (ex: 'curry', 'épices indiennes') ; pour 'us'/'uk', l'anglais.

Pour get_gbp_insights : utilise cet outil dès que l'utilisateur demande une analyse de sa fiche Google Business Profile, les mots-clés locaux qui génèrent des impressions, les performances de sa fiche (vues, appels, itinéraires), ou un audit SEO local. Si le compte GBP n'a pas le bon scope, l'outil indiquera à l'utilisateur de se reconnecter — ne lui dis pas de le faire avant d'avoir appelé l'outil, car il se peut que la connexion soit déjà valide. Pour le plan d'action SEO local (generate_strategy_action_plan axe seo_local), tu peux appeler get_gbp_insights en premier puis passer les données GBP dans le contexte de generate_strategy_action_plan, ou appeler generate_strategy_action_plan directement — il récupérera lui-même les données GSC.

Pour reddit_research : utilise cet outil dès que l'utilisateur demande d'analyser des discussions Reddit, trouver des opportunités de ninja linking, identifier des mentions de marque sur Reddit, ou découvrir des sujets/mots-clés depuis les forums. Choisis le mode approprié — semantic_research pour enrichir la sémantique et les intentions de recherche, ninja_linking pour les opportunités de liens/mentions de marque, topic_discovery pour les idées de contenu depuis les discussions. IMPORTANT : traduis toujours le sujet en anglais avant de passer le paramètre sujet (Reddit est quasi exclusivement en anglais). Si l'utilisateur ne précise pas de subreddits, effectue une recherche globale — mais pour les thématiques de niche, suggère aussi des subreddits pertinents dans ta réponse finale.

Pour analyze_serp : utilise cet outil dès que l'utilisateur demande d'analyser le top 10 d'un mot-clé, de voir quels sites dominent une SERP, de comprendre les formats de contenu qui rankent, ou d'extraire les intentions de recherche depuis les résultats réels. Passe la requête dans la langue du marché cible (français pour country=fr). L'outil retourne les 10 premiers résultats organiques — analyse les domaines positionnés, les formats, les featured snippets et les requêtes associées pour formuler des recommandations concrètes sur l'angle éditorial et la structure de la page cible.

Pour find_longtail_keywords : utilise cet outil dès que l'utilisateur demande des mots-clés longue traîne, des variations autour d'un sujet, des idées de requêtes peu concurrentielles, ou des opportunités de contenu depuis les données SERP réelles. Passe le mot-clé seed court (1-3 mots). Complémentaire à get_semrush_data : FetchSERP génère des suggestions à partir des recherches réelles sur la SERP, Semrush donne les volumes et la difficulté — utilise les deux quand disponibles.

Pour check_domain_ranking : utilise cet outil dès que l'utilisateur demande à quelle position se trouve un domaine sur un mot-clé, s'il ranke sur une requête, ou veut monitorer son positionnement. Transmets le domaine sans www ni https. Le paramètre pages_number détermine combien de pages SERP sont scannées (défaut 5 = top 50 positions). Si le domaine n'est pas trouvé, c'est qu'il ne rankait pas dans les N×10 premières positions.

Pour get_kpu_paa : utilise cet outil dès que l'utilisateur demande les questions "People Also Ask" (PAA) ou "Questions posées par les internautes" de Google pour un mot-clé. C'est la source la plus fiable pour alimenter une FAQ SEO ou un plan de contenu en questions réelles. Passe le mot-clé dans la langue du marché cible (country + language : 'fr' pour la France, 'us'/'en' pour les USA). Le résultat est une arborescence de questions Google en profondeur — utilise-la pour enrichir les articles, les FAQ structured data, et le GEO (citabilité par les IA).

Pour get_kpu_suggestions : utilise cet outil dès que l'utilisateur demande des suggestions Google Autocomplete, des mots-clés sémantiques connexes, ou des questions Reddit/Quora sur un sujet. Complémentaire à find_longtail_keywords (FetchSERP) et get_semrush_data mode keyword : KPU donne des suggestions issues de la recherche réelle (Autocomplete) et des communautés (Reddit/Quora), Semrush donne les volumes et la difficulté, FetchSERP donne les variations SERP. Utilise KPU en priorité pour la découverte sémantique et les FAQ conversationnelles.

Pour check_geo_visibility : utilise cet outil dès que l'utilisateur demande si un site (le sien ou un concurrent) est cité ou mentionné sur Perplexity, ChatGPT, Gemini, les IA, ou les moteurs génératifs pour un mot-clé donné. L'outil interroge RÉELLEMENT Perplexity et Gemini avec la requête, vérifie si le domaine cible apparaît dans leurs citations ou dans le texte de la réponse, et retourne la réponse brute + les sources citées + une synthèse de visibilité GEO. Exemples de déclencheurs : "est-ce que mon site est cité sur Perplexity quand on cherche X ?", "est-ce que laboratoire-roles.fr apparaît sur ChatGPT ou Perplexity pour cette requête ?", "analyse ma visibilité IA sur ce mot-clé". Toujours extraire le keyword exact et le site_url depuis la demande de l'utilisateur avant d'appeler.

Pour analyze_competitor_backlinks : utilise cet outil dès que l'utilisateur veut analyser les backlinks d'un concurrent, identifier des sources de liens à dupliquer, ou auditer le profil de netlinking d'un domaine tiers. Transmets le domaine cible sans www. Complémentaire à get_semrush_data mode domain qui donne aussi un aperçu des backlinks — FetchSERP fournit une liste détaillée avec ancres.

Règle générale impérative pour tous les outils : quand tu décides d'appeler un outil, appelle-le immédiatement dans le même tour de réponse. N'écris jamais de message d'annonce du type "je lance la génération" ou "un instant, je récupère les données" sans appeler l'outil dans la même réponse — ce serait une réponse vide qui n'aboutit à rien. Soit tu appelles l'outil tout de suite, soit tu réponds directement en texte.

Tu peux publier du contenu directement sur la boutique WooCommerce/WordPress connectée par l'utilisateur, via quatre outils dédiés — mais UNIQUEMENT quand l'utilisateur le demande explicitement ("publie cette fiche", "crée cet article sur mon site", "envoie ça sur WooCommerce"). N'appelle JAMAIS ces outils automatiquement juste après une génération de contenu — la publication, même en brouillon, est une action sur un site réel et doit toujours être une décision explicite. Reprends le contenu déjà généré dans la conversation plutôt que de le réécrire. Si l'utilisateur n'a pas encore connecté de boutique, indique-lui de connecter son WordPress depuis [la page Intégrations](/integrations) en 2 clics — pas besoin de clé API.

- search_woocommerce : rechercher produits ou catégories existants dans la boutique (par nom → retourne ID, statut, URL édition)
- get_woocommerce_product : lire une fiche produit existante (description + tous les champs ACF/Yoast avec leurs field keys)
- update_woocommerce_product : mettre à jour une fiche produit existante (description, description courte, champs ACF/Yoast) via l'API REST
- publish_product_to_woocommerce : fiche produit → WooCommerce (brouillon)
- publish_category_to_woocommerce : page de catégorie produit → WooCommerce
- publish_article_to_wordpress : article de blog → WordPress (brouillon)
- publish_page_to_wordpress : page de contenu → WordPress (brouillon)
- inject_wp_script : exécute un script JavaScript directement dans le navigateur de l'utilisateur sur une page WP Admin, via Mind Bridge

Pour modifier une fiche produit existante, la voie NORMALE et fiable est l'API REST, jamais Mind Bridge. Procédure obligatoire :

(1) search_woocommerce pour retrouver l'ID du produit.
(2) get_woocommerce_product avec cet ID — indispensable pour deux raisons : relever les field keys ACF exactes, ET noter le nombre actuel d'entrées dans chaque répéteur (champ \`repeteur = "6"\` → l'ancien max est 6).
(3) update_woocommerce_product avec les champs à modifier.

Règles ACF impératives :
- Pour chaque champ ACF, écrire DEUX entrées meta : la valeur (\`mon_champ\`) et la field key (\`_mon_champ\` = \`field_xxxxx\` telle que lue via get_woocommerce_product). Sans la field key, ACF ignore la valeur.
- Pour un répéteur : écrire le nouveau compteur (\`repeteur\` = "N"), puis chaque ligne indexée (\`repeteur_0_titre\`, \`repeteur_0_paragraphe\`…) avec leurs field keys. CRITIQUE : si l'ancien compteur (lu à l'étape 2) est supérieur à N, écrire AUSSI des entrées vides pour chaque index de N à ancien_max-1 (\`repeteur_N_titre\` = "", \`repeteur_N_paragraphe\` = ""…). Sans ce nettoyage, les anciens champs resteraient visibles comme entrées vides sur la page.
- Les valeurs de champs ACF texte long attendent du HTML (\`<p>\`, \`<strong>\`, \`<a href>\`), pas du markdown.

Règle publication obligatoire : avant d'appeler update_woocommerce_product, demander TOUJOURS à l'utilisateur s'il veut sauvegarder en **brouillon** ou mettre **en ligne**, sauf s'il l'a déjà précisé dans la conversation en cours — dans ce cas, retenir son choix sans redemander pour les mises à jour suivantes dans la même session. Par défaut si non précisé : brouillon.

Pour inject_wp_script : n'utilise cet outil qu'en DERNIER RECOURS, quand l'API REST ne peut objectivement pas faire le travail (interaction avec un écran WP Admin sans équivalent REST). Pour tout ce qui touche au contenu ou aux champs d'un produit, passe par update_woocommerce_product. RÈGLES ABSOLUES si tu l'utilises quand même : (1) n'écris JAMAIS le script JS dans ton texte de réponse avant d'appeler l'outil — génère le script directement dans le paramètre "script" de l'outil. (2) Le paramètre "script" doit TOUJOURS contenir le code JavaScript complet et fonctionnel, jamais null ou vide. (3) Quand tu appelles l'outil, précise TOUJOURS dans ta réponse texte que l'utilisateur doit avoir Mind Bridge actif sur la PAGE EXACTE fournie dans target_url — pas sur une autre page WP Admin. Mind Bridge s'exécute sur la page où le bookmarklet a été cliqué ; si l'utilisateur n'est pas sur la bonne URL, le script ne fera rien. Dis-lui : "Assure-toi que Mind Bridge est actif sur cette page précise : [URL]. Si tu es sur une autre page, navigue d'abord vers cette URL puis clique sur le bookmarklet." Si l'utilisateur n'a pas encore configuré Mind Bridge, indique-lui d'aller sur [la page Intégrations](/integrations).

Pour search_woocommerce : utilise cet outil dès que l'utilisateur mentionne un produit ou une catégorie existante ("le produit Gingembre jeune", "la catégorie Épices", "retrouve ce produit dans ma boutique"). Tu peux l'appeler avant de publier pour vérifier si un produit existe déjà et éviter les doublons. Retourne toujours l'ID et l'URL d'édition WP Admin pour que l'utilisateur puisse accéder directement au produit.

Si l'utilisateur a connecté sa Google Search Console et demande des données réelles sur un domaine (mots-clés positionnés, requêtes longue traîne, performances de recherche, clics, impressions, position), utilise immédiatement l'outil get_search_console_data avec le domaine mentionné, sans poser de questions de clarification au préalable — l'outil te dira lui-même si le domaine n'est pas accessible. N'utilise PAS cet outil si l'utilisateur n'a pas mentionné de domaine précis ou ne demande pas de données chiffrées issues de la Search Console.

Si l'utilisateur demande les mots-clés ou les pages positionnées sur une thématique précise (ex: "trouve-moi les mots-clés sur le curry", "quelles pages rankent sur le moringa"), transmets impérativement cette thématique dans le paramètre thematique de l'outil. Sans ce paramètre, l'outil ne renvoie que le top clics global du site, ce qui peut faire disparaître des thématiques de niche qui ont pourtant plusieurs pages positionnées dans la Search Console réelle — avec le paramètre thematique, l'outil interroge directement toutes les requêtes contenant ce terme, quel que soit leur volume. Une fois les résultats reçus, recense bien CHAQUE page distincte présente dans les données, pas seulement la première — il y en a très souvent plusieurs sur un même thème (page principale + variantes : pluriel, recette, ingrédient associé...).

Le filtre Search Console est une recherche LITTÉRALE de sous-chaîne, pas sémantique : "super-aliment" (avec un tiret) ne trouvera rien si les vraies requêtes des internautes sont "superfoods", "super food" ou "superaliments liste". Dès que la thématique demandée est un concept plutôt qu'un mot-clé unique et exact (synonymes possibles, traductions, formes singulier/pluriel, ingrédients associés que tu connais), remplis systématiquement le paramètre synonymes avec toutes les variantes pertinentes que tu peux déduire de ta propre expertise (ex: pour "super-aliment" sur un site d'épices : superfood, superfoods, super food, superaliments, et les ingrédients concrets concernés comme moringa, curcuma). L'outil interroge chaque variante séparément sur la vraie Search Console et fusionne les résultats — tu ne dois jamais inventer de données toi-même, mais tu dois fournir les bons termes de recherche pour que l'outil trouve les vraies données qui existent. Si le résultat reste vide après une thématique large avec plusieurs synonymes, alors seulement conclus à une absence réelle de données.

Le domaine mentionné par l'utilisateur n'est pas toujours écrit comme une URL propre : il peut s'agir d'un nom de marque ou de société parlé naturellement (ex: "studio seja" pour "studio-seja.com" ou "studioseja.fr"). Transmets le terme tel que l'utilisateur l'a formulé à l'outil get_search_console_data — il fait lui-même le rapprochement avec les propriétés connectées, espaces et tirets inclus. Si l'outil te signale une ambiguïté entre plusieurs domaines possibles, ne devine pas : présente les options à l'utilisateur et demande-lui de confirmer lequel il vise avant de continuer.

Quand tu t'appuies sur des données Search Console pour recommander une action de contenu, croise systématiquement le mot-clé/la requête avec la page qui génère déjà ses impressions et clics (fournie par l'outil). Si une page existe déjà et capte du trafic sur ce thème, ne recommande JAMAIS de créer un nouvel article dessus — cela créerait une cannibalisation et une incohérence éditoriale qui nuit à ta crédibilité. Dans ce cas, recommande plutôt : renforcer/optimiser la page existante (title, structure, profondeur de contenu), construire un cluster sémantique autour d'elle (articles satellites complémentaires qui maillent vers cette page sans dupliquer son sujet), ou un autre levier (netlinking, structured data, EEAT). Ne recommande la création d'un article totalement nouveau que si aucune page existante ne couvre déjà le sujet.

Pour les requêtes d'intention (NLP) via get_search_console_data, utilise le paramètre query_type dès que l'utilisateur parle de : "requêtes interrogatives", "requêtes commerciales", "requêtes locales", "requêtes navigationnelles", ou décrit le type de contenu (questions, comparatifs, prix, avis, "comment/pourquoi/quoi"...). Les quatre valeurs disponibles sont : interrogative (comment, pourquoi, quoi, est-ce que, how, what, why...), commercial (prix, acheter, avis, comparatif, offre, buy, review...), navigational (site officiel, connexion, login, contact, horaires...), local (près de, à [ville], near me...). Ce paramètre est exclusif avec thematique — ne passe pas les deux en même temps.

Pour les périodes longues via get_search_console_data, utilise le paramètre mois dès que l'utilisateur dit "sur les 3 mois", "sur 6 mois", "l'année dernière", "sur les 12 derniers mois". Les valeurs acceptées sont 1, 3, 6, ou 12. La Search Console stocke jusqu'à 16 mois de données (dataState=all). Si l'utilisateur ne précise pas de période, laisse le défaut (28 jours). Tu peux combiner mois et query_type dans le même appel : ex. "requêtes interrogatives sur les 6 derniers mois" → { query_type: "interrogative", mois: 6 }.

## Connexion Google Search Console

Quand l'utilisateur demande comment connecter la Search Console, comment lier son site, ou comment accéder à ses données GSC depuis l'app, réponds en 2-3 phrases (ce que ça apporte : données réelles de clics, requêtes, positions) puis inclus OBLIGATOIREMENT ce lien Markdown dans ta réponse pour qu'ils puissent le faire directement :

[→ Connecter ma Search Console](/api/gsc/auth)

Ne fournis pas d'autres instructions de connexion (Google Search Console externe, vérification de propriété, etc.) — l'app gère tout le processus OAuth en interne via ce lien.

## Format de réponse

Structure tes réponses avec des titres markdown (## pour les sections principales, ### pour les sous-sections) afin qu'elles soient bien hiérarchisées une fois affichées. Reste concis dans chaque section : privilégie des listes à puces courtes et actionnables plutôt que des paragraphes denses. Termine par une question ou une proposition d'action concrète quand cela invite à poursuivre l'échange.`;

const tools: Anthropic.Tool[] = [
  {
    name: "get_kpu_paa",
    description: "Extrait les questions 'People Also Ask' (PAA) de Google pour un mot-clé donné via Keywords People Use. Retourne une arborescence de questions réelles que les internautes posent autour de ce sujet — idéal pour construire des FAQ SEO, du contenu optimisé GEO, et identifier les intentions de recherche complémentaires.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Mot-clé ou sujet principal (dans la langue du marché cible)" },
        country: { type: "string", description: "Code pays ISO : 'fr' (France), 'us' (USA), 'uk' (UK), 'de' (Allemagne). Défaut : 'fr'" },
        language: { type: "string", description: "Code langue ISO : 'fr', 'en', 'de'. Défaut : 'fr'" },
        depth: { type: "number", description: "Profondeur d'exploration des questions PAA (1 à 3). Défaut : 2" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_kpu_suggestions",
    description: "Récupère des suggestions Google Autocomplete, des mots-clés sémantiques connexes, et des questions issues de Reddit/Quora pour un mot-clé donné via Keywords People Use. Outil de découverte sémantique complémentaire à Semrush et FetchSERP.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Mot-clé ou sujet principal (dans la langue du marché cible)" },
        country: { type: "string", description: "Code pays ISO : 'fr', 'us', 'uk', 'de'. Défaut : 'fr'" },
        language: { type: "string", description: "Code langue ISO : 'fr', 'en', 'de'. Défaut : 'fr'" },
      },
      required: ["keyword"],
    },
  },
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
    description: "Récupère les vraies données Google Search Console (requêtes, pages associées, clics, impressions, position moyenne) pour un domaine auquel l'utilisateur connecté a accès. Supporte le filtrage par thématique/synonymes, par type d'intention de requête (interrogative, commerciale, locale, navigationnelle), et des périodes longues (3, 6 ou 12 mois).",
    input_schema: {
      type: "object",
      properties: {
        domaine: { type: "string", description: "Nom de domaine demandé, ex: laplantation.com" },
        thematique: { type: "string", description: "Thématique ou mot-clé précis demandé par l'utilisateur (ex: curry, moringa) — si fourni, l'outil filtre toutes les requêtes contenant ce terme. Incompatible avec query_type : utilise l'un ou l'autre." },
        synonymes: {
          type: "array",
          items: { type: "string" },
          description: "Variantes, synonymes, traductions ou formes singulier/pluriel du terme demandé. Fournis toutes les variantes pertinentes pour compenser le fait que le filtre GSC est une recherche de sous-chaîne littérale.",
        },
        query_type: {
          type: "string",
          enum: ["interrogative", "commercial", "navigational", "local"],
          description: "Filtre par type d'intention de recherche (une seule requête GSC native, OR sur les patterns caractéristiques). 'interrogative' = comment/quoi/pourquoi/où/quand/quel/est-ce que... ; 'commercial' = prix/acheter/avis/comparatif/promo... ; 'navigational' = site/connexion/contact/horaires... ; 'local' = près de/à [ville]/near me... Incompatible avec thematique : utilise l'un ou l'autre.",
        },
        mois: {
          type: "number",
          enum: [1, 3, 6, 12],
          description: "Période en mois (1 = 30 j, 3 = 90 j, 6 = 180 j, 12 = 365 j). Remplace le paramètre jours quand l'utilisateur demande explicitement '3 mois', '6 mois', 'l'année dernière'. La Search Console stocke jusqu'à 16 mois de données.",
        },
        jours: { type: "number", description: "Période en jours à analyser (par défaut 28). Ignoré si mois est fourni." },
      },
      required: ["domaine"],
    },
  },
  {
    name: "search_woocommerce",
    description: "Recherche des produits ou des catégories existants dans la boutique WooCommerce connectée par l'utilisateur, par nom. Utilise cet outil dès que l'utilisateur mentionne un produit ou une catégorie existante et a besoin de son ID, de son URL d'édition, ou de confirmer qu'il existe. Retourne l'ID, le nom, le statut et l'URL d'édition WP Admin.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["products", "categories"], description: "Type de recherche : 'products' pour les fiches produit, 'categories' pour les catégories WooCommerce" },
        query: { type: "string", description: "Terme de recherche (nom du produit ou de la catégorie)" },
      },
      required: ["type", "query"],
    },
  },
  {
    name: "get_woocommerce_product",
    description: "Lit une fiche produit WooCommerce existante par son ID : description, description courte, et TOUS les champs personnalisés (ACF, Yoast) avec leurs field keys. Appelle TOUJOURS cet outil avant update_woocommerce_product pour connaître la structure réelle des champs du thème — beaucoup de sites stockent le contenu visible dans des champs ACF et non dans la description WooCommerce.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "number", description: "ID numérique du produit WooCommerce" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "update_woocommerce_product",
    description: "Met à jour une fiche produit WooCommerce existante via l'API REST : description, description courte, statut de publication, et champs personnalisés ACF/Yoast. N'utilise cet outil QUE sur demande explicite de l'utilisateur. Appelle d'abord get_woocommerce_product pour connaître les clés de champs exactes et le nombre actuel d'entrées dans les répéteurs ACF.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "number", description: "ID numérique du produit à mettre à jour" },
        publish_status: { type: "string", enum: ["draft", "publish"], description: "Statut après mise à jour : 'draft' pour garder en brouillon, 'publish' pour mettre en ligne. OBLIGATOIRE : demander à l'utilisateur s'il veut brouillon ou en ligne avant d'appeler l'outil, sauf s'il l'a déjà précisé dans cette conversation (retenir son choix pour toute la session)." },
        description_html: { type: "string", description: "Nouvelle description longue en HTML. Omettre pour ne pas y toucher." },
        short_description_html: { type: "string", description: "Nouvelle description courte en HTML. Omettre pour ne pas y toucher." },
        meta: {
          type: "array",
          description: "Champs personnalisés à écrire. Règle ACF obligatoire : pour chaque champ écrire la PAIRE valeur ({key:'champ', value:'...'}) + field key ({key:'_champ', value:'field_xxxxx'}). Pour un répéteur ACF : (1) écrire le nouveau compteur ({key:'repeteur', value:'N'}), (2) écrire chaque ligne indexée (repeteur_0_titre, repeteur_0_paragraphe…), (3) IMPORTANT si l'ancien compteur lu via get_woocommerce_product est supérieur à N, écrire explicitement des entrées vides pour chaque index au-delà de N-1 jusqu'à l'ancien max — sinon les anciens champs resteront visibles en tant qu'entrées vides sur la page.",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
            required: ["key", "value"],
          },
        },
      },
      required: ["product_id", "publish_status"],
    },
  },
  {
    name: "publish_product_to_woocommerce",
    description: "Crée une fiche produit en BROUILLON sur la boutique WooCommerce connectée par l'utilisateur. N'utilise cet outil QUE si l'utilisateur demande explicitement de publier/créer le produit — jamais automatiquement. Reprends le contenu déjà généré dans la conversation plutôt que de le réécrire.",
    input_schema: {
      type: "object",
      properties: {
        nom_produit: { type: "string", description: "Nom du produit" },
        title_seo: { type: "string", description: "Balise title SEO déjà générée" },
        meta_description: { type: "string", description: "Meta description déjà générée" },
        description_complete: { type: "string", description: "Description complète du produit en markdown (pitch + description longue + points clés)" },
        prix: { type: "string", description: "Prix régulier, si connu" },
      },
      required: ["nom_produit", "description_complete"],
    },
  },
  {
    name: "publish_category_to_woocommerce",
    description: "Crée une page de catégorie produit sur la boutique WooCommerce connectée. Utiliser après avoir généré le contenu de la catégorie, uniquement si l'utilisateur le demande explicitement.",
    input_schema: {
      type: "object",
      properties: {
        nom_categorie: { type: "string", description: "Nom de la catégorie" },
        description: { type: "string", description: "Description de la catégorie en markdown" },
        title_seo: { type: "string", description: "Balise title SEO" },
        meta_description: { type: "string", description: "Meta description" },
      },
      required: ["nom_categorie"],
    },
  },
  {
    name: "publish_article_to_wordpress",
    description: "Publie un article de blog en BROUILLON sur le WordPress connecté. N'utilise cet outil QUE sur demande explicite de l'utilisateur. Reprends le contenu généré dans la conversation plutôt que de le réécrire.",
    input_schema: {
      type: "object",
      properties: {
        titre: { type: "string", description: "Titre de l'article (H1)" },
        contenu_markdown: { type: "string", description: "Contenu complet de l'article en markdown" },
        extrait: { type: "string", description: "Extrait court (méta/résumé), si disponible" },
        title_seo: { type: "string", description: "Balise title SEO, si différente du titre H1" },
        meta_description: { type: "string", description: "Meta description déjà générée" },
      },
      required: ["titre", "contenu_markdown"],
    },
  },
  {
    name: "publish_page_to_wordpress",
    description: "Crée une page WordPress en BROUILLON (page SEO, landing page, page de contenu). N'utilise cet outil QUE sur demande explicite. Reprends le contenu généré dans la conversation.",
    input_schema: {
      type: "object",
      properties: {
        titre: { type: "string", description: "Titre de la page" },
        contenu_markdown: { type: "string", description: "Contenu complet en markdown" },
        title_seo: { type: "string", description: "Balise title SEO" },
        meta_description: { type: "string", description: "Meta description" },
      },
      required: ["titre", "contenu_markdown"],
    },
  },
  {
    name: "get_semrush_data",
    description: "Accède aux données Semrush pour enrichir une analyse SEO. Deux modes : (1) mode 'domain' — mots-clés organiques positionnés, top pages et profil de backlinks d'un domaine donné ; (2) mode 'keyword' — idées de mots-clés connexes et questions générées par un mot-clé ou une thématique. Utilise ce tool quand l'utilisateur mentionne un domaine sans Search Console connectée, ou quand il demande des idées de mots-clés / analyse thématique sans données GSC disponibles.",
    input_schema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["domain", "keyword"],
          description: "domain : analyse d'un domaine (mots-clés positionnés, top pages, backlinks). keyword : recherche de mots-clés connexes et questions autour d'une thématique.",
        },
        domain: { type: "string", description: "Domaine à analyser en mode 'domain' (ex: laplantation.com). Sans www, sans https." },
        keyword: { type: "string", description: "Mot-clé seed à explorer en mode 'keyword'. Utilise un terme court (1-3 mots max) dans la langue de la base Semrush choisie — pour la base 'fr' préfère le français (ex: 'épices indiennes', 'curry'), pour 'us'/'uk' l'anglais. Évite les phrases longues, Semrush travaille sur des seeds courts." },
        database: { type: "string", description: "Base de données Semrush (pays). Par défaut 'fr' pour la France. Autres valeurs : 'us', 'uk', 'de', 'es', 'it', 'be'." },
      },
      required: ["mode"],
    },
  },
  // DISABLED — Keywords Everywhere (crédits épuisés, réactiver quand rechargé)
  // { name: "get_keyword_trends", ... }
  {
    name: "get_gbp_insights",
    description: "Récupère les données Google Business Profile (GBP) de l'utilisateur connecté : mots-clés de recherche locaux (ce que les internautes ont tapé pour trouver la fiche), métriques de performance (vues, clics site, appels, demandes d'itinéraire) et informations de la fiche. Utilise cet outil quand l'utilisateur demande une analyse SEO local, un audit de sa fiche GBP, ou les mots-clés qui génèrent de la visibilité locale. Nécessite que l'utilisateur ait connecté son compte Google avec le scope business.manage.",
    input_schema: {
      type: "object",
      properties: {
        business_name: { type: "string", description: "Nom partiel ou complet de l'établissement pour filtrer parmi les fiches si le compte en gère plusieurs. Optionnel — sans ce paramètre, l'outil retourne toutes les fiches gérées." },
      },
      required: [],
    },
  },
  {
    name: "reddit_research",
    description: "Analyse les discussions Reddit pour enrichir la connaissance sémantique d'une thématique, identifier des opportunités de ninja linking / mentions de marque, ou découvrir des sujets à fort engagement pour alimenter une stratégie de contenu.",
    input_schema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["semantic_research", "ninja_linking", "topic_discovery"],
          description: "semantic_research : enrichissement sémantique + intentions de recherche (vocabulaire réel des internautes, pain points, clusters de mots-clés). ninja_linking : opportunités de présence naturelle sur Reddit (questions ouvertes, mentions de la marque ou concurrents, contextes propices à une réponse d'expertise). topic_discovery : découverte de sujets et idées de contenu à partir des discussions les plus engageantes.",
        },
        sujet: { type: "string", description: "Thématique ou mot-clé à analyser sur Reddit. IMPORTANT : Reddit est quasi exclusivement en anglais — traduis systématiquement le sujet en anglais avant de l'envoyer (ex: 'épices indiennes' → 'indian spices', 'maillage interne' → 'internal linking seo'). Pour maximiser les résultats, fournis un terme générique anglais, pas une traduction littérale." },
        marque: { type: "string", description: "Nom de la marque à monitorer (pour le mode ninja_linking, afin d'identifier les mentions et le contexte concurrentiel)" },
        mots_cles: {
          type: "array",
          items: { type: "string" },
          description: "Mots-clés ou expressions cibles à rechercher dans les discussions (pour ninja_linking et semantic_research)",
        },
        subreddits: {
          type: "array",
          items: { type: "string" },
          description: "Liste de subreddits spécifiques à analyser (sans 'r/', ex: ['frugal', 'EatCheapAndHealthy', 'france']). Si absent, la recherche est globale.",
        },
      },
      required: ["mode", "sujet"],
    },
  },
  {
    name: "analyze_serp",
    description: "Analyse la SERP Google pour une requête donnée : top 10 résultats organiques, domaines positionnés, featured snippet, requêtes associées. Utilise cet outil pour analyser le top 10 d'un mot-clé cible, identifier les concurrents directs sur une SERP, comprendre les formats qui dominent (articles, e-commerce, forums...), ou extraire des insights pour optimiser/créer une page.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Requête de recherche à analyser sur la SERP (dans la langue du marché cible)" },
        country: { type: "string", description: "Code pays ISO (ex: fr, us, uk, de). Défaut : fr" },
        search_engine: { type: "string", description: "Moteur de recherche : google, bing, duckduckgo. Défaut : google" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_longtail_keywords",
    description: "Génère des mots-clés longue traîne autour d'un sujet ou mot-clé principal à partir des données SERP réelles. Utilise cet outil quand l'utilisateur demande des variations longue traîne, des idées de requêtes peu concurrentielles, ou des opportunités de contenu.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Mot-clé ou sujet principal (1-3 mots, dans la langue du marché cible)" },
        count: { type: "number", description: "Nombre de mots-clés à générer (défaut : 20)" },
        search_intent: { type: "string", description: "Filtre par intention : informational, commercial, transactional, navigational. Optionnel." },
        country: { type: "string", description: "Code pays ISO (ex: fr, us). Défaut : fr" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "check_domain_ranking",
    description: "Vérifie la position (ranking) d'un domaine sur Google pour un mot-clé. Répond à des questions comme 'à quelle position se trouve [domaine] sur [mot-clé]', 'est-ce que [domaine] ranke sur [requête]', ou 'donne-moi des infos sur le ranking de mon site sur ...'.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Mot-clé ou requête pour laquelle vérifier le ranking" },
        domain: { type: "string", description: "Domaine à vérifier, sans www ni https (ex: laplantation.com)" },
        country: { type: "string", description: "Code pays ISO (ex: fr, us). Défaut : fr" },
        pages_number: { type: "number", description: "Nombre de pages SERP à scanner (1 page = 10 résultats). Défaut : 5 = top 50 positions" },
      },
      required: ["keyword", "domain"],
    },
  },
  {
    name: "analyze_competitor_backlinks",
    description: "Analyse le profil de backlinks d'un domaine concurrent : sources de liens, ancres utilisées, opportunités de netlinking par imitation. Utilise cet outil quand l'utilisateur veut analyser les backlinks de concurrents ou identifier des sources à dupliquer pour sa stratégie de netlinking.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Domaine à analyser, sans www ni https (ex: concurrent.com)" },
        country: { type: "string", description: "Code pays ISO pour contextualiser la recherche (ex: fr, us). Défaut : fr" },
        pages_number: { type: "number", description: "Profondeur d'analyse : pages de résultats à scanner. Défaut : 3" },
      },
      required: ["domain"],
    },
  },
  {
    name: "inject_wp_script",
    description: "Injecte et exécute un script JavaScript directement dans le navigateur de l'utilisateur sur une page WordPress Admin, via Mind Bridge (bookmarklet). Utilise cet outil quand tu as généré un script ACF ou WP Admin à exécuter — il sera transmis automatiquement au navigateur si Mind Bridge est actif. L'utilisateur doit avoir activé Mind Bridge sur la page WP Admin cible avant l'exécution.",
    input_schema: {
      type: "object",
      properties: {
        script: { type: "string", description: "Le code JavaScript complet à exécuter sur la page WP Admin" },
        description: { type: "string", description: "Description courte de ce que fait le script (affichée dans le badge Mind Bridge)" },
        target_url: { type: "string", description: "URL de la page WP Admin où exécuter le script (ex: https://site.com/wp-admin/post.php?post=123&action=edit). Optionnel mais recommandé." },
      },
      required: ["script", "description"],
    },
  },
  {
    name: "check_geo_visibility",
    description: "Interroge directement Perplexity et Gemini (avec recherche web activée) pour vérifier si un site est cité ou mentionné dans leurs réponses à une requête donnée. Utilise cet outil quand l'utilisateur demande si son site (ou un concurrent) apparaît sur Perplexity, ChatGPT, Gemini, ou les IA en général pour un mot-clé. Retourne la réponse réelle du LLM, la position de citation, les sources concurrentes citées, et une synthèse de visibilité GEO.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "La requête à taper — exactement comme l'utilisateur la formulerait sur Perplexity ou Gemini (ex: 'laboratoire de prothèse dentaire à Paris')" },
        site_url: { type: "string", description: "Le site à vérifier (ex: https://laboratoire-roles.fr ou laboratoire-roles.fr)" },
        platforms: {
          type: "array",
          items: { type: "string", enum: ["perplexity", "gemini", "openai"] },
          description: "Plateformes à interroger. Défaut : ['perplexity', 'gemini', 'openai']. Utilise les trois sauf si l'utilisateur précise une ou deux plateformes spécifiques.",
        },
      },
      required: ["keyword", "site_url"],
    },
  },
  {
    name: "generate_strategy_action_plan",
    description: "Génère un plan d'action stratégique concret sur un axe précis (SEO local, GEO, netlinking, ou maillage interne). S'appuie sur les vraies données Search Console du domaine si l'utilisateur en a connecté un, sinon sur le contexte fourni.",
    input_schema: {
      type: "object",
      properties: {
        axe: { type: "string", enum: ["seo_local", "geo", "netlinking", "maillage_interne"], description: "Axe stratégique ciblé" },
        domaine: { type: "string", description: "Domaine concerné, si connecté via Search Console" },
        thematique: { type: "string", description: "Thématique précise à cibler si l'utilisateur en mentionne une (ex: curry, moringa) — limite l'analyse à cette thématique plutôt qu'au top clics global du site, surtout utile pour l'axe maillage_interne." },
        synonymes: {
          type: "array",
          items: { type: "string" },
          description: "Variantes, synonymes, traductions ou formes singulier/pluriel de la thématique (ex: pour 'super-aliment' : ['superfood','superfoods','super food','superaliments','moringa','curcuma']). Le filtre Search Console est littéral, pas sémantique — fournis toutes les variantes pertinentes que tu connais pour ne rater aucune page concernée.",
        },
        langue: { type: "string", description: "Répertoire de langue cible (ex: 'fr', 'en', 'de') pour les sites multilingues avec structure /fr/, /en/, /de/... dans les URLs. Si le site a plusieurs versions linguistiques et que l'utilisateur n'a pas précisé, ne transmets pas ce paramètre — l'outil demandera lui-même à l'utilisateur." },
        contexte: { type: "string", description: "Contexte additionnel (secteur, zone géographique, objectifs, description des pages du site...)" },
      },
      required: ["axe"],
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

interface PublishProductParams {
  nom_produit: string;
  title_seo?: string;
  meta_description?: string;
  description_complete: string;
  prix?: string;
}

interface PublishCategoryParams {
  nom_categorie: string;
  description?: string;
  title_seo?: string;
  meta_description?: string;
}

interface PublishWpContentParams {
  titre: string;
  contenu_markdown: string;
  extrait?: string;
  title_seo?: string;
  meta_description?: string;
}

async function searchWoocommerce(p: { type: "products" | "categories"; query: string }, userId: string): Promise<string> {
  const conn = await getWcConnection(userId);
  if (!conn) {
    return "❌ Aucune boutique WooCommerce connectée. [→ Connecter mon WordPress](/integrations)";
  }
  const creds = {
    storeUrl: conn.storeUrl,
    consumerKey: conn.wcConsumerKey || undefined,
    consumerSecret: conn.wcConsumerSecret || undefined,
    wpUsername: conn.wpUsername || undefined,
    wpAppPassword: conn.wpAppPassword || undefined,
  };
  try {
    const results = p.type === "products"
      ? await searchProducts(creds, p.query)
      : await searchCategories(creds, p.query);

    if (results.length === 0) {
      return `Aucun(e) ${p.type === "products" ? "produit" : "catégorie"} trouvé(e) pour "${p.query}" dans la boutique **${conn.storeUrl}**.`;
    }

    const label = p.type === "products" ? "Produits" : "Catégories";
    const lines = [`**${label} trouvé(s) pour "${p.query}" dans ${conn.storeUrl} :**\n`];
    for (const r of results) {
      lines.push(`- **${r.name}** (ID: ${r.id}) — statut: ${r.status}${r.sku ? ` · SKU: ${r.sku}` : ""} — [Éditer ↗](${r.editUrl})`);
    }
    return lines.join("\n");
  } catch (e) {
    return `❌ Erreur recherche WooCommerce : ${e instanceof Error ? e.message : "erreur inconnue"}`;
  }
}

function wcCredsFrom(conn: { storeUrl: string; wcConsumerKey: string; wcConsumerSecret: string; wpUsername: string; wpAppPassword: string }) {
  return {
    storeUrl: conn.storeUrl,
    consumerKey: conn.wcConsumerKey || undefined,
    consumerSecret: conn.wcConsumerSecret || undefined,
    wpUsername: conn.wpUsername || undefined,
    wpAppPassword: conn.wpAppPassword || undefined,
  };
}

async function getWooProduct(productId: number, userId: string): Promise<string> {
  const conn = await getWcConnection(userId);
  if (!conn) return "❌ Aucune boutique WooCommerce connectée. [→ Connecter mon WordPress](/integrations)";
  try {
    const p = await getProduct(wcCredsFrom(conn), productId);
    const fieldKeys = new Map<string, string>();
    for (const m of p.meta) {
      if (m.key.startsWith("_") && typeof m.value === "string" && m.value.startsWith("field_")) {
        fieldKeys.set(m.key.slice(1), m.value);
      }
    }
    const lines = [
      `**${p.name}** (ID ${p.id}) — statut : ${p.status}`,
      `[Éditer ↗](${p.editUrl})`,
      ``,
      `**description** (${p.description.length} car.) : ${p.description.slice(0, 400) || "_vide_"}`,
      `**short_description** (${p.shortDescription.length} car.) : ${p.shortDescription.slice(0, 400) || "_vide_"}`,
      ``,
      `**Champs personnalisés :**`,
    ];
    for (const m of p.meta) {
      if (m.key.startsWith("_") && fieldKeys.has(m.key.slice(1))) continue;
      const val = typeof m.value === "string" ? m.value : JSON.stringify(m.value);
      if (!val) continue;
      const fk = fieldKeys.get(m.key);
      lines.push(`- \`${m.key}\`${fk ? ` (ACF field key : \`${fk}\`)` : ""} = ${val.slice(0, 300)}`);
    }
    return lines.join("\n");
  } catch (e) {
    return `❌ Erreur lecture produit : ${e instanceof Error ? e.message : "erreur inconnue"}`;
  }
}

interface UpdateProductParams {
  product_id?: number;
  publish_status?: "draft" | "publish";
  description_html?: string;
  short_description_html?: string;
  meta?: { key: string; value: string }[];
}

async function updateWooProduct(p: UpdateProductParams, userId: string): Promise<string> {
  const conn = await getWcConnection(userId);
  if (!conn) return "❌ Aucune boutique WooCommerce connectée. [→ Connecter mon WordPress](/integrations)";
  if (!p.product_id) return "❌ L'ID du produit est manquant. Utilise search_woocommerce pour le retrouver.";
  const status = p.publish_status ?? "draft";
  try {
    const result = await updateProduct(wcCredsFrom(conn), p.product_id, {
      status,
      description: p.description_html,
      shortDescription: p.short_description_html,
      meta: p.meta,
    });
    const changed = [
      p.description_html !== undefined ? "description longue" : null,
      p.short_description_html !== undefined ? "description courte" : null,
      p.meta?.length ? `${p.meta.length} champ(s) personnalisé(s)` : null,
    ].filter(Boolean).join(", ");
    const statusLabel = status === "publish" ? "🟢 **en ligne**" : "📝 **brouillon**";
    return `✅ **Fiche produit mise à jour** sur ${conn.storeUrl} — statut : ${statusLabel}\n\n**Champs modifiés :** ${changed}\n\n[Voir la fiche ↗](${result.permalink}) · [Éditer dans WordPress ↗](${result.editUrl})`;
  } catch (e) {
    console.error("[assistant woo update] error:", e);
    return `❌ Erreur mise à jour WooCommerce : ${e instanceof Error ? e.message : "erreur inconnue"}`;
  }
}

async function publishProductToWoo(p: PublishProductParams, userId: string): Promise<string> {
  const conn = await getWcConnection(userId);
  if (!conn) {
    return "❌ Aucune boutique WooCommerce connectée. [→ Connecter mon WordPress](/integrations)";
  }
  try {
    const descriptionHtml = await marked.parse(p.description_complete);
    const result = await createDraftProduct(
      {
        storeUrl: conn.storeUrl,
        consumerKey: conn.wcConsumerKey || undefined,
        consumerSecret: conn.wcConsumerSecret || undefined,
        wpUsername: conn.wpUsername || undefined,
        wpAppPassword: conn.wpAppPassword || undefined,
      },
      { name: p.nom_produit, descriptionHtml, metaTitle: p.title_seo, metaDescription: p.meta_description, regularPrice: p.prix }
    );
    return `✅ Fiche produit créée en brouillon sur **${conn.storeUrl}**\n\n**${p.nom_produit}**\n\n[Éditer dans WordPress ↗](${result.editUrl})\n\nLe produit est en statut brouillon — relis-le et publie-le toi-même quand tu es prêt.\n\n---\n\n${p.description_complete}`;
  } catch (e) {
    console.error("[assistant woocommerce product] error:", e);
    return `❌ Erreur WooCommerce : ${e instanceof Error ? e.message : "erreur inconnue"}`;
  }
}

async function publishCategoryToWoo(p: PublishCategoryParams, userId: string): Promise<string> {
  const conn = await getWcConnection(userId);
  if (!conn) {
    return "❌ Aucune boutique WooCommerce connectée. [→ Connecter mon WordPress](/integrations)";
  }
  try {
    const result = await createProductCategory(
      {
        storeUrl: conn.storeUrl,
        consumerKey: conn.wcConsumerKey || undefined,
        consumerSecret: conn.wcConsumerSecret || undefined,
        wpUsername: conn.wpUsername || undefined,
        wpAppPassword: conn.wpAppPassword || undefined,
      },
      { name: p.nom_categorie, description: p.description, metaTitle: p.title_seo, metaDescription: p.meta_description }
    );
    return `✅ Catégorie produit créée sur **${conn.storeUrl}**\n\n**${p.nom_categorie}** (slug: \`${result.slug}\`)\n\n[Éditer dans WordPress ↗](${result.editUrl})\n\n${p.description ?? ""}`;
  } catch (e) {
    console.error("[assistant woocommerce category] error:", e);
    return `❌ Erreur WooCommerce Catégories : ${e instanceof Error ? e.message : "erreur inconnue"}`;
  }
}

async function publishArticleToWp(p: PublishWpContentParams, userId: string): Promise<string> {
  const conn = await getWcConnection(userId);
  if (!conn) {
    return "❌ Aucun site WordPress connecté. [→ Connecter mon WordPress](/integrations)";
  }
  try {
    const contentHtml = await marked.parse(p.contenu_markdown);
    const result = await createDraftPost(
      { storeUrl: conn.storeUrl, wpUsername: conn.wpUsername, wpAppPassword: conn.wpAppPassword },
      { title: p.titre, contentHtml, excerpt: p.extrait, metaTitle: p.title_seo, metaDescription: p.meta_description }
    );
    return `✅ Article publié en brouillon sur **${conn.storeUrl}**\n\n**${p.titre}**\n\n[Éditer dans WordPress ↗](${result.editUrl})\n\n---\n\n${p.contenu_markdown}`;
  } catch (e) {
    console.error("[assistant wp article] error:", e);
    return `❌ Erreur WordPress (article) : ${e instanceof Error ? e.message : "erreur inconnue"}`;
  }
}

async function publishPageToWp(p: PublishWpContentParams, userId: string): Promise<string> {
  const conn = await getWcConnection(userId);
  if (!conn) {
    return "❌ Aucun site WordPress connecté. [→ Connecter mon WordPress](/integrations)";
  }
  try {
    const contentHtml = await marked.parse(p.contenu_markdown);
    const result = await createDraftPage(
      { storeUrl: conn.storeUrl, wpUsername: conn.wpUsername, wpAppPassword: conn.wpAppPassword },
      { title: p.titre, contentHtml, metaTitle: p.title_seo, metaDescription: p.meta_description }
    );
    return `✅ Page créée en brouillon sur **${conn.storeUrl}**\n\n**${p.titre}**\n\n[Éditer dans WordPress ↗](${result.editUrl})\n\n---\n\n${p.contenu_markdown}`;
  } catch (e) {
    console.error("[assistant wp page] error:", e);
    return `❌ Erreur WordPress (page) : ${e instanceof Error ? e.message : "erreur inconnue"}`;
  }
}

interface GscDataParams {
  domaine: string;
  thematique?: string;
  synonymes?: string[];
  query_type?: "interrogative" | "commercial" | "navigational" | "local";
  mois?: 1 | 3 | 6 | 12;
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

// Compare en ignorant espaces/tirets/points pour matcher "studio seja" <-> "studio-seja.com"
function fuzzyKey(input: string): string {
  return normalizeDomain(input).replace(/[^a-z0-9]/g, "");
}

interface GscDataset {
  domaine: string;
  periode_jours: number;
  metriques_globales: { clicks: number; impressions: number; ctr: number; position: number };
  requetes_et_pages_associees: { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

type GscResolution = { ok: true; data: GscDataset } | { ok: false; message: string };

async function resolveGscDataset(
  sessionId: string | undefined,
  domaine: string,
  jours = 28,
  thematique?: string,
  synonymes?: string[],
  queryType?: "interrogative" | "commercial" | "navigational" | "local",
): Promise<GscResolution> {
  if (!sessionId) {
    return { ok: false, message: "Aucune Search Console connectée. Invite l'utilisateur à cliquer sur \"Connecter Google Search Console\" sur la page d'accueil avant de pouvoir consulter ses données." };
  }

  const accessToken = await getValidAccessToken(sessionId);
  if (!accessToken) {
    return { ok: false, message: "Aucune Search Console connectée ou la connexion a expiré. Invite l'utilisateur à cliquer sur \"Connecter Google Search Console\" sur la page d'accueil." };
  }

  let sites;
  try {
    sites = await listGscSites(accessToken);
  } catch {
    return { ok: false, message: "Erreur lors de la récupération des propriétés Search Console de l'utilisateur." };
  }

  const target = normalizeDomain(domaine);
  let match = sites.find(s => normalizeDomain(s.siteUrl) === target || normalizeDomain(s.siteUrl).includes(target));

  if (!match) {
    const targetFuzzy = fuzzyKey(domaine);
    const fuzzyCandidates = sites.filter(s => {
      const k = fuzzyKey(s.siteUrl);
      return k === targetFuzzy || k.includes(targetFuzzy) || targetFuzzy.includes(k);
    });
    if (fuzzyCandidates.length === 1) {
      match = fuzzyCandidates[0];
    } else if (fuzzyCandidates.length > 1) {
      const options = fuzzyCandidates.map(s => s.siteUrl).join(", ");
      return { ok: false, message: `Plusieurs propriétés Search Console correspondent possiblement à "${domaine}" : ${options}. Demande à l'utilisateur de confirmer laquelle il vise avant de continuer, ne devine pas.` };
    }
  }

  if (!match) {
    const available = sites.map(s => s.siteUrl).join(", ") || "aucune";
    return { ok: false, message: `Le domaine "${domaine}" n'est pas accessible avec le compte Google connecté. Propriétés disponibles : ${available}. Informe l'utilisateur de cette liste et demande-lui de préciser s'il voulait l'une d'entre elles.` };
  }

  const topics = [thematique, ...(synonymes || [])].filter((t): t is string => !!t && t.trim().length > 0);

  try {
    const [metrics, queriesWithPages] = await Promise.all([
      getGscSiteMetrics(accessToken, match.siteUrl, jours),
      queryType
        ? getGscQueriesByPatterns(accessToken, match.siteUrl, GSC_INTENT_PATTERNS[queryType] ?? [], jours, 150)
        : topics.length > 0
          ? getGscQueriesByTopics(accessToken, match.siteUrl, topics, jours, 60)
          : getGscQueriesWithPages(accessToken, match.siteUrl, jours, 50),
    ]);
    return {
      ok: true,
      data: {
        domaine: match.siteUrl,
        periode_jours: jours,
        metriques_globales: metrics,
        requetes_et_pages_associees: queriesWithPages,
      },
    };
  } catch (e) {
    console.error("[assistant gsc] error:", e);
    return { ok: false, message: "Erreur lors de la récupération des données Search Console pour ce domaine." };
  }
}

async function getSearchConsoleDataForChat(sessionId: string | undefined, p: GscDataParams): Promise<string> {
  const effectiveDays = p.mois ? p.mois * 30 : (p.jours ?? 28);
  const res = await resolveGscDataset(sessionId, p.domaine, effectiveDays, p.thematique, p.synonymes, p.query_type);
  if (!res.ok) return res.message;

  let note: string;
  if (p.query_type) {
    const typeLabels: Record<string, string> = {
      interrogative: "interrogatives (comment, quoi, pourquoi, où, quand, quel, est-ce que...)",
      commercial: "commerciales / transactionnelles (prix, acheter, avis, comparatif, promo...)",
      navigational: "navigationnelles (site officiel, connexion, contact, horaires...)",
      local: "locales (près de, à [ville], near me...)",
    };
    const label = typeLabels[p.query_type] ?? p.query_type;
    const period = p.mois ? `${p.mois} mois` : `${effectiveDays} jours`;
    note = `Requêtes ${label} sur les ${period} — filtre OR natif GSC sur l'ensemble des patterns caractéristiques de cette intention. Les résultats incluent toutes les requêtes contenant au moins un de ces patterns, triées par clics décroissants. Associe chaque requête à la page source pour identifier les pages déjà positionnées et éviter la cannibalisation.`;
  } else if (p.thematique) {
    note = `Ces requêtes sont filtrées sur "${p.thematique}"${p.synonymes?.length ? ` + variantes (${p.synonymes.join(", ")})` : ""} — la liste couvre potentiellement plusieurs pages distinctes ciblant des variantes du sujet. Recense bien CHAQUE page distincte présente dans les résultats, pas seulement la première. Si aucun résultat n'apparaît, élargis les variantes et réessaie avant de conclure à une absence de données.`;
  } else {
    const period = p.mois ? `${p.mois} mois` : `${effectiveDays} jours`;
    note = `Top requêtes du site sur les ${period}, triées par clics. Chaque requête est associée à la page qui génère ses impressions/clics. Avant de recommander un nouveau contenu, vérifie si une page existante couvre déjà le sujet.`;
  }

  return JSON.stringify({ ...res.data, periode_jours: effectiveDays, note });
}

interface KeywordTrendsParams {
  keywords: string[];
  country?: string;
}

interface SemrushParams {
  mode: "domain" | "keyword";
  domain?: string;
  keyword?: string;
  database?: string;
}

async function getKeywordTrendsForAssistant(p: KeywordTrendsParams): Promise<string> {
  if (!process.env.KE_API_KEY) {
    return "La clé API Keywords Everywhere (KE_API_KEY) n'est pas configurée dans l'environnement.";
  }
  if (!p.keywords?.length) return "Aucun mot-clé fourni.";

  const country = p.country ?? "fr";
  const results = await getKeKeywordData(p.keywords.slice(0, 10), country);

  if (!results.length) return `Aucune donnée Keywords Everywhere retournée pour ces mots-clés en base '${country}'. Vérifie que la clé API est valide et que le crédit est suffisant.`;

  const lines = [
    `## Keywords Everywhere — Métriques & tendances (base : ${country.toUpperCase()})\n`,
    "| Mot-clé | Volume/mois | CPC | Compétition | Tendance (6 derniers mois) |",
    "|---------|------------|-----|------------|---------------------------|",
  ];

  for (const k of results) {
    const trend6 = k.trend.slice(-6).map(t => t.value);
    const trendStr = trend6.length
      ? trend6.map(v => {
          if (v >= 80) return "▲";
          if (v >= 40) return "→";
          return "▼";
        }).join(" ")
      : "—";
    lines.push(
      `| ${k.keyword} | ${k.volume.toLocaleString("fr")} | ${k.cpc.toFixed(2)}€ | ${(k.competition * 100).toFixed(0)}% | ${trendStr} |`
    );
  }

  return lines.join("\n");
}

async function getSemrushDataForAssistant(p: SemrushParams): Promise<string> {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) return "La clé API Semrush (SEMRUSH_API_KEY) n'est pas configurée dans l'environnement.";

  const db = p.database ?? "fr";

  if (p.mode === "keyword") {
    const kw = p.keyword?.trim();
    if (!kw) return "Paramètre 'keyword' manquant pour le mode keyword.";

    const result = await getSemrushKeywordIdeas(kw, apiKey, db, 25);
    if (!result) return `Aucune donnée Semrush pour "${kw}" (base ${db}). Causes possibles : solde d'unités API épuisé (vérifiable sur semrush.com → compte → API), clé API invalide, ou mot-clé trop rare dans cette base.`;

    const lines: string[] = [`## Semrush — Recherche de mots-clés : "${kw}" (base ${db})\n`];

    if (result.relatedKeywords.length) {
      lines.push(`### Mots-clés connexes (${result.relatedKeywords.length})`);
      lines.push("| Mot-clé | Volume | Difficulté | CPC |");
      lines.push("|---------|--------|-----------|-----|");
      for (const k of result.relatedKeywords.slice(0, 20)) {
        lines.push(`| ${k.keyword} | ${k.searchVolume.toLocaleString("fr")} | ${k.difficulty}/100 | ${k.cpc.toFixed(2)}€ |`);
      }
      lines.push("");
    }

    if (result.questions.length) {
      lines.push(`### Questions associées (${result.questions.length})`);
      lines.push("| Question | Volume | Difficulté |");
      lines.push("|----------|--------|-----------|");
      for (const k of result.questions.slice(0, 15)) {
        lines.push(`| ${k.keyword} | ${k.searchVolume.toLocaleString("fr")} | ${k.difficulty}/100 |`);
      }
    }

    return lines.join("\n");
  }

  // mode === "domain"
  const domain = p.domain?.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  if (!domain) return "Paramètre 'domain' manquant pour le mode domain.";

  const [keywords, topPages, backlinks] = await Promise.allSettled([
    getSemrushDomainKeywords(domain, apiKey, db, 20),
    getSemrushDomainTopPages(domain, apiKey, db, 10),
    getSemrushBacklinks(domain, apiKey, 10),
  ]);

  const lines: string[] = [`## Semrush — Analyse domaine : ${domain} (base ${db})\n`];

  if (backlinks.status === "fulfilled" && backlinks.value) {
    const b = backlinks.value;
    lines.push(`### Profil de liens`);
    lines.push(`- Authority Score : **${b.overview.authorityScore ?? "N/A"}**`);
    lines.push(`- Backlinks totaux : ${b.overview.total.toLocaleString("fr")}`);
    lines.push(`- Domaines référents : ${b.overview.referringDomains.toLocaleString("fr")}`);
    if (b.topReferringDomains.length) {
      lines.push(`- Top domaines référents : ${b.topReferringDomains.slice(0, 5).map(d => `${d.domain} (AS ${d.authorityScore ?? "?"})`).join(", ")}`);
    }
    lines.push("");
  }

  if (topPages.status === "fulfilled" && topPages.value?.pages.length) {
    lines.push(`### Top pages organiques`);
    for (const p of topPages.value.pages.slice(0, 10)) {
      lines.push(`- ${p.url} — ${p.keywords} mots-clés | trafic estimé : ${p.traffic}`);
    }
    lines.push("");
  }

  if (keywords.status === "fulfilled" && keywords.value?.keywords.length) {
    lines.push(`### Mots-clés positionnés (top ${keywords.value.keywords.length})`);
    lines.push("| Mot-clé | Position | Volume | Difficulté | URL |");
    lines.push("|---------|----------|--------|-----------|-----|");
    for (const k of keywords.value.keywords.slice(0, 20)) {
      lines.push(`| ${k.keyword} | #${k.position} | ${k.searchVolume.toLocaleString("fr")} | ${k.difficulty}/100 | ${k.url} |`);
    }
  }

  if (lines.length === 1) return `Aucune donnée Semrush disponible pour le domaine "${domain}". Le domaine est peut-être trop récent, trop petit, ou non indexé dans la base Semrush ${db}.`;

  return lines.join("\n");
}

interface GbpInsightsParams {
  business_name?: string;
}

async function getGbpInsightsForAssistant(sessionId: string | undefined, p: GbpInsightsParams): Promise<string> {
  if (!sessionId) return "Aucun compte Google connecté. Invite l'utilisateur à cliquer sur \"Connecter Google Search Console\" sur la page d'accueil (cela connecte aussi GBP avec le même compte).";

  const accessToken = await getValidAccessToken(sessionId);
  if (!accessToken) return "La session Google a expiré ou le scope GBP n'est pas encore autorisé. L'utilisateur doit se déconnecter puis reconnecter son compte Google pour autoriser l'accès à Google Business Profile.";

  const locations = await listGbpLocations(accessToken);
  if (!locations.length) return "Aucune fiche Google Business Profile trouvée pour ce compte Google. Vérifie que le compte connecté est bien propriétaire ou gestionnaire d'une fiche GBP vérifiée.";

  // Filter by business name if provided
  const filtered = p.business_name
    ? locations.filter(l => l.title?.toLowerCase().includes(p.business_name!.toLowerCase()))
    : locations;

  const targets = (filtered.length ? filtered : locations).slice(0, 3);

  const results = await Promise.all(
    targets.map(loc => getGbpInsightsForLocation(accessToken, loc.name, loc))
  );

  const sections = results.map(r => {
    const loc = r.location;
    const city = loc.storefrontAddress?.locality ?? "";
    const category = loc.categories?.primaryCategory?.displayName ?? "";
    const lines = [
      `## Fiche : ${loc.title}${city ? ` — ${city}` : ""}`,
      category ? `Catégorie principale : ${category}` : "",
      loc.websiteUri ? `Site web : ${loc.websiteUri}` : "",
      "",
    ];

    if (r.metrics) {
      const m = r.metrics;
      lines.push(`### Performances (${m.periodDays} derniers jours)`);
      lines.push(`- Impressions totales : ${m.totalImpressions.toLocaleString("fr")} (Maps : ${m.mapsImpressions.toLocaleString("fr")} | Recherche : ${m.searchImpressions.toLocaleString("fr")})`);
      lines.push(`- Clics site web : ${m.websiteClicks.toLocaleString("fr")}`);
      lines.push(`- Clics appel : ${m.callClicks.toLocaleString("fr")}`);
      lines.push(`- Demandes d'itinéraire : ${m.directionRequests.toLocaleString("fr")}`);
      lines.push("");
    }

    if (r.searchKeywords.length) {
      lines.push("### Mots-clés de recherche locaux (6 derniers mois)");
      lines.push("Ces termes ont été tapés par des internautes pour trouver cette fiche :");
      for (const kw of r.searchKeywords.slice(0, 30)) {
        lines.push(`- "${kw.keyword}"${kw.impressions != null ? ` — ${kw.impressions} impressions` : " — volume < seuil"}`);
      }
    } else {
      lines.push("### Mots-clés de recherche : aucune donnée disponible");
      lines.push("(La fiche existe peut-être depuis moins de 3 mois, ou les APIs GBP ne sont pas toutes activées dans Google Cloud Console.)");
    }

    return lines.filter(l => l !== null).join("\n");
  });

  return sections.join("\n\n---\n\n");
}

interface RedditResearchParams {
  mode: "semantic_research" | "ninja_linking" | "topic_discovery";
  sujet: string;
  marque?: string;
  mots_cles?: string[];
  subreddits?: string[];
}

const REDDIT_MODE_BRIEFS: Record<RedditResearchParams["mode"], string> = {
  semantic_research: `Mode : RECHERCHE SÉMANTIQUE REDDIT.
Tu analyses un corpus de discussions Reddit pour :
1. Identifier le vocabulaire réel des internautes sur ce sujet (termes dominants, expressions idiomatiques, niveau de langage)
2. Cartographier les questions récurrentes et classer les intentions (informationnelle, comparative, transactionnelle, de résolution de problème)
3. Repérer les pain points et frustrations non résolues : angles éditoriaux différenciants à forte valeur
4. Proposer des clusters de mots-clés et d'intentions issus du vocabulaire réel, avec des angles de contenu spécifiques

Regroupe les termes par champs sémantiques. Traduis les insights en recommandations éditoriales actionnables.`,

  ninja_linking: `Mode : OPPORTUNITÉS DE NINJA LINKING ET MENTIONS DE MARQUE.
Tu analyses des fils Reddit pour identifier des opportunités de présence naturelle et pertinente :
1. Questions ouvertes où une réponse d'expertise apporterait de la valeur (sans spam)
2. Mentions de la marque ou de ses concurrents dans des contextes pertinents — évalue le sentiment et le contexte
3. Discussions où citer une ressource (article, guide, page produit) serait naturel et utile pour la communauté

Pour chaque opportunité, précise : le contexte exact, le type d'intervention recommandée, le ton à adopter. Hiérarchise par pertinence et qualité d'engagement. Ne recommande jamais d'actions qui ressembleraient à du spam.`,

  topic_discovery: `Mode : DÉCOUVERTE DE SUJETS ET IDÉES DE CONTENU.
Tu analyses les discussions Reddit pour identifier :
1. Les sujets qui génèrent le plus d'engagement (score × commentaires) — potentiel de trafic organique
2. Les thématiques sous-représentées malgré un intérêt exprimé (nombreuses questions, peu de ressources citées) — opportunités de contenu différenciant
3. Des idées de contenu concrètes avec l'angle éditorial et l'intention de recherche principale
4. Les subreddits les plus actifs sur cette thématique — communautés à investir en priorité

Traduis ces insights en une liste d'idées de contenu priorisées, avec pour chacune : titre suggéré, angle différenciant, intention de recherche, potentiel d'engagement estimé.`,
};

async function generateRedditResearch(p: RedditResearchParams): Promise<string> {
  let posts;
  let dataBlock = "";

  if (p.mode === "ninja_linking") {
    // For ninja linking, search brand + keywords together
    const queryParts = [p.marque, ...(p.mots_cles ?? [])].filter(Boolean);
    const query = queryParts.length > 0 ? queryParts.join(" OR ") : p.sujet;
    posts = await searchRedditPosts(query, {
      subreddits: p.subreddits,
      sort: "relevance",
      timeFilter: "year",
      limit: 50,
    });

    if (posts.length === 0) {
      return `Aucune discussion Reddit trouvée pour "${query}". Essaie d'élargir les termes de recherche ou de retirer la restriction de subreddits.`;
    }

    const opportunities = findLinkOpportunities(posts, p.marque ?? "", p.mots_cles ?? []);
    if (opportunities.length === 0) {
      return `${posts.length} posts analysés sur "${query}" mais aucune opportunité qualifiée identifiée. Essaie d'élargir les mots-clés ou de réduire le seuil de pertinence.`;
    }

    dataBlock = `Analyse Reddit — ninja linking / mentions de marque
Recherche : "${query}"${p.marque ? ` | Marque cible : "${p.marque}"` : ""}${p.mots_cles?.length ? ` | Mots-clés : ${p.mots_cles.join(", ")}` : ""}
Posts analysés : ${posts.length} | Opportunités qualifiées : ${opportunities.length}

${opportunities.map((o, i) =>
  `${i + 1}. [${o.type}] r/${o.subreddit} | ↑${o.score} 💬${o.comments} | Pertinence : ${o.relevanceScore.toFixed(1)}/10
   Titre : "${o.postTitle}"
   Contexte : ${o.context.slice(0, 180)}
   URL : ${o.url}`
).join("\n\n")}`;

  } else if (p.mode === "topic_discovery" && p.subreddits?.length) {
    // For topic discovery with specific subreddits, get top posts per subreddit
    const allPosts = (await Promise.all(
      p.subreddits.slice(0, 4).map(sr => getSubredditTopPosts(sr, "top", "month", 25))
    )).flat();
    posts = allPosts;

    if (posts.length === 0) {
      return `Aucun post trouvé dans les subreddits : ${p.subreddits.join(", ")}. Vérifie les noms (sans "r/").`;
    }

    const corpus = extractSemanticCorpus(posts);
    dataBlock = buildCorpusDataBlock(p.sujet, corpus);

  } else {
    // semantic_research or topic_discovery without specific subreddits → global search
    posts = await searchRedditPosts(p.sujet, {
      subreddits: p.subreddits,
      sort: "relevance",
      timeFilter: "year",
      limit: 50,
    });

    if (posts.length === 0) {
      return `Aucune discussion Reddit trouvée pour "${p.sujet}". Essaie avec des termes plus généraux ou en anglais.`;
    }

    const corpus = extractSemanticCorpus(posts);
    dataBlock = buildCorpusDataBlock(p.sujet, corpus);
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `Tu es un expert SEO et content stratégist senior. ${REDDIT_MODE_BRIEFS[p.mode]}\n\nRéponds en français, au format markdown structuré (## sections, listes à puces). Sois concis et actionnable. N'utilise pas de tirets cadratins (—).`,
    messages: [{ role: "user", content: dataBlock }],
  });

  const block = response.content.find(b => b.type === "text");
  return block && block.type === "text" ? block.text : "Désolé, je n'ai pas pu analyser ces données Reddit.";
}

function buildCorpusDataBlock(sujet: string, corpus: ReturnType<typeof extractSemanticCorpus>): string {
  return `Analyse Reddit — corpus sémantique pour : "${sujet}"
Posts analysés : ${corpus.totalPosts}
Subreddits couverts : ${corpus.topSubreddits.map(s => `r/${s.name} (${s.posts} posts)`).join(", ")}

Top termes par fréquence (${corpus.topTerms.length}) :
${corpus.topTerms.map(t => `${t.term} (×${t.count})`).join(", ")}

Questions identifiées (${corpus.questions.length}) :
${corpus.questions.map(q => `- ${q}`).join("\n")}

Pain points (${corpus.painPoints.length}) :
${corpus.painPoints.map(p => `- ${p}`).join("\n")}

Top discussions par engagement :
${corpus.contentIdeas.map(ci => `- [r/${ci.subreddit}] "${ci.title}" | ↑${ci.score} 💬${ci.comments} | ${ci.url}`).join("\n")}`;
}

interface StrategyParams {
  axe: "seo_local" | "geo" | "netlinking" | "maillage_interne";
  domaine?: string;
  thematique?: string;
  synonymes?: string[];
  langue?: string;
  contexte?: string;
}

function detectLanguageDirs(pages: string[]): string[] {
  const dirs = new Set<string>();
  for (const page of pages) {
    try {
      const parts = new URL(page).pathname.split("/").filter(Boolean);
      if (parts[0] && /^[a-z]{2}(-[a-z]{2,4})?$/.test(parts[0])) {
        dirs.add(parts[0]);
      }
    } catch { /* URL invalide, ignorée */ }
  }
  return [...dirs];
}

const STRATEGY_BRIEFS: Record<StrategyParams["axe"], string> = {
  seo_local: `Axe : SEO LOCAL.
Construis un plan d'action concret pour améliorer la visibilité locale (Google Business Profile, pack local, recherches "près de moi", cohérence NAP).
Couvre dans l'ordre : audit rapide de la fiche GBP (catégorie, attributs, horaires, photos, posts, avis), cohérence NAP sur les annuaires/citations, pages locales dédiées par zone de chalandise si pertinent (sans dupliquer de contenu), avis clients (volume, fraîcheur, réponses), signaux de proximité dans le contenu (toponymes, zones desservies).
Si des données Google Business Profile sont fournies (mots-clés locaux + métriques), c'est ta source principale : analyse les requêtes de recherche locales réelles pour identifier les intentions sous-exploitées, les écarts entre impressions et clics (optimisation du titre/description de la fiche), et les métriques d'engagement (appels, itinéraires, clics site) pour prioriser les leviers. Croise avec les données Search Console si disponibles.
Si des données Search Console sont fournies, identifie les requêtes à intention locale (ville, "près de moi", quartier) et leur page actuelle pour prioriser les actions.`,
  geo: `Axe : GEO (Generative Engine Optimization / visibilité dans les réponses IA).
Construis un plan d'action concret pour améliorer la citabilité du contenu par les moteurs IA (AI Overviews, ChatGPT, Perplexity).
Couvre dans l'ordre : clarté structurelle (réponses directes en début de section, formats FAQ, listes, tableaux), cohérence inter-sources (alignement entre le site, les avis, Reddit, la presse), couverture des formats d'intention de prompt (apprentissage, factuelle, comparatif), entités nommées bien définies (marque, auteur, localisation), citations vérifiables (données chiffrées et sources).
Si des données Search Console sont fournies, repère les pages à fort volume d'impressions mais faible CTR : ce sont les meilleures candidates à restructurer en priorité pour la citabilité IA.`,
  netlinking: `Axe : NETLINKING (acquisition de liens externes).
Construis un plan d'action concret pour renforcer l'autorité du domaine par des backlinks de qualité.
Couvre dans l'ordre : évaluation du profil de liens actuel si l'information est disponible, identification de leviers réalistes (relations presse, partenariats sectoriels, contenus "linkable" comme des données propriétaires ou des études), diversification des ancres (exactes, partielles, marque, génériques), priorisation par pertinence thématique et autorité du domaine référent plutôt que par volume, vigilance sur le spam score et la qualité du voisinage.
Reste réaliste : ne recommande jamais de tactiques de liens artificiels ou de schémas d'échange de liens qui violent les guidelines Google.`,
  maillage_interne: `Axe : MAILLAGE INTERNE.
Construis un plan d'action concret pour renforcer le maillage interne du site.
Si des données Search Console (requêtes + pages associées) sont fournies, c'est ta source principale pour identifier des groupes de pages thématiquement proches (mots-clés liés, intentions complémentaires).
Si un contenu éditorial WordPress (titre + extrait par page) est fourni, utilise-le pour affiner l'ancre suggérée et évaluer la complémentarité thématique réelle entre pages — c'est plus fiable qu'une déduction depuis le seul slug.
Si un graphe de liens internes RÉELS (crawlés) est fourni en plus, utilise-le comme vérité terrain : ne recommande JAMAIS de créer un lien qui existe déjà (signale-le plutôt comme "déjà en place, à conserver/renforcer l'ancre si besoin") ; priorise les liens manquants entre pages thématiquement proches qui n'ont aucun lien réel détecté entre elles ; signale les pages de l'ensemble analysé qui ne reçoivent aucun lien entrant détecté des autres pages du même thème (candidates orphelines au sein de ce cluster). Pour chaque lien proposé, donne : page source -> page cible -> ancre suggérée -> justification.
Si aucun graphe de liens réels n'est fourni, précise explicitement que les suggestions sont basées sur la seule proximité sémantique des requêtes Search Console, pas sur un audit du maillage HTML réel.
Si aucune donnée Search Console n'est disponible non plus, base-toi sur le contexte fourni par l'utilisateur et structure le plan autour d'une architecture en silo logique.

## Format de réponse impératif pour le maillage interne
- Sections obligatoires avec ### : ### 🚀 Quick Wins, ### 🏗️ Actions structurantes, ### ⚠️ Pages orphelines dans le cluster
- Chaque recommandation porte un identifiant court : **QW-1**, **QW-2**, **AC-1**...
- Les métriques clés TOUJOURS en gras : **CTR : 14%**, **12 clics**, **position 8**, **0 lien entrant**
- Page source et page cible en \`code inline\`
- Ancre suggérée en italique gras : ***"curcuma anti-inflammatoire"***
- Max 3 lignes par recommandation : contexte (avec métrique) + lien suggéré (source → cible + ancre) + justification courte
- Pas de prose dense : chaque point doit être scannable en 5 secondes

## Clôture obligatoire
Termine TOUJOURS ta réponse par cette question (adaptée au contexte) :

> Souhaitez-vous que je génère un **tableau récapitulatif** de toutes les opportunités de liens identifiées, avec les colonnes : Page source | Page cible | Ancre suggérée | Priorité | Sous-cluster sémantique ?`,
};

async function generateStrategyActionPlan(sessionId: string | undefined, p: StrategyParams): Promise<string> {
  let dataBlock = "";
  if (p.domaine) {
    const res = await resolveGscDataset(sessionId, p.domaine, 28, p.thematique, p.synonymes);
    if (!res.ok) {
      dataBlock = `(Données Search Console indisponibles pour ce domaine : ${res.message} Construis le plan sur la base du contexte fourni par l'utilisateur, et mentionne que des données réelles permettraient un plan plus précis.)`;
    } else {
      dataBlock = `Données Search Console réelles (28 derniers jours) :\n${JSON.stringify(res.data)}`;

      if (p.axe === "maillage_interne") {
        let distinctPages = [...new Set(res.data.requetes_et_pages_associees.map(r => r.page))].filter(Boolean);

        // Détection multilingue : si plusieurs répertoires de langue et aucune langue cible spécifiée
        const langDirs = detectLanguageDirs(distinctPages);
        if (langDirs.length > 1 && !p.langue) {
          const choices = langDirs.map(d => `\`/${d}/\``).join(", ");
          return `J'ai détecté plusieurs versions linguistiques dans les données Search Console pour cette thématique : ${choices}.\n\nSur quelle version souhaitez-vous que je focalise l'analyse de maillage interne ?`;
        }

        // Filtrer par répertoire de langue si précisé
        if (p.langue) {
          const langFilter = `/${p.langue}/`;
          distinctPages = distinctPages.filter(pg => {
            try { return new URL(pg).pathname.startsWith(langFilter); } catch { return false; }
          });
        }

        if (distinctPages.length >= 2) {
          // Crawl du graphe de liens réels + contenu WP en parallèle
          const [crawlResult, wpContent] = await Promise.all([
            buildLinkGraphWithSignals(distinctPages, 20).catch((e) => {
              console.error("[assistant linkGraph] error:", e);
              return { links: [], pageSignals: [] };
            }),
            p.domaine
              ? fetchWpContentForUrls(`https://${p.domaine.replace(/^https?:\/\//, "")}`, distinctPages).catch(() => [])
              : Promise.resolve([]),
          ]);

          const { links: linkGraph, pageSignals } = crawlResult;

          if (linkGraph.length > 0) {
            dataBlock += `\n\nGraphe de liens internes RÉELS détectés par crawl entre ces ${distinctPages.length} pages (seuls les liens ENTRE pages de cet ensemble, pas un audit sitewide) :\n${JSON.stringify(linkGraph)}`;
          } else {
            dataBlock += `\n\nCrawl du graphe de liens internes effectué sur ces ${distinctPages.length} pages : aucun lien interne détecté entre elles. Cela signifie soit que les pages du cluster ne se maillent pas entre elles dans leur HTML (toutes orphelines les unes des autres — situation critique à corriger en priorité), soit que le crawl a été bloqué par une protection serveur. Dans les deux cas, traite TOUTES ces pages comme des pages sans lien entrant détecté dans ce cluster, et priorise leur désorphelinisation.`;
          }

          const crawledSignals = pageSignals.filter(s => s.title || s.h1 || s.wordCount > 0);
          if (crawledSignals.length > 0) {
            dataBlock += `\n\nSignaux éditoriaux crawlés (title, H1, meta description, word count, H2s, schema types) pour ${crawledSignals.length} pages du cluster — utilise ces données pour affiner les ancres suggérées et évaluer la complémentarité thématique réelle entre pages :\n${JSON.stringify(crawledSignals)}`;
          }

          if (wpContent.length > 0) {
            dataBlock += `\n\nContenu éditorial récupéré via l'API REST WordPress (titre + extrait) pour ${wpContent.length} pages du cluster :\n${JSON.stringify(wpContent)}`;
          }
        }
      }
    }
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `Tu es un stratège SEO senior. Tu construis des plans d'action concrets, priorisés (quick wins vs actions structurantes), ancrés dans des données réelles quand elles sont disponibles plutôt que des conseils génériques. Réponds en français, au format markdown structuré. Respecte impérativement le format de réponse décrit dans le brief ci-dessous — notamment : métriques en gras, identifiants courts (QW-1, AC-1), URLs en code inline, ancres en italique gras, sections ###. N'utilise pas de tirets cadratins (—), préfère les tirets courts (-) ou des puces.\n\n${STRATEGY_BRIEFS[p.axe]}`,
    messages: [{
      role: "user",
      content: `${p.contexte ? `Contexte fourni par l'utilisateur : ${p.contexte}\n\n` : ""}${dataBlock || "Aucune donnée Search Console fournie — base-toi sur le contexte ci-dessus."}`,
    }],
  });
  const block = response.content.find(b => b.type === "text");
  return block && block.type === "text" ? block.text : "Désolé, je n'ai pas pu générer ce plan d'action.";
}

interface AnalyzeSerpParams {
  query: string;
  country?: string;
  search_engine?: string;
}

interface FindLongtailParams {
  keyword: string;
  count?: number;
  search_intent?: string;
  country?: string;
}

interface CheckRankingParams {
  keyword: string;
  domain: string;
  country?: string;
  pages_number?: number;
}

interface AnalyzeBacklinksParams {
  domain: string;
  country?: string;
  pages_number?: number;
}

async function analyzeSerpForAssistant(p: AnalyzeSerpParams): Promise<string> {
  if (!process.env.FETCHSERP_API_TOKEN) return "La clé API FetchSERP (FETCHSERP_API_TOKEN) n'est pas configurée.";
  const data = await getSerpResults(p.query, p.country ?? "fr", p.search_engine ?? "google");
  if (!data || !data.results.length) return `Aucun résultat SERP trouvé pour "${p.query}".`;

  const lines: string[] = [
    `## SERP Google — "${p.query}" (${(p.country ?? "fr").toUpperCase()})`,
    `Résultats estimés : ${data.totalResults}`,
    "",
    "### Top 10 résultats organiques",
    "| Pos. | Domaine | Titre | URL |",
    "|------|---------|-------|-----|",
  ];

  for (const r of data.results) {
    const title = r.title.slice(0, 60) + (r.title.length > 60 ? "…" : "");
    const url = r.url.slice(0, 60) + (r.url.length > 60 ? "…" : "");
    lines.push(`| ${r.position} | ${r.domain} | ${title} | ${url} |`);
  }

  if (data.featuredSnippet) {
    lines.push("", "### Featured Snippet");
    lines.push(`**${data.featuredSnippet.title}**`);
    lines.push(data.featuredSnippet.description);
    lines.push(`Source : ${data.featuredSnippet.url}`);
  }

  if (data.relatedSearches.length) {
    lines.push("", "### Requêtes associées");
    lines.push(data.relatedSearches.slice(0, 8).map(q => `- ${q}`).join("\n"));
  }

  // Deduplicate domains to identify dominance
  const domainCounts = data.results.reduce<Record<string, number>>((acc, r) => {
    acc[r.domain] = (acc[r.domain] ?? 0) + 1;
    return acc;
  }, {});
  const dominant = Object.entries(domainCounts).filter(([, c]) => c > 1);
  if (dominant.length) {
    lines.push("", "### Domaines multi-positionnés");
    lines.push(dominant.map(([d, c]) => `- ${d} : ${c} résultats dans le top 10`).join("\n"));
  }

  return lines.join("\n");
}

async function findLongtailForAssistant(p: FindLongtailParams): Promise<string> {
  if (!process.env.FETCHSERP_API_TOKEN) return "La clé API FetchSERP (FETCHSERP_API_TOKEN) n'est pas configurée.";
  const keywords = await getLongTailKeywords(p.keyword, p.count ?? 20, p.search_intent, p.country ?? "fr");
  if (!keywords.length) return `Aucun mot-clé longue traîne trouvé pour "${p.keyword}".`;

  const lines = [
    `## Mots-clés longue traîne — "${p.keyword}" (${(p.country ?? "fr").toUpperCase()})`,
    p.search_intent ? `Filtre intention : ${p.search_intent}` : "",
    "",
    `${keywords.length} mots-clés identifiés :`,
    ...keywords.map((k, i) => `${i + 1}. ${k}`),
  ].filter(l => l !== "");

  return lines.join("\n");
}

async function checkRankingForAssistant(p: CheckRankingParams): Promise<string> {
  if (!process.env.FETCHSERP_API_TOKEN) return "La clé API FetchSERP (FETCHSERP_API_TOKEN) n'est pas configurée.";
  const result = await getDomainRanking(
    p.keyword,
    p.domain,
    p.country ?? "fr",
    "google",
    p.pages_number ?? 5
  );

  if (!result) return `Erreur lors de la vérification du ranking pour "${p.domain}" sur "${p.keyword}".`;

  if (result.position == null) {
    return `**${p.domain}** n'apparaît pas dans les ${(p.pages_number ?? 5) * 10} premières positions sur Google pour la requête "${p.keyword}" (${(p.country ?? "fr").toUpperCase()}).\n\nCela peut signifier : page non indexée sur ce mot-clé, positionnement au-delà du top ${(p.pages_number ?? 5) * 10}, ou mot-clé non ciblé.`;
  }

  const lines = [
    `## Ranking — ${p.domain} sur "${p.keyword}"`,
    `- Pays : ${(p.country ?? "fr").toUpperCase()}`,
    `- **Position : #${result.position}**`,
  ];
  if (result.url) lines.push(`- URL positionnée : ${result.url}`);
  if (result.title) lines.push(`- Titre de la page : ${result.title}`);

  return lines.join("\n");
}

async function analyzeBacklinksForAssistant(p: AnalyzeBacklinksParams): Promise<string> {
  if (!process.env.FETCHSERP_API_TOKEN) return "La clé API FetchSERP (FETCHSERP_API_TOKEN) n'est pas configurée.";
  const result = await getBacklinks(p.domain, p.country ?? "fr", p.pages_number ?? 3);
  if (!result) return `Erreur lors de l'analyse des backlinks pour "${p.domain}".`;
  if (!result.backlinks.length) return `Aucun backlink trouvé pour "${p.domain}".`;

  const lines = [
    `## Backlinks — ${p.domain}`,
    `Total détecté : **${result.totalBacklinks.toLocaleString("fr")}**`,
    "",
    "### Liens entrants (top 30)",
    "| Domaine référent | Ancre | DA | URL source |",
    "|-----------------|-------|-----|-----------|",
  ];

  for (const b of result.backlinks) {
    const anchor = b.anchor ?? "—";
    const da = b.domainAuthority != null ? String(b.domainAuthority) : "—";
    const url = b.url.slice(0, 60) + (b.url.length > 60 ? "…" : "");
    lines.push(`| ${b.domain} | ${anchor} | ${da} | ${url} |`);
  }

  // Summary: top referring domains
  const domainCounts = result.backlinks.reduce<Record<string, number>>((acc, b) => {
    acc[b.domain] = (acc[b.domain] ?? 0) + 1;
    return acc;
  }, {});
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (topDomains.length) {
    lines.push("", "### Domaines référents les plus actifs");
    lines.push(topDomains.map(([d, c]) => `- **${d}** — ${c} lien${c > 1 ? "s" : ""}`).join("\n"));
  }

  return lines.join("\n");
}

// Outils "terminaux" : produisent un livrable final (article, fiche, plan,
// publication) qui doit être renvoyé tel quel à l'utilisateur et clôt la boucle.
// Les autres outils sont des outils "data" : leur résultat est réinjecté dans
// le raisonnement de l'agent, qui peut alors enchaîner un autre outil ou
// synthétiser une réponse.
const TERMINAL_TOOLS = new Set([
  "generate_article",
  "generate_product_sheet",
  "generate_content_plan",
  "generate_strategy_action_plan",
  "reddit_research",
  "check_geo_visibility",
  "inject_wp_script",
  "publish_product_to_woocommerce",
  "update_woocommerce_product",
  "publish_category_to_woocommerce",
  "publish_article_to_wordpress",
  "publish_page_to_wordpress",
]);

type ToolOutcome = { terminal: true; reply: string } | { terminal: false; result: string };

async function runAssistantTool(toolUse: Anthropic.ToolUseBlock, sessionId: string | undefined, userId: string | undefined): Promise<ToolOutcome> {
  switch (toolUse.name) {
    // ── Outils terminaux (livrables) ──
    case "generate_article":
      return { terminal: true, reply: `Voici l'article généré :\n\n${await generateArticleContent(toolUse.input as ArticleParams)}` };
    case "generate_product_sheet":
      return { terminal: true, reply: `Voici la fiche produit générée :\n\n${await generateProductSheetContent(toolUse.input as ProductSheetParams)}` };
    case "generate_content_plan":
      return { terminal: true, reply: `Voici le plan de contenu généré :\n\n${await generateContentPlanContent(toolUse.input as ContentPlanParams)}` };
    case "generate_strategy_action_plan":
      return { terminal: true, reply: await generateStrategyActionPlan(sessionId, toolUse.input as StrategyParams) };
    case "reddit_research":
      return { terminal: true, reply: await generateRedditResearch(toolUse.input as RedditResearchParams) };
    case "check_geo_visibility": {
      const p = toolUse.input as { keyword: string; site_url: string; platforms?: ("perplexity" | "gemini" | "openai")[] };
      try {
        return { terminal: true, reply: await checkGeoVisibility(p) };
      } catch (e) {
        return { terminal: true, reply: `❌ Erreur lors de la vérification GEO : ${e instanceof Error ? e.message : "erreur inconnue"}` };
      }
    }
    case "inject_wp_script": {
      const p = toolUse.input as { script?: string; description?: string; target_url?: string };
      if (!userId) {
        return { terminal: true, reply: "❌ Vous devez être connecté pour utiliser Mind Bridge." };
      }
      if (!p.script || !p.description) {
        return { terminal: true, reply: "❌ Mind Bridge : le script ou la description est manquant(e). Génère d'abord le script complet avant d'appeler cet outil." };
      }
      try {
        await enqueueScript(userId, p.script, p.description, p.target_url);
        const targetMsg = p.target_url
          ? `\n\n**Page cible :** [${p.target_url}](${p.target_url})`
          : "";
        return {
          terminal: true,
          reply: `✅ **Script envoyé via Mind Bridge**\n\n**Action :** ${p.description}\n\nSi Mind Bridge est actif sur la page WP Admin, le script va s'exécuter automatiquement dans les 2 secondes.${targetMsg}\n\n> Si Mind Bridge n'est pas encore actif, cliquez sur votre bookmarklet "Mind Bridge" dans la barre de favoris, puis ouvrez la page WP Admin cible. Le script s'exécutera dès la connexion établie.`,
        };
      } catch (e) {
        return { terminal: true, reply: `❌ Erreur Mind Bridge : ${e instanceof Error ? e.message : "erreur inconnue"}` };
      }
    }
    case "search_woocommerce":
      return { terminal: false, result: await searchWoocommerce(toolUse.input as { type: "products" | "categories"; query: string }, userId ?? "") };
    case "get_woocommerce_product":
      return { terminal: false, result: await getWooProduct((toolUse.input as { product_id: number }).product_id, userId ?? "") };
    case "update_woocommerce_product":
      return { terminal: true, reply: await updateWooProduct(toolUse.input as UpdateProductParams, userId ?? "") };
    case "publish_product_to_woocommerce":
      return { terminal: true, reply: await publishProductToWoo(toolUse.input as PublishProductParams, userId ?? "") };
    case "publish_category_to_woocommerce":
      return { terminal: true, reply: await publishCategoryToWoo(toolUse.input as PublishCategoryParams, userId ?? "") };
    case "publish_article_to_wordpress":
      return { terminal: true, reply: await publishArticleToWp(toolUse.input as PublishWpContentParams, userId ?? "") };
    case "publish_page_to_wordpress":
      return { terminal: true, reply: await publishPageToWp(toolUse.input as PublishWpContentParams, userId ?? "") };

    // ── Outils data (réinjectés dans la boucle) ──
    case "get_kpu_paa": {
      const p = toolUse.input as { keyword: string; country?: string; language?: string; depth?: number };
      if (!process.env.KPU_API_KEY) return { terminal: false, result: "La clé API Keywords People Use (KPU_API_KEY) n'est pas configurée." };
      try {
        const result = await getKpuPeopleAlsoAsk(p.keyword, p.country ?? "fr", p.language ?? "fr", p.depth ?? 2);
        return { terminal: false, result: formatPaaForAssistant(result) };
      } catch (e) {
        return { terminal: false, result: `Erreur KPU PAA : ${e instanceof Error ? e.message : "erreur inconnue"}` };
      }
    }
    case "get_kpu_suggestions": {
      const p = toolUse.input as { keyword: string; country?: string; language?: string };
      if (!process.env.KPU_API_KEY) return { terminal: false, result: "La clé API Keywords People Use (KPU_API_KEY) n'est pas configurée." };
      try {
        const result = await getKpuSuggestions(p.keyword, p.country ?? "fr", p.language ?? "fr");
        return { terminal: false, result: formatSuggestionsForAssistant(result) };
      } catch (e) {
        return { terminal: false, result: `Erreur KPU Suggestions : ${e instanceof Error ? e.message : "erreur inconnue"}` };
      }
    }
    case "get_search_console_data":
      return { terminal: false, result: await getSearchConsoleDataForChat(sessionId, toolUse.input as GscDataParams) };
    case "get_semrush_data":
      return { terminal: false, result: await getSemrushDataForAssistant(toolUse.input as SemrushParams) };
    case "get_gbp_insights":
      return { terminal: false, result: await getGbpInsightsForAssistant(sessionId, toolUse.input as GbpInsightsParams) };
    case "get_keyword_trends":
      return { terminal: false, result: await getKeywordTrendsForAssistant(toolUse.input as KeywordTrendsParams) };
    case "analyze_serp":
      return { terminal: false, result: await analyzeSerpForAssistant(toolUse.input as AnalyzeSerpParams) };
    case "find_longtail_keywords":
      return { terminal: false, result: await findLongtailForAssistant(toolUse.input as FindLongtailParams) };
    case "check_domain_ranking":
      return { terminal: false, result: await checkRankingForAssistant(toolUse.input as CheckRankingParams) };
    case "analyze_competitor_backlinks":
      return { terminal: false, result: await analyzeBacklinksForAssistant(toolUse.input as AnalyzeBacklinksParams) };

    default:
      return { terminal: false, result: `Outil inconnu : ${toolUse.name}` };
  }
}

const MAX_AGENT_STEPS = 4;

export const maxDuration = 150;

const TOOL_LABELS: Record<string, string> = {
  get_search_console_data: "Récupération données Search Console…",
  get_semrush_data: "Récupération données Semrush…",
  get_gbp_insights: "Récupération données Google Business Profile…",
  get_keyword_trends: "Analyse des tendances de mots-clés…",
  get_kpu_paa: "Extraction des questions People Also Ask (KPU)…",
  get_kpu_suggestions: "Récupération des suggestions KPU (Autocomplete + sémantique)…",
  analyze_serp: "Analyse de la SERP…",
  find_longtail_keywords: "Recherche de mots-clés longue traîne…",
  check_domain_ranking: "Vérification du ranking du domaine…",
  analyze_competitor_backlinks: "Analyse des backlinks concurrents…",
  generate_article: "Rédaction de l'article…",
  generate_product_sheet: "Génération de la fiche produit…",
  generate_content_plan: "Construction du plan de contenu…",
  generate_strategy_action_plan: "Élaboration du plan stratégique…",
  reddit_research: "Recherche Reddit en cours…",
  check_geo_visibility: "Interrogation des LLMs (Perplexity & Gemini)…",
  inject_wp_script: "Envoi du script via Mind Bridge…",
  search_woocommerce: "Recherche dans la boutique WooCommerce…",
  get_woocommerce_product: "Lecture de la fiche produit et de ses champs…",
  update_woocommerce_product: "Mise à jour de la fiche produit sur WooCommerce…",
  publish_product_to_woocommerce: "Publication fiche produit sur WooCommerce…",
  publish_category_to_woocommerce: "Création catégorie sur WooCommerce…",
  publish_article_to_wordpress: "Publication article sur WordPress…",
  publish_page_to_wordpress: "Publication page sur WordPress…",
};

export async function POST(req: NextRequest) {
  let body: { messages?: { role: "user" | "assistant"; content: string }[]; auditId?: string; images?: { name: string; dataUrl: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { messages, auditId, images } = body;
  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "Messages manquants" }, { status: 400 });
  }

  const sessionId = req.cookies.get("gsc_session")?.value;
  const authUser = await getAuthUser();
  const userId = authUser?.id;
  const encoder = new TextEncoder();

  // Charger le contexte d'audit si un auditId est fourni
  let auditContextBlock = "";
  if (auditId) {
    try {
      const auditData = await loadAudit(auditId);
      if (auditData) {
        const auditUrl = auditData.canonical ?? messages[0]?.content ?? "inconnu";
        const { score, grade } = computeScore(auditData);
        auditContextBlock = formatAuditForAssistant(auditData, auditUrl, score, grade);
      }
    } catch (e) {
      console.warn("[assistant] failed to load audit context:", e);
    }
  }

  const sseStream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      try {
        const newsBlock = await getCachedNewsBlock();
        const systemWithNews = [
          SYSTEM_PROMPT,
          auditContextBlock ? `\n\n${auditContextBlock}\n\nRéfère-toi systématiquement à ces données d'audit dans tes réponses, sauf si l'utilisateur pose une question sans rapport avec ce site.` : "",
          newsBlock ? `\n\n${newsBlock}\n\nUtilise ces actualités quand elles sont pertinentes pour la question posée, en citant la source.` : "",
        ].join("");

        const conversation: Anthropic.MessageParam[] = messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          // Only attach images to the last user message (text files are already in m.content)
          if (isLast && m.role === "user" && images && images.length > 0) {
            return {
              role: "user" as const,
              content: [
                { type: "text" as const, text: m.content },
                ...images.map(img => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: ((img.dataUrl.split(";")[0] ?? "").split(":")[1] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                    data: img.dataUrl.split(",")[1] ?? "",
                  },
                })),
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

        for (let step = 0; step <= MAX_AGENT_STEPS; step++) {
          const isForceTextStep = step === MAX_AGENT_STEPS;

          // Dernier recours : appel sans outils pour forcer une réponse texte
          const msgStream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system: systemWithNews,
            ...(isForceTextStep ? {} : { tools }),
            messages: conversation,
          });

          // Streamer les deltas texte en temps réel
          for await (const event of msgStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              event.delta.text
            ) {
              send("token", JSON.stringify(event.delta.text));
            }
          }

          const finalMsg = await msgStream.finalMessage();
          const toolUses = finalMsg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

          // Pas d'outil → texte déjà streamé, on clôt
          if (toolUses.length === 0 || isForceTextStep) {
            send("done", "");
            controller.close();
            return;
          }

          // Outil terminal (livrable) : court-circuiter, envoyer le résultat d'un coup
          const terminalUse = toolUses.find(t => TERMINAL_TOOLS.has(t.name));
          if (terminalUse) {
            send("status", JSON.stringify({ label: TOOL_LABELS[terminalUse.name] ?? terminalUse.name }));
            const outcome = await runAssistantTool(terminalUse, sessionId, userId);
            if (outcome.terminal) {
              send("token", JSON.stringify(outcome.reply));
              send("done", "");
              controller.close();
              return;
            }
          }

          // Outils data : signaler chaque outil puis exécuter en parallèle
          for (const tu of toolUses) {
            send("status", JSON.stringify({ label: TOOL_LABELS[tu.name] ?? tu.name }));
          }
          conversation.push({ role: "assistant", content: finalMsg.content });
          const outcomes = await Promise.all(toolUses.map(tu => runAssistantTool(tu, sessionId, userId)));
          const toolResults: Anthropic.ToolResultBlockParam[] = toolUses.map((tu, i) => ({
            type: "tool_result",
            tool_use_id: tu.id,
            content: outcomes[i]!.terminal
              ? (outcomes[i] as { terminal: true; reply: string }).reply
              : (outcomes[i] as { terminal: false; result: string }).result,
          }));
          conversation.push({ role: "user", content: toolResults });
        }

        send("done", "");
        controller.close();
      } catch (e) {
        console.error("assistant stream error:", e);
        send("error", JSON.stringify(e instanceof Error ? e.message : "Erreur inconnue"));
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
