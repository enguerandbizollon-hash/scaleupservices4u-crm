import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getValidToken } from "@/lib/gcal/gcal-client";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export const revalidate = 0;

// Page Connecteurs HONNÊTE (audit 2026-07-31 : « l'écran ne dit pas la
// vérité ») : chaque état est vérifié côté serveur au chargement. Les clés
// sont testées en PRÉSENCE uniquement, leurs valeurs ne quittent jamais le
// serveur et ne sont jamais affichées.

const GOOGLE_SCOPES = [
  { scope: "https://www.googleapis.com/auth/calendar.events", label: "Agenda" },
  { scope: "https://www.googleapis.com/auth/drive.readonly", label: "Drive (lecture)" },
  { scope: "https://www.googleapis.com/auth/gmail.readonly", label: "Gmail (lecture, boîte de tri)" },
  { scope: "https://www.googleapis.com/auth/gmail.compose", label: "Brouillons Gmail (funnel acquéreur)" },
];

/** Scopes réellement accordés au token courant (tokeninfo), null si non connecté. */
async function getGrantedScopes(userId: string): Promise<string[] | null> {
  try {
    const token = await getValidToken(userId);
    if (!token) return null;
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { scope?: string };
    return j.scope ? j.scope.split(" ") : [];
  } catch {
    return null;
  }
}

type Chip = { label: string; tone: "ok" | "warn" | "off" };

const TONE: Record<Chip["tone"], { bg: string; tx: string }> = {
  ok:   { bg: "#D1FAE5", tx: "#065F46" },
  warn: { bg: "#FEF3C7", tx: "#92400E" },
  off:  { bg: "var(--surface-3)", tx: "var(--text-5)" },
};

function StatusChip({ chip }: { chip: Chip }) {
  const t = TONE[chip.tone];
  const Icon = chip.tone === "ok" ? CheckCircle : chip.tone === "warn" ? AlertTriangle : XCircle;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 10px", borderRadius: 20, background: t.bg, color: t.tx, fontWeight: 600 }}>
      <Icon size={12} /> {chip.label}
    </span>
  );
}

function Row({ icon, iconBg, nom, desc, chip, hint, action }: {
  icon: string; iconBg: string; nom: string; desc: string;
  chip: Chip; hint: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{nom}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-4)", marginTop: 2 }}>{desc}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusChip chip={chip} />
          {action}
        </div>
      </div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12.5, color: "var(--text-4)" }}>
        {hint}
      </div>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ gcal?: string }> }) {
  const { gcal } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const granted = user ? await getGrantedScopes(user.id) : null;
  const googleConnected = granted !== null;
  const missingScopes = googleConnected
    ? GOOGLE_SCOPES.filter(s => !granted!.includes(s.scope))
    : GOOGLE_SCOPES;

  // Présence des clés : booléens serveur, jamais les valeurs.
  const keys = {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    pappers: !!(process.env.PAPPERS_API_KEY || process.env.PAPPERS_API_TOKEN),
    hunter: !!process.env.HUNTER_API_KEY,
    apollo: !!process.env.APOLLO_API_KEY,
    franceTravail: !!(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET),
    claude: !!process.env.ANTHROPIC_API_KEY,
  };

  const googleChip: Chip = !keys.google
    ? { label: "Identifiants absents", tone: "off" }
    : !googleConnected
      ? { label: "Non connecté", tone: "off" }
      : missingScopes.length > 0
        ? { label: "Reconnexion requise", tone: "warn" }
        : { label: "Connecté", tone: "ok" };

  const keyChip = (present: boolean, offLabel = "Clé absente"): Chip =>
    present ? { label: "Actif", tone: "ok" } : { label: offLabel, tone: "off" };

  return (
    <div style={{ padding: "28px 24px", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>Connecteurs</h1>
      <p style={{ fontSize: 13.5, color: "var(--text-4)", marginBottom: 18 }}>
        États vérifiés au chargement de la page. Les clés vivent dans .env.local, jamais affichées ici.
      </p>

      {gcal === "success" && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "#D1FAE5", color: "#065F46", fontSize: 13, fontWeight: 600 }}>
          Google connecté. Les droits accordés sont vérifiés ci-dessous.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        <Row icon="🔗" iconBg="#fff7ed" nom="Google (Agenda, Drive, Gmail)"
          desc="Un seul compte Google : agenda, import Drive, boîte de tri et brouillons Gmail"
          chip={googleChip}
          action={keys.google ? (
            <a href="/api/gcal" style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: "#1a56db", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              {googleConnected ? "Reconnecter" : "Connecter"}
            </a>
          ) : undefined}
          hint={
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {GOOGLE_SCOPES.map(s => {
                  const ok = googleConnected && granted!.includes(s.scope);
                  return (
                    <span key={s.scope} style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 6, background: ok ? "#D1FAE5" : "var(--surface-3)", color: ok ? "#065F46" : "var(--text-5)", fontWeight: 600 }}>
                      {ok ? "✓" : "✗"} {s.label}
                    </span>
                  );
                })}
              </div>
              {!keys.google && <span>Nécessite GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env.local (console.cloud.google.com).</span>}
              {googleConnected && missingScopes.length > 0 && (
                <span>Des droits ajoutés récemment manquent au consentement actuel : cliquez « Reconnecter » pour les accorder (les brouillons Gmail du funnel en dépendent).</span>
              )}
            </div>
          }
        />

        <Row icon="🏛" iconBg="#eff6ff" nom="Pappers"
          desc="Enrichissement légal et financier : finances, dirigeants, actionnariat"
          chip={keyChip(keys.pappers)}
          hint={<span>Bouton « Enrichir » sur les fiches organisation et prospection. Clé : PAPPERS_API_KEY ou PAPPERS_API_TOKEN dans .env.local.</span>}
        />

        <Row icon="📮" iconBg="#f0fdf4" nom="France Travail"
          desc="Offres d'emploi de direction sur les fiches chaudes (signal de transmission)"
          chip={keyChip(keys.franceTravail)}
          hint={<span>Consommé par la veille quotidienne (cron signaux). Clés : FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET (+ FRANCE_TRAVAIL_SCOPE) dans .env.local.</span>}
        />

        <Row icon="🚀" iconBg="#f5f3ff" nom="Apollo"
          desc="Coordonnées des dirigeants (emails, LinkedIn) et découverte d'acquéreurs"
          chip={keyChip(keys.apollo)}
          hint={<span>Cascade d&apos;enrichissement contact (Hunter puis Apollo) et sourcing des mandats. Clé : APOLLO_API_KEY dans .env.local.</span>}
        />

        <Row icon="🔍" iconBg="#fff7ed" nom="Hunter.io"
          desc="Recherche d'emails professionnels"
          chip={keyChip(keys.hunter)}
          hint={<span>Premier maillon de la cascade d&apos;enrichissement contact. Clé : HUNTER_API_KEY dans .env.local.</span>}
        />

        <Row icon="🤖" iconBg="#eef2ff" nom="Claude (IA)"
          desc="Screenings, teasers, synthèses 360, classification des emails et signaux"
          chip={keyChip(keys.claude)}
          hint={<span>Clé : ANTHROPIC_API_KEY dans .env.local. Sans elle, tout ce qui est génératif échoue (les échecs passent par la cloche).</span>}
        />

      </div>
    </div>
  );
}

export default function ConnecteursPage({ searchParams }: { searchParams: Promise<{ gcal?: string }> }) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}><div style={{ height: 400, borderRadius: 14, background: "var(--surface-2)" }} /></div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
