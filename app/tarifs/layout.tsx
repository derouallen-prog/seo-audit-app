import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs — Search Mind",
  description: "Découverte gratuite, Pro à 49 €/mois ou Agence à 149 €/mois : audits SEO, assistant IA et suivi de citations IA selon vos besoins.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
