"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DocumentFormClient({ dealId, action }: { dealId: string; action: (fd: FormData) => Promise<void> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await action(fd);
      router.push(`/protected/dossiers/${dealId}`);
    } catch(err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(errorMessage);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div>
        <label style={{ display:"block", fontSize:12, fontWeight:600, color:"var(--text-3)", marginBottom:5 }}>Nom du document *</label>
        <input name="name" required style={{ width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", boxSizing:"border-box" as const }}/>
      </div>
      <div>
        <label style={{ display:"block", fontSize:12, fontWeight:600, color:"var(--text-3)", marginBottom:5 }}>Type</label>
        <select name="document_type" style={{ width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit" }}>
          <option value="teaser">Teaser</option>
          <option value="deck">Deck</option>
          <option value="modele_financier">Modèle financier</option>
          <option value="nda">NDA</option>
          <option value="loi">LOI / Term sheet</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div>
        <label style={{ display:"block", fontSize:12, fontWeight:600, color:"var(--text-3)", marginBottom:5 }}>URL du document</label>
        <input name="document_url" type="url" placeholder="https://..." style={{ width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", boxSizing:"border-box" as const }}/>
      </div>
      <div>
        <label style={{ display:"block", fontSize:12, fontWeight:600, color:"var(--text-3)", marginBottom:5 }}>Version</label>
        <input name="version_label" placeholder="ex: v1.0" style={{ width:"100%", padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5, fontFamily:"inherit", boxSizing:"border-box" as const }}/>
      </div>
      <input type="hidden" name="deal_id" value={dealId}/>
      <button type="submit" disabled={loading} style={{ padding:"10px 20px", borderRadius:9, background:"var(--accent,#1a56db)", color:"#fff", border:"none", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
        {loading ? "Enregistrement…" : "Ajouter le document"}
      </button>
    </form>
  );
}
