"use client";
import { Clock } from "lucide-react";

interface TimeSelectProps {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}

const TIMES: string[] = [];
for (let h = 0; h < 24; h++)
  for (let m = 0; m < 60; m += 5)
    TIMES.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

export function TimeSelect({ value, onChange, style }: TimeSelectProps) {
  return (
    <div style={{ position:"relative", ...style }}>
      <Clock size={12} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-5)", pointerEvents:"none" }}/>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width:"100%", paddingLeft:28, paddingRight:8, paddingTop:8, paddingBottom:8,
          border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)",
          color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", outline:"none",
          appearance:"none", cursor:"pointer",
        }}
      >
        <option value="">— Heure —</option>
        {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}
