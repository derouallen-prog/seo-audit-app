import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getBridgeToken(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("wp_bridge_tokens")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.token) return data.token;

  const token = crypto.randomBytes(32).toString("base64url");
  await supabaseAdmin.from("wp_bridge_tokens").insert({ token, user_id: userId });
  return token;
}

export async function getUserIdFromToken(token: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("wp_bridge_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  return data?.user_id ?? null;
}

export async function enqueueScript(
  userId: string,
  script: string,
  description: string,
  targetUrl?: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("wp_bridge_queue")
    .insert({ user_id: userId, script, description, target_url: targetUrl ?? null, status: "pending" })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Erreur enqueue script: ${error?.message}`);
  return data.id as string;
}

export interface PendingScript {
  id: string;
  script: string;
  description: string;
  target_url: string | null;
}

export async function pollPendingScripts(userId: string): Promise<PendingScript[]> {
  const { data } = await supabaseAdmin
    .from("wp_bridge_queue")
    .select("id, script, description, target_url")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (!data?.length) return [];

  const ids = data.map((d: { id: string }) => d.id);
  await supabaseAdmin
    .from("wp_bridge_queue")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .in("id", ids);

  return data as PendingScript[];
}

export async function ackScript(id: string, success: boolean, result?: string): Promise<void> {
  await supabaseAdmin
    .from("wp_bridge_queue")
    .update({
      status: success ? "executed" : "failed",
      result: result ?? null,
      executed_at: new Date().toISOString(),
    })
    .eq("id", id);
}
