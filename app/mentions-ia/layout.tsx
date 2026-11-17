import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions IA (GEO) — Search Mind",
  description: "Vérifiez si votre site est cité par ChatGPT, Gemini, Perplexity et Claude pour vos requêtes cibles — suivi de visibilité GEO basé sur de vraies interrogations des IA.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
