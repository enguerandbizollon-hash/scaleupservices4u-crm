"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Building2, User, FolderOpen, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Result = { id: string; type: "organization"|"contact"|"deal"; name: string; sub: string; status: string };

const TYPE_ICON = { organization: Building2, contact: User, deal: FolderOpen };
const TYPE_LABEL = { organization: "Organisation", contact: "Contact", deal: "Dossier" };
const TYPE_LINK = {
  organization: (id: string) => `/protected/organisations/${id}`,
  contact:      (id: string) => `/protected/contacts/${id}`,
  deal:         (id: string) => `/protected/dossiers/${id}`,
};
const STATUS_LABELS: Record<string,string> = {
  active:"Actif", qualified:"Qualifié", to_qualify:"À qualifier",
  priority:"Prioritaire", dormant:"Dormant", inactive:"Inactif", excluded:"Exclu",
};

export function GlobalSearch() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<{ organizations:Result[]; contacts:Result[]; deals:Result[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const ref   = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[Global search error]", msg);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query) { setResults(null); return; }
    timer.current = setTimeout(() => search(query), 220);
    return () => clearTimeout(timer.current);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const inp = ref.current?.querySelector("input") as HTMLInputElement;
        inp?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const allResults = results ? [
    ...(results.organizations??[]).map(r => ({ ...r, type:"organization" as const })),
    ...(results.contacts??[]).map(r => ({ ...r, type:"contact" as const })),
    ...(results.deals??[]).map(r => ({ ...r, type:"deal" as const })),
  ] : [];

  function goTo(r: Result) {
    router.push(TYPE_LINK[r.type](r.id));
    setOpen(false);
    setQuery("");
    setResults(null);
  }

  return (
    <div ref={ref} style={{ position:"relative", width:"100%" }}>
      <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
        {loading
          ? <Loader2 size={13} style={{ position:"absolute", left:9, color:"var(--text-4)", animation:"spin .7s linear infinite" }}/>
          : <Search size={13} style={{ position:"absolute", left:9, color:"var(--text-5)" }}/>
        }
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher… (⌘K)"
          style={{
            width:"100%", paddingLeft:28, paddingRight: query ? 28 : 8,
            paddingTop:7, paddingBottom:7,
            border:"1px solid var(--border)", borderRadius:9,
            background:"var(--surface-2)", color:"var(--text-1)",
            fontSize:12.5, fontFamily:"inherit", outline:"none",
            transition:"border-color .12s, box-shadow .12s",
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && allResults.length > 0) goTo(allResults[0]);
          }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults(null); }}
            style={{ position:"absolute", right:6, background:"none", border:"none", cursor:"pointer", color:"var(--text-4)", padding:2 }}>
            <X size={11}/>
          </button>
        )}
      </div>

      {open && allResults.length > 0 && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, right:0, zIndex:1000,
          background:"var(--surface)", border:"1px solid var(--border-2)",
          borderRadius:12, boxShadow:"var(--shadow-md)", overflow:"hidden",
          maxHeight:360, overflowY:"auto",
        }}>
          {allResults.map((r, i) => {
            const Icon = TYPE_ICON[r.type];
            return (
              <div key={`${r.type}-${r.id}`} onClick={() => goTo(r)}
                style={{
                  display:"flex", alignItems:"center", gap:9,
                  padding:"9px 12px", cursor:"pointer",
                  borderBottom: i < allResults.length-1 ? "1px solid var(--border)" : "none",
                  transition:"background .1s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <div style={{ width:26, height:26, borderRadius:7, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Icon size={12} color="var(--text-3)"/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                  <div style={{ fontSize:11, color:"var(--text-5)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {TYPE_LABEL[r.type]}
                    {r.sub && ` · ${r.sub}`}
                  </div>
                </div>
                <span style={{ fontSize:10, color:"var(--text-5)", flexShrink:0 }}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {open && query.length >= 2 && !loading && allResults.length === 0 && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, right:0, zIndex:1000,
          background:"var(--surface)", border:"1px solid var(--border-2)",
          borderRadius:12, padding:"16px 14px", fontSize:12.5, color:"var(--text-4)",
          textAlign:"center", boxShadow:"var(--shadow-md)",
        }}>
          Aucun résultat pour « {query} »
        </div>
      )}
    </div>
  );
}
