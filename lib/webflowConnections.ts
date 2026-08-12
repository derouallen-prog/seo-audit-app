import { createClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken } from "./tokenCrypto";
import type { WebflowSite } from "./webflowClient";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface WebflowConnection {
  id: string;
  userId: string;
  accessToken: string;
  sites: WebflowSite[];
  createdAt: string;
  updatedAt: string;
}

export async function getWebflowConnection(userId: string): Promise<WebflowConnection | null> {
  const { data } = await supabaseAdmin
    .from("webflow_connections")
    .select("id, user_id, access_token, sites, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  return deserialize(data);
}

export async function saveWebflowConnection(
  userId: string,
  accessToken: string,
  sites: WebflowSite[]
): Promise<void> {
  const { error } = await supabaseAdmin.from("webflow_connections").upsert(
    {
      user_id: userId,
      access_token: encryptToken(accessToken),
      sites: sites,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Erreur sauvegarde Webflow: ${error.message}`);
}

export async function deleteWebflowConnection(userId: string): Promise<void> {
  await supabaseAdmin.from("webflow_connections").delete().eq("user_id", userId);
}

function deserialize(data: Record<string, unknown>): WebflowConnection {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    accessToken: decryptToken(data.access_token as string),
    sites: (data.sites as WebflowSite[]) ?? [],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}
