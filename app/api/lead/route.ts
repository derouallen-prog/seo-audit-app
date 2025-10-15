import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email ?? "").toString().trim();
    const company = (body?.company ?? "").toString().trim();
    const url = (body?.url ?? "").toString().trim();
    const note = (body?.note ?? "").toString().trim();
    const website = (body?.website ?? "").toString().trim(); // honeypot

    // Honeypot simple: si rempli, on ignore
    if (website) {
      return Response.json({ ok: true });
    }

    if (!email || !company) {
      return Response.json({ error: "email & company required" }, { status: 400 });
    }

    const payload = {
      email,
      company,
      url,
      note,
      at: new Date().toISOString(),
      ua: req.headers.get("user-agent") || "",
      ip: req.headers.get("x-forwarded-for") || "",
    };

    const webhook = process.env.LEAD_WEBHOOK_URL;

    if (webhook) {
      try {
        const res = await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.error("Lead webhook failed:", res.status, await res.text());
        }
      } catch (e) {
        console.error("Lead webhook error:", e);
      }
    } else {
      console.log("LEAD", payload);
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Lead failed" }, { status: 500 });
  }
}
