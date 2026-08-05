"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

// Point d'entrée VISIBLE de la recherche dans la sidebar. La recherche
// réelle vit dans la palette Cmd+K (components/ui/CommandPalette.tsx) :
// couverture complète (dossiers, organisations, contacts, actions) +
// actions rapides + navigation clavier. Ce bouton ne fait que l'ouvrir,
// il n'a plus de backend propre : l'ancien dropdown appelait /api/search
// (doublon ILIKE, RPC search_crm jamais créée), route retirée en même temps.
// Une seule recherche dans l'outil, un seul backend (actions/search.ts).
export function GlobalSearch() {
  const [mod, setMod] = useState("");
  useEffect(() => {
    setMod(navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl ");
  }, []);

  const openPalette = () => window.dispatchEvent(new Event("open-command-palette"));

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Ouvrir la recherche"
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "7px 9px",
        border: "1px solid var(--border)", borderRadius: 9,
        background: "var(--surface-2)", color: "var(--text-4)",
        fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
        textAlign: "left", transition: "border-color .12s",
      }}
    >
      <Search size={13} style={{ color: "var(--text-5)", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>Rechercher…</span>
      <kbd style={{
        fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4,
        background: "var(--surface-3)", color: "var(--text-5)",
        border: "1px solid var(--border)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}>
        {mod}K
      </kbd>
    </button>
  );
}
