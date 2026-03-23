"use client";
import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";

type EntityType = "organisation" | "contact";
type Status = "idle" | "loading" | "success" | "notfound" | "error" | "no_keys";

interface EnrichResult {
  found: boolean;
  data?: Record<string, any>;
  updated?: string[];
  message?: string;
  keys_configured?: { hunter: boolean; apollo: boolean };
}

export function EnrichButton({
  id,
  type,
  name,
  onSuccess,
  size = "sm",
}: {
  id: string;
  type: EntityType;
  name?: string;
  onSuccess?: (data: EnrichResult) => void;
  size?: "sm" | "md";
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<EnrichResult | null>(null);

  async function handleEnrich() {
    setStatus("loading");
    try {
      const body = type === "organisation"
        ? { org_id: id, org_name: name }
        : { contact_id: id };

      const res = await fetch(`/api/enrich/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: EnrichResult = await res.json();

      if (!data.keys_configured?.hunter && !data.keys_configured?.apollo && type === "contact") {
        setStatus("no_keys");
        return;
      }
      if (!data.found) {
        setStatus("notfound");
      } else {
        setStatus("success");
        setResult(data);
        onSuccess?.(data);
        // Reset après 4s
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const pad = size === "sm" ? "4px 10px" : "6px 14px";
  const fz  = size === "sm" ? 11.5 : 13;

  const configs: Record<Status, { label: string; icon: any; bg: string; tx: string; disabled: boolean }> = {
    idle:     { label: "Enrichir", icon: Sparkles, bg: "var(--surface-2)", tx: "var(--text-3)", disabled: false },
    loading:  { label: "Recherche…", icon: Loader2, bg: "var(--surface-2)", tx: "var(--text-4)", disabled: true },
    success:  { label: result?.updated?.length ? `+${result.updated.length} champ${result.updated.length > 1 ? "s" : ""}` : "À jour", icon: Check, bg: "var(--fund-bg)", tx: "var(--fund-tx)", disabled: true },
    notfound: { label: "Introuvable", icon: AlertCircle, bg: "var(--sell-bg)", tx: "var(--sell-tx)", disabled: false },
    error:    { label: "Erreur", icon: AlertCircle, bg: "var(--rec-bg)", tx: "var(--rec-tx)", disabled: false },
    no_keys:  { label: "Clés API manquantes", icon: AlertCircle, bg: "var(--sell-bg)", tx: "var(--sell-tx)", disabled: false },
  };

  const cfg = configs[status];
  const Icon = cfg.icon;

  return (
    <button
      onClick={handleEnrich}
      disabled={cfg.disabled}
      title={
        type === "contact"
          ? "Chercher email pro et LinkedIn via Hunter.io / Apollo"
          : "Enrichir via Pappers (SIRET, CA, effectif)"
      }
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: pad, border: "1px solid var(--border)",
        borderRadius: 8, background: cfg.bg, color: cfg.tx,
        fontSize: fz, fontWeight: 500, fontFamily: "inherit",
        cursor: cfg.disabled ? "default" : "pointer",
        transition: "all .15s", whiteSpace: "nowrap",
      }}
    >
      <Icon
        size={size === "sm" ? 11 : 13}
        className={status === "loading" ? "animate-spin" : ""}
      />
      {cfg.label}
    </button>
  );
}
