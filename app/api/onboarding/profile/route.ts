import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSiteProfile, upsertSiteProfile } from "@/lib/siteProfile";

export const runtime = "nodejs";

async function getUser(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

export async function GET(req: NextRequest) {
  const { user } = await getUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const profile = await getSiteProfile(user.id);
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const profile = await upsertSiteProfile(user.id, body);

  // When onboarding completes, flag it in user metadata for middleware
  if (body.onboarding_completed) {
    await supabase.auth.updateUser({ data: { onboarding_completed: true } });
  }

  return NextResponse.json({ profile });
}
