import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

async function getUserAudits(userId: string) {
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await sb
    .from("audits")
    .select("id, url, score, grade, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return data as { id: string; url: string; score: number; grade: string; created_at: string }[];
}

function gradeColor(grade: string) {
  if (grade === "A") return "bg-green-100 text-green-700";
  if (grade === "B") return "bg-blue-100 text-blue-700";
  if (grade === "C") return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth");

  const audits = await getUserAudits(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Mes audits</h1>
          <p className="text-sm text-ink-soft mt-1">{user.email}</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition">
          + Nouvel audit
        </Link>
      </div>

      {audits.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-16 text-center">
          <p className="text-ink-soft text-sm mb-4">Aucun audit enregistré pour l&apos;instant.</p>
          <Link href="/" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition">
            Lancer mon premier audit
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map(audit => {
            const date = new Date(audit.created_at).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
            });
            return (
              <Link key={audit.id} href={`/?auditId=${audit.id}`} className="block">
                <div className="rounded-xl border border-hairline bg-white p-4 flex items-center gap-4 hover:border-brand/40 hover:shadow-sm transition group">
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${gradeColor(audit.grade)}`}>
                    {audit.grade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate group-hover:text-brand transition">{audit.url}</p>
                    <p className="text-xs text-ink-soft mt-0.5">{date}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-2xl font-bold text-ink">{audit.score}</span>
                    <span className="text-xs text-ink-soft">/100</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
