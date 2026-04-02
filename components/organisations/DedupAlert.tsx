"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { checkDuplicates, mergeOrganisations } from "@/actions/dedup";
import type { DuplicateCandidate } from "@/lib/dedup/organisations";

interface DedupAlertProps {
  name: string;
  website: string | null;
  linkedinUrl: string | null;
  excludeId?: string;
}

const MATCH_LABELS: Record<string, string> = {
  name: "Nom identique",
  website: "Site web identique",
  linkedin: "LinkedIn identique",
};

export function DedupAlert({ name, website, linkedinUrl, excludeId }: DedupAlertProps) {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [merged, setMerged] = useState<Set<string>>(new Set());

  const check = useCallback(async () => {
    if (name.trim().length < 3) { setCandidates([]); return; }
    const results = await checkDuplicates(name, website, linkedinUrl, excludeId);
    setCandidates(results);
    if (results.length > 0) setDismissed(false);
  }, [name, website, linkedinUrl, excludeId]);

  useEffect(() => {
    const t = setTimeout(check, 600);
    return () => clearTimeout(t);
  }, [check]);

  if (candidates.length === 0 || dismissed) return null;

  return (
    <div style={{
      padding: "12px 16px",
      background: "#FEF3C7",
      border: "1px solid #FDE68A",
      borderRadius: 10,
      marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <AlertTriangle size={14} color="#92400E" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>
          {candidates.length} doublon{candidates.length > 1 ? "s" : ""} potentiel{candidates.length > 1 ? "s" : ""} détecté{candidates.length > 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setDismissed(true)}
          style={{ marginLeft: "auto", fontSize: 11, color: "#92400E", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
        >
          Ignorer
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {candidates.filter(c => !merged.has(c.id)).map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <Link
              href={`/protected/organisations/${c.id}`}
              target="_blank"
              style={{ color: "#92400E", fontWeight: 600, textDecoration: "underline" }}
            >
              {c.name}
            </Link>
            <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, background: "#FDE68A", color: "#78350F" }}>
              {MATCH_LABELS[c.matchType] ?? c.matchType}
            </span>
            {c.website && <span style={{ fontSize: 11, color: "#92400E" }}>{c.website}</span>}
            {excludeId && (
              <button
                disabled={merging === c.id}
                onClick={async () => {
                  if (!confirm(`Fusionner "${c.name}" dans l'organisation en cours ?\n\nTous les dossiers, contacts et activités liés à "${c.name}" seront transférés.`)) return;
                  setMerging(c.id);
                  const res = await mergeOrganisations(excludeId, c.id);
                  setMerging(null);
                  if (res.success) {
                    setMerged(prev => new Set([...prev, c.id]));
                  } else {
                    alert(res.error ?? "Erreur lors de la fusion");
                  }
                }}
                style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #92400E", background: "none", color: "#92400E", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
              >
                {merging === c.id ? "…" : "Fusionner ici"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
