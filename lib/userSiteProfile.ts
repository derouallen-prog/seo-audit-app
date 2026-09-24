export interface UserSiteProfile {
  site_url?: string;
  positioning?: string;
  categories?: string[];
  market?: string;
  target_zones?: string[];
  competitors?: string[];
}

export function formatUserSiteProfileForPrompt(profile: UserSiteProfile): string {
  const hasData = profile.site_url || profile.market || profile.competitors?.length || profile.positioning;
  if (!hasData) return "";

  const lines: string[] = ["## Profil du site de l'utilisateur (contexte permanent)"];

  if (profile.site_url) {
    lines.push(`**Site web :** ${profile.site_url}`);
  }
  if (profile.market) {
    lines.push(`**Marché / secteur :** ${profile.market}`);
  }
  if (profile.positioning) {
    lines.push(`**Positionnement :** ${profile.positioning}`);
  }
  if (profile.categories?.length) {
    lines.push(`**Catégories :** ${profile.categories.join(", ")}`);
  }
  if (profile.target_zones?.length) {
    lines.push(`**Zones cibles :** ${profile.target_zones.join(", ")}`);
  }
  if (profile.competitors?.length) {
    lines.push(`**Concurrents identifiés :** ${profile.competitors.join(", ")}`);
  }

  const siteName = profile.site_url ?? "son site";
  lines.push(
    `\nCes données sont le contexte permanent de l'utilisateur. Lorsqu'il ne précise pas de domaine cible, utilise ${siteName} par défaut. Lorsqu'une comparaison concurrentielle est pertinente, réfère-toi aux concurrents listés ci-dessus.`
  );

  return lines.join("\n");
}
