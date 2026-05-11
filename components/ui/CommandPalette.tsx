"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, Building2, User, Briefcase, Activity, ArrowRight } from "lucide-react";
import { searchGlobal, type SearchHit } from "@/actions/search";

const KIND_META: Record<SearchHit["kind"], { label: string; icon: typeof FolderOpen; color: string }> = {
  deal:         { label: "Dossier",      icon: FolderOpen,  color: "var(--fund-tx)" },
  organization: { label: "Organisation", icon: Building2,   color: "var(--sell-tx)" },
  contact:      { label: "Contact",      icon: User,        color: "var(--buy-tx)"  },
  mandate:      { label: "Mandat",       icon: Briefcase,   color: "var(--cfo-tx)"  },
  action:       { label: "Action",       icon: Activity,    color: "var(--rec-tx)"  },
};

function hrefFor(hit: SearchHit): string {
  switch (hit.kind) {
    case "deal":         return `/protected/dossiers/${hit.id}`;
    case "organization": return `/protected/organisations/${hit.id}`;
    case "contact":      return `/protected/contacts/${hit.id}`;
    case "mandate":      return `/protected/mandats/${hit.id}`;
    case "action":       return hit.deal_id ? `/protected/dossiers/${hit.deal_id}` : "/protected/dossiers";
  }
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActiveIndex(0);
  }, []);

  // Raccourci Cmd+K / Ctrl+K + event custom 'open-command-palette'
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const accel = isMac ? e.metaKey : e.ctrlKey;
      if (accel && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    }
    function onOpenEvent() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpenEvent);
    };
  }, [open, close]);

  // Focus l'input à l'ouverture
  useEffect(() => {
    if (open) {
      // Petit délai pour laisser le DOM se monter
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Recherche debounced
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const results = await searchGlobal(query);
      if (cancelled) return;
      setHits(results);
      setLoading(false);
      setActiveIndex(0);
    }, 160);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query, open]);

  const navigate = useCallback((hit: SearchHit) => {
    router.push(hrefFor(hit));
    close();
  }, [router, close]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[activeIndex];
      if (hit) navigate(hit);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.4)",
          zIndex: 500,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "12vh", left: "50%",
          transform: "translateX(-50%)",
          width: "min(640px, 92vw)",
          maxHeight: "70vh",
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 12,
          zIndex: 501,
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 48px rgba(0,0,0,.18)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <Search size={15} color="var(--text-4)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher dossiers, organisations, contacts, mandats, actions."
            style={{
              flex: 1,
              border: "none", outline: "none",
              background: "transparent",
              fontSize: 15, color: "var(--text-1)",
              fontFamily: "inherit",
            }}
          />
          <kbd style={{
            fontSize: 10.5, fontWeight: 600,
            padding: "2px 6px", borderRadius: 5,
            background: "var(--surface-3)",
            color: "var(--text-5)",
            border: "1px solid var(--border)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}>
            ESC
          </kbd>
        </div>

        <div style={{ overflowY: "auto", padding: "8px" }}>
          {loading && (
            <div style={{ padding: 18, color: "var(--text-5)", fontSize: 13 }}>Recherche en cours.</div>
          )}
          {!loading && query.trim().length < 2 && (
            <div style={{ padding: 18, color: "var(--text-5)", fontSize: 13, lineHeight: 1.6 }}>
              <div>Tape au moins 2 caractères. La recherche couvre :</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-4)", fontSize: 12.5 }}>
                <li>Dossiers (nom, description)</li>
                <li>Organisations (nom)</li>
                <li>Contacts (nom, prénom, email)</li>
                <li>Mandats (nom)</li>
                <li>Actions (titre)</li>
              </ul>
            </div>
          )}
          {!loading && query.trim().length >= 2 && hits.length === 0 && (
            <div style={{ padding: 18, color: "var(--text-5)", fontSize: 13 }}>
              Aucun résultat pour &laquo;&nbsp;{query.trim()}&nbsp;&raquo;.
            </div>
          )}
          {!loading && hits.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {hits.map((hit, idx) => {
                const meta = KIND_META[hit.kind];
                const Icon = meta.icon;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(hit)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid transparent",
                      background: isActive ? "var(--surface-2)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: "var(--surface-3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: meta.color,
                      flexShrink: 0,
                    }}>
                      <Icon size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hit.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-5)", display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: meta.color }}>{meta.label}</span>
                        {hit.subtitle && <span style={{ color: "var(--text-5)" }}>{hit.subtitle}</span>}
                        {hit.meta && <span style={{ color: "var(--text-5)" }}>· {hit.meta}</span>}
                      </div>
                    </div>
                    {isActive && <ArrowRight size={13} color="var(--text-5)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-2)",
          display: "flex", justifyContent: "space-between",
          fontSize: 11, color: "var(--text-5)",
        }}>
          <span>↑↓ Naviguer · ↵ Ouvrir · ESC Fermer</span>
          <span>Cmd+K / Ctrl+K</span>
        </div>
      </div>
    </>
  );
}
