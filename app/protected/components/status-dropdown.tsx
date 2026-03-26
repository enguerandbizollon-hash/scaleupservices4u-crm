"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type Entity = "contacts" | "organisations";

const CONTACT_STATUSES = [
  { value:"active",     label:"Actif",       bg:"var(--cs-active-bg)",    tx:"var(--cs-active-tx)" },
  { value:"priority",   label:"Prioritaire", bg:"var(--cs-priority-bg)",  tx:"var(--cs-priority-tx)" },
  { value:"qualified",  label:"Qualifié",    bg:"var(--cs-qualified-bg)", tx:"var(--cs-qualified-tx)" },
  { value:"to_qualify", label:"À qualifier", bg:"var(--cs-qualify-bg)",   tx:"var(--cs-qualify-tx)" },
  { value:"dormant",    label:"Dormant",     bg:"var(--cs-dormant-bg)",   tx:"var(--cs-dormant-tx)" },
  { value:"inactive",   label:"Inactif",     bg:"var(--cs-inactive-bg)",  tx:"var(--cs-inactive-tx)" },
  { value:"excluded",   label:"Exclu",       bg:"var(--cs-excluded-bg)",  tx:"var(--cs-excluded-tx)" },
];

const ORG_STATUSES = [
  { value:"active",     label:"Actif",        bg:"var(--cs-active-bg)",   tx:"var(--cs-active-tx)" },
  { value:"to_qualify", label:"Non qualifié", bg:"var(--cs-qualify-bg)",  tx:"var(--cs-qualify-tx)" },
  { value:"inactive",   label:"Inactif",      bg:"var(--cs-inactive-bg)", tx:"var(--cs-inactive-tx)" },
];

export function StatusDropdown({ id, status, entity, size = "sm" }: {
  id: string; status: string; entity: Entity; size?: "sm"|"md";
}) {
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);
  const statuses = entity === "contacts" ? CONTACT_STATUSES : ORG_STATUSES;
  const cur_s = statuses.find(s => s.value === current) ?? statuses[3];
  const pad = size === "sm" ? "2px 8px" : "5px 12px";
  const fz  = size === "sm" ? "10.5px"  : "12px";

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setCurrent(val);
    setSaving(true);
    await fetch(`/api/${entity}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_status: val }),
    });
    setSaving(false);
  }

  return (
    <div style={{ position:"relative", display:"inline-flex", alignItems:"center", gap:4 }}>
      <select value={current} onChange={handleChange} disabled={saving}
        style={{ appearance:"none", WebkitAppearance:"none", border:"none", outline:"none", cursor:"pointer",
          background:cur_s.bg, color:cur_s.tx, borderRadius:7, padding:pad,
          fontSize:fz, fontWeight:600, fontFamily:"inherit", paddingRight:"18px", transition:"all .12s" }}>
        {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <span style={{ position:"absolute", right:4, pointerEvents:"none", fontSize:8, color:cur_s.tx, opacity:.6 }}>▼</span>
      {saving && <Loader2 size={10} className="animate-spin" style={{ color:"var(--su-500)" }}/>}
    </div>
  );
}
