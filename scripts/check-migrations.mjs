#!/usr/bin/env node
// Garde-fou : échoue si un fichier supabase_migration_vN.sql local
// n'est pas enregistré dans la table _crm_migrations_applied en DB.
// Wiring : npm run prebuild (bloque `next build` en cas d'écart).
//
// Env requis :
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (lecture seule suffit)
//
// Comportement :
//   - env absent  → exit 0 avec warning (cas install sans .env encore)
//   - table absente → exit 1 (v40 non appliquée)
//   - écart versions → exit 1 avec la liste des manquantes

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Charge .env.local si présent (contexte local). Sur Vercel, les vars
// sont déjà dans process.env — on ne touche pas aux existantes.
const envPath = resolve(repoRoot, ".env.local");
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) {
      // Enlève guillemets simples/doubles si présents
      process.env[k] = v.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn(
    "⚠ [check-migrations] SUPABASE env vars absentes. Skip. " +
    "Configure NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY pour activer la vérification."
  );
  process.exit(0);
}

const localVersions = readdirSync(repoRoot)
  .filter(f => /^supabase_migration_v\d+\.sql$/.test(f))
  .map(f => f.match(/^supabase_migration_(v\d+)\.sql$/)[1])
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

if (localVersions.length === 0) {
  console.log("✓ [check-migrations] Aucun fichier de migration local trouvé.");
  process.exit(0);
}

const supabase = createClient(url, key);
const { data, error } = await supabase
  .from("_crm_migrations_applied")
  .select("version");

if (error) {
  console.error("✗ [check-migrations] Lecture _crm_migrations_applied impossible :", error.message);
  console.error("  → Applique supabase_migration_v40.sql dans Supabase SQL Editor avant de builder.");
  process.exit(1);
}

const applied = new Set((data ?? []).map(r => r.version));
const missing = localVersions.filter(v => !applied.has(v));

if (missing.length === 0) {
  console.log(`✓ [check-migrations] ${localVersions.length} migrations en phase avec la DB.`);
  process.exit(0);
}

console.error("✗ [check-migrations] MIGRATIONS LOCALES NON APPLIQUÉES EN DB :");
for (const v of missing) {
  console.error(`   - ${v}  (applique supabase_migration_${v}.sql puis INSERT INTO _crm_migrations_applied)`);
}
console.error("\nBuild bloqué. Corrige la DB avant de redéployer.");
process.exit(1);
