"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, Building2, User, Activity, ArrowRight, Plus, Inbox, BarChart2, CheckSquare } from "lucide-react";
import { searchGlobal, type SearchHit } from "@/actions/search";

const KIND_META: Record<SearchHit["kind"], { label: string; icon: typeof FolderOpen; color: string }> = {
  deal:         { label: "Dossier",      icon: FolderOpen,  color: "var(--fund-tx)" },
  organization: { label: "Organisation", icon: Building2,   color: "var(--sell-tx)" },
  contact:      { label: "Contact",      icon: User,        color: "var(--buy-tx)"  },
  action:       { label: "Action",       icon: Activity,    color: "var(--rec-tx)"  },
};

// V58 — Quick actions accessibles depuis la palette pour réduire la friction.
// Création directe en 1 clic, sans avoir à naviguer vers la page de liste.
type QuickAction = {
  id: string;
  kind: "create" | "navigate";
  label: string;
  href: string;
  icon: typeof Plus;
  color: string;
  keywords: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "create-deal",     kind: "create",   label: "Nouveau dossier",        href: "/protected/dossiers/nouveau",      icon: FolderOpen,  color: "var(--fund-tx)", keywords: "dossier deal mission" },
  { id: "create-contact",  kind: "create",   label: "Nouveau contact",        href: "/protected/contacts/nouveau",      icon: User,        color: "var(--buy-tx)",  keywords: "contact personne" },
  { id: "create-org",      kind: "create",   label: "Nouvelle organisation",  href: "/protected/organisations/nouveau", icon: Building2,   color: "var(--sell-tx)", keywords: "organisation entreprise fonds investisseur" },
  { id: "go-inbox",        kind: "navigate", label: "Boîte de tri (emails)",  href: "/protected/inbox",                 icon: Inbox,       color: "#E11D48",        keywords: "inbox emails tri" },
  { id: "go-tasks",        kind: "navigate", label: "Tâches à faire",         href: "/protected/taches",                icon: CheckSquare, color: "#7E57C2",        keywords: "taches todo a faire" },
  { id: "go-stats",        kind: "navigate", label: "Statistiques",           href: "/protected/statistiques",          icon: BarChart2,   color: "#0F766E",        keywords: "stats fees performance" },
];

function hrefFor(hit: SearchHit): string {
  switch (hit.kind) {
    case "deal":         return `/protected/dossiers/${hit.id}`;
    case "organization": return `/protected/organisations/${hit.id}`;
    case "contact":      return `/protected/contacts/${hit.id}`;
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

  const goTo = useCallback((href: string) => {
    router.push(href);
    close();
  }, [router, close]);

  // Filtrage des quick actions selon la requête (matche label + keywords)
  const filteredActions = useMemo<QuickAction[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_ACTIONS;
    return QUICK_ACTIONS.filter((a) =>
      a.label.toLowerCase().includes(q) || a.keywords.includes(q),
    );
  }, [query]);

  // Indexation unifiée : quick actions en haut, puis hits de recherche.
  // ActiveIndex couvre les deux groupes en continu pour la nav clavier.
  const totalItems = filteredActions.length + hits.length;
  const itemAt = (idx: number): { kind: "action"; action: QuickAction } | { kind: "hit"; hit: SearchHit } | null => {
    if (idx < filteredActions.length) {
      const a = filteredActions[idx];
      return a ? { kind: "action", action: a } : null;
    }
    const h = hits[idx - filteredActions.length];
    return h ? { kind: "hit", hit: h } : null;
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (totalItems === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = itemAt(activeIndex);
      if (!item) return;
      if (item.kind === "action") goTo(item.action.href);
      else navigate(item.hit);
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
            placeholder="Rechercher dossiers, organisations, contacts, actions."
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

          {/* V58 — Quick actions : toujours affichées si query vide ou matche */}
          {!loading && filteredActions.length > 0 && (
            <>
              <div style={{ padding: "10px 12px 4px", fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                Actions rapides
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {filteredActions.map((action, idx) => {
                  const Icon = action.icon;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => goTo(action.href)}
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
                        color: action.color,
                        flexShrink: 0,
                      }}>
                        {action.kind === "create" ? <Plus size={13} /> : <Icon size={13} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {action.label}
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, color: "var(--text-5)", padding: "1px 6px", borderRadius: 4, background: "var(--surface-3)" }}>
                        {action.kind === "create" ? "Créer" : "Ouvrir"}
                      </span>
                      {isActive && <ArrowRight size={13} color="var(--text-5)" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {!loading && query.trim().length < 2 && filteredActions.length === 0 && (
            <div style={{ padding: 18, color: "var(--text-5)", fontSize: 13, lineHeight: 1.6 }}>
              <div>Tape au moins 2 caractères pour rechercher.</div>
            </div>
          )}
          {!loading && query.trim().length >= 2 && hits.length === 0 && filteredActions.length === 0 && (
            <div style={{ padding: 18, color: "var(--text-5)", fontSize: 13 }}>
              Aucun résultat pour &laquo;&nbsp;{query.trim()}&nbsp;&raquo;.
            </div>
          )}

          {/* Résultats de recherche */}
          {!loading && hits.length > 0 && (
            <>
              <div style={{ padding: "10px 12px 4px", marginTop: filteredActions.length > 0 ? 4 : 0, fontSize: 10.5, fontWeight: 700, color: "var(--text-5)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                Résultats
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {hits.map((hit, idx) => {
                  const meta = KIND_META[hit.kind];
                  const Icon = meta.icon;
                  const globalIdx = filteredActions.length + idx;
                  const isActive = globalIdx === activeIndex;
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(globalIdx)}
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
            </>
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
