import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, company, url, note, website } = await req.json();

    if (website && String(website).trim().length > 0) {
      return NextResponse.json({ ok: true });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.LEADS_NOTIFY_TO;

    if (!notifyTo) {
      return NextResponse.json(
        { error: "LEADS_NOTIFY_TO manquant (env local/Vercel)." },
        { status: 500 }
      );
    }

    if (!apiKey) {
      console.warn("RESEND_API_KEY manquant : simulation en local");
      console.log(`[SIMULATION EMAIL] → ${notifyTo} | lead: ${email}`);
      return NextResponse.json({ ok: true, simulated: true });
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "SEO Audit <deroualle.n@gmail.com>",
      to: notifyTo.split(",").map((x) => x.trim()),
      subject: "🧲 Nouveau lead – SEO Audit App",
      html: `
        <h2>Nouveau lead</h2>
        <ul>
          <li><b>Email :</b> ${email}</li>
          <li><b>Société :</b> ${company ?? "—"}</li>
          ${url ? `<li><b>URL :</b> ${url}</li>` : ""}
          ${note ? `<li><b>Note :</b> ${note}</li>` : ""}
        </ul>
      `,
    });

    if (email) {
      await resend.emails.send({
        from: "SEO Audit <onboarding@resend.dev>",
        to: [email],
        subject: "Merci ! On analyse votre demande",
        html: `<p>Merci pour votre demande d'audit SEO. Nous revenons vers vous très vite.</p>`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Route /api/lead error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
