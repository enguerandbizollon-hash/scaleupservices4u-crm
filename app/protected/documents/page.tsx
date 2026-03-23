import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, ExternalLink } from "lucide-react";

async function Content() {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("deal_documents")
    .select("id,name,document_type,document_status,document_url,version_label,added_at,deal_id,deals(name)")
    .order("added_at", { ascending: false })
    .limit(50);

  const list = docs ?? [];

  return (
    <div style={{ padding:"28px 24px", maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text-1)", margin:0 }}>Documents</h1>
      </div>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, overflow:"hidden" }}>
        {list.length === 0 && (
          <div style={{ padding:"48px", textAlign:"center", color:"var(--text-5)", fontSize:13 }}>
            Aucun document — ajoutez-en depuis la fiche d'un dossier.
          </div>
        )}
        {list.map((d, i) => {
          const deal = Array.isArray(d.deals) ? d.deals[0] : d.deals as any;
          return (
            <div key={d.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 20px", borderBottom: i < list.length-1 ? "1px solid var(--border)" : "none" }}>
              <FileText size={14} color="var(--text-4)"/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:600, color:"var(--text-1)" }}>{d.name}</div>
                <div style={{ fontSize:12, color:"var(--text-5)", marginTop:2 }}>
                  {d.document_type}{d.version_label ? ` · v${d.version_label}` : ""}
                  {deal?.name ? ` · ${deal.name}` : ""}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {d.document_url && (
                  <a href={d.document_url} target="_blank" rel="noreferrer" style={{ width:28, height:28, borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", color:"var(--text-4)" }}>
                    <ExternalLink size={12}/>
                  </a>
                )}
                {d.deal_id && (
                  <Link href={`/protected/dossiers/${d.deal_id}`} style={{ fontSize:12, padding:"4px 10px", borderRadius:7, background:"var(--surface-2)", border:"1px solid var(--border)", textDecoration:"none", color:"var(--text-4)" }}>
                    Dossier
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return <Suspense fallback={null}><Content/></Suspense>;
}
