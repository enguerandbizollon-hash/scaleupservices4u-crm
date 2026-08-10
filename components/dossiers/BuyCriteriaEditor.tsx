"use client";
import { useState } from "react";
import { updateBuyCriteriaAction } from "@/actions/deals";
import { IncludeExcludeMultiSelect } from "@/components/ui/IncludeExcludeMultiSelect";
import { SECTOR_FACET_GROUPS, GEO_FACET_GROUPS } from "@/components/ui/referential-facets";
import { geoLabel } from "@/lib/crm/geo-match";
import { Pencil, Check, X, Loader2 } from "lucide-react";

// Critères de recherche d'un mandat d'acquisition, ÉDITABLES sur la fiche
// (retour 2026-08-10 : « je ne peux pas modifier les critères »). Mêmes
// sélecteurs harmonisés que le wizard de création (référentiel unique).
// Lecture : chips. Édition : secteurs et géos visés/exclus, enregistrés en un
// geste (updateBuyCriteriaAction), relus par le scoring et la qualification.

interface Criteria {
  target_sectors: string[];
  excluded_sectors: string[];
  target_geographies: string[];
  excluded_geographies: string[];
}

function ChipsLine({ label, values, geo, tone }: { label: string; values: string[]; geo?: boolean; tone: "target" | "exclude" }) {
  if (values.length === 0) return null;
  const colors = tone === "target"
    ? { bg: "#D1FAE5", tx: "#065F46" }
    : { bg: "#FEE2E2", tx: "#991B1B" };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-5)", minWidth: 110, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {values.map((v) => (
          <span key={v} style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 20, background: colors.bg, color: colors.tx, fontWeight: 600 }}>
            {geo ? geoLabel(v) : v}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BuyCriteriaEditor({ dealId, initial }: { dealId: string; initial: Criteria }) {
  const [saved, setSaved] = useState<Criteria>(initial);
  const [draft, setDraft] = useState<Criteria>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const res = await updateBuyCriteriaAction(dealId, draft);
    setSaving(false);
    if (!res.success) { setErr(res.error); return; }
    setSaved(draft);
    setEditing(false);
  }

  const empty =
    saved.target_sectors.length === 0 && saved.excluded_sectors.length === 0 &&
    saved.target_geographies.length === 0 && saved.excluded_geographies.length === 0;

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: editing || !empty ? 8 : 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em" }}>
          Secteurs et géographies
        </span>
        {!editing && (
          <button type="button" onClick={() => { setDraft(saved); setEditing(true); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: "#1a56db", fontFamily: "inherit", padding: 0 }}>
            <Pencil size={11} /> Modifier
          </button>
        )}
      </div>

      {!editing && empty && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-5)" }}>
          Aucun critère de secteur ou de géographie. Importez la fiche de cadrage (Marché, Cibles) ou cliquez Modifier.
        </p>
      )}

      {!editing && !empty && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <ChipsLine label="Secteurs visés" values={saved.target_sectors} tone="target" />
          <ChipsLine label="Secteurs exclus" values={saved.excluded_sectors} tone="exclude" />
          <ChipsLine label="Géos visées" values={saved.target_geographies} geo tone="target" />
          <ChipsLine label="Géos exclues" values={saved.excluded_geographies} geo tone="exclude" />
        </div>
      )}

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 5 }}>Secteurs (visés / exclus)</div>
            <IncludeExcludeMultiSelect groups={SECTOR_FACET_GROUPS}
              included={draft.target_sectors} excluded={draft.excluded_sectors}
              onIncluded={(v) => setDraft((d) => ({ ...d, target_sectors: v }))}
              onExcluded={(v) => setDraft((d) => ({ ...d, excluded_sectors: v }))} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 5 }}>Géographies (visées / exclues)</div>
            <IncludeExcludeMultiSelect groups={GEO_FACET_GROUPS}
              included={draft.target_geographies} excluded={draft.excluded_geographies}
              onIncluded={(v) => setDraft((d) => ({ ...d, target_geographies: v }))}
              onExcluded={(v) => setDraft((d) => ({ ...d, excluded_geographies: v }))} />
          </div>
          {err && <div style={{ fontSize: 12, color: "#991B1B" }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={save} disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "none", background: "#065F46", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Enregistrer
            </button>
            <button type="button" onClick={() => { setEditing(false); setDraft(saved); setErr(null); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <X size={12} /> Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
