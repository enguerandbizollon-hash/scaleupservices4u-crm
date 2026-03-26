import { createClient } from "@supabase/supabase-js";

// Client service role — bypass RLS
// Utiliser UNIQUEMENT dans les pages serveur où l'accès public est intentionnel
// Ne JAMAIS exposer côté client
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
