import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

// Échappe le HTML pour empêcher toute injection dans l'email de notification
// (les valeurs viennent d'un formulaire public non authentifié).
function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, company, url, note, website } = await req.json();

    // Honeypot
    if (website && String(website).trim().length > 0) {
      return NextResponse.json({ ok: true });
    }

    // Validation basique du format email
    if (!email || !EMAIL_RE.test(String(email).trim())) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }

    const cleanEmail = String(email).trim().slice(0, 254);

    const apiKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.LEADS_NOTIFY_TO;

    if (!notifyTo) {
      return NextResponse.json(
        { error: "LEADS_NOTIFY_TO manquant (env local/Vercel)." },
        { status: 500 }
      );
    }

    // En dev sans clé, on simule
    if (!apiKey) {
      console.warn("RESEND_API_KEY manquant : simulation en local");
      console.log(`[SIMULATION EMAIL] → ${notifyTo} | lead: ${cleanEmail}`);
      return NextResponse.json({ ok: true, simulated: true });
    }

    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: "SEO Audit <onboarding@resend.dev>",
      to: notifyTo.split(",").map((x) => x.trim()),
      subject: "🧲 Nouveau lead – SEO Audit App",
      html: `
        <h2>Nouveau lead</h2>
        <ul>
          <li><b>Email :</b> ${escapeHtml(cleanEmail)}</li>
          <li><b>Société :</b> ${escapeHtml(company) || "—"}</li>
          ${url ? `<li><b>URL :</b> ${escapeHtml(url)}</li>` : ""}
          ${note ? `<li><b>Note :</b> ${escapeHtml(note)}</li>` : ""}
        </ul>
      `,
    });

    await resend.emails.send({
      from: "SEO Audit <onboarding@resend.dev>",
      to: [cleanEmail],
      subject: "Merci ! On analyse votre demande",
      html: `<p>Merci pour votre demande d'audit SEO. Nous revenons vers vous très vite.</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Route /api/lead error:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
