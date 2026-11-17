import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connexion — Search Mind",
  description: "Connecte-toi à ton espace Search Mind pour retrouver tes audits, ton assistant IA et le suivi de ton positionnement.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
