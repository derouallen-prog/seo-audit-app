import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crée ton espace SEO gratuit — Search Mind",
  description: "Lance une première analyse SEO/GEO de ton site sans créer de compte : positionnement, concurrents et suggestion de projet basés sur de vraies données.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
