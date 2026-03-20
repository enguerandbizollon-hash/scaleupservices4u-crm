"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const SECTORS = ["Généraliste","Technologie / SaaS","Intelligence Artificielle",
  "Fintech / Insurtech","Santé / Medtech","Industrie / Manufacturing","Énergie / CleanTech",
  "Immobilier","Distribution / Retail","Médias / Entertainment","Transport / Logistique",
  "Agroalimentaire","Éducation / EdTech","Défense / Sécurité","Tourisme / Hospitality",
  "Services B2B","Conseil / Advisory","Juridique","Finance / Investissement",
  "Ressources Humaines","Luxe / Premium","Construction / BTP","Télécommunications",
  "Agriculture / AgriTech","Chimie / Matériaux","Aérospatial","Environnement",
  "Sport / Loisirs","Bien-être / Beauté","Cybersécurité","Autre"];

const TICKETS = ["< 50k€","50k – 200k€","200k – 500k€","500k – 1M€","1M – 3M€","3M – 10M€","> 10M€"];
const STAGES  = ["Pre-seed","Seed","Série A","Série B","Growth","PE / LBO","Restructuring"];

type FieldKey = "sector" | "investment_ticket" | "investment_stage";

const OPTIONS: Record<FieldKey, string[]> = {
  sector: SECTORS,
  investment_ticket: TICKETS,
  investment_stage: STAGES,
};

const LABELS: Record<FieldKey, string> = {
  sector: "Secteur",
  investment_ticket: "Ticket",
  investment_stage: "Stade",
};

const ICONS: Record<FieldKey, string> = {
  sector: "🏭",
  investment_ticket: "💰",
  investment_stage: "📊",
};

export function FieldDropdown({ id, value, field, entity = "organisations" }: {
  id: string;
  value: string;
  field: FieldKey;
  entity?: string;
}) {
  const [current, setCurrent] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const options = OPTIONS[field];

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setCurrent(val);
    setSaving(true);
    await fetch(`/api/${entity}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: val || null }),
    });
    setSaving(false);
  }

  const isEmpty = !current;

  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
      <span style={{ fontSize:11 }}>{ICONS[field]}</span>
      <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
        <select value={current} onChange={handleChange} disabled={saving}
          style={{
            appearance:"none", WebkitAppearance:"none",
            border:"1px solid var(--border)", outline:"none", cursor:"pointer",
            background: isEmpty ? "var(--surface-3)" : "var(--surface-2)",
            color: isEmpty ? "var(--text-5)" : "var(--text-2)",
            borderRadius:7, padding:"2px 20px 2px 7px",
            fontSize:11.5, fontWeight:500, fontFamily:"inherit",
            maxWidth:160, transition:"all .12s",
          }}>
          <option value="">{LABELS[field]} —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span style={{ position:"absolute", right:5, pointerEvents:"none", fontSize:8, color:"var(--text-4)" }}>▼</span>
        {saving && <Loader2 size={10} className="animate-spin" style={{ position:"absolute", right:-14, color:"var(--su-500)" }}/>}
      </div>
    </div>
  );
}
