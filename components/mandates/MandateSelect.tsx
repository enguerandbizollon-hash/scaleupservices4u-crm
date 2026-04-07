"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface MandateOption {
  id: string;
  name: string;
  type: string;
  status?: string;
  client_name?: string | null;
}

interface Props {
  name: string;                              // form input name (= "mandate_id")
  mandates: MandateOption[];                  // liste complète passée par le server component
  defaultValue?: string | null;               // mandate_id pré-sélectionné
  // Optionnel : ouvre un MandateInlineForm via callback. Si absent, le bouton
  // "Créer un nouveau mandat" est masqué — utile pour la page nouveau dossier
  // (le dossier n'existe pas encore, on ne peut pas créer un mandat lié à un
  // deal_id inexistant).
  onCreateNew?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  fundraising: "Fundraising",
  ma_sell:     "M&A Sell",
  ma_buy:      "M&A Buy",
  cfo_advisor: "CFO Advisor",
  recruitment: "Recrutement",
};

// ── Component ────────────────────────────────────────────────────────────────

export function MandateSelect({ name, mandates, defaultValue, onCreateNew }: Props) {
  const [selectedId, setSelectedId] = useState<string>(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => mandates.find(m => m.id === selectedId) ?? null,
    [mandates, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mandates.slice(0, 20);
    return mandates.filter(m => {
      const hay = `${m.name} ${TYPE_LABELS[m.type] ?? m.type} ${m.client_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 20);
  }, [mandates, query]);

  // Fermer au clic hors du composant
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function pick(id: string) {
    setSelectedId(id);
    setOpen(false);
    setQuery("");
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  const wrapper: React.CSSProperties = { position: "relative", width: "100%" };
  const trigger: React.CSSProperties = {
    width: "100%", padding: "9px 13px", border: "1px solid #d1d5db",
    borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none",
    background: "#fff", color: "#111", cursor: "pointer", textAlign: "left",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  };
  const dropdown: React.CSSProperties = {
    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
    background: "#fff", border: "1px solid #d1d5db", borderRadius: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 50, maxHeight: 320,
    overflowY: "auto",
  };
  const search: React.CSSProperties = {
    width: "100%", padding: "8px 12px", border: "none", borderBottom: "1px solid #e5e7eb",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
    boxSizing: "border-box",
  };
  const item: React.CSSProperties = {
    width: "100%", padding: "9px 13px", border: "none", background: "transparent",
    textAlign: "left", cursor: "pointer", fontSize: 13, color: "#111",
    fontFamily: "inherit", display: "block",
  };
  const muted: React.CSSProperties = { color: "#6b7280", fontSize: 12, marginLeft: 6 };

  return (
    <div ref={wrapperRef} style={wrapper}>
      {/* Hidden input pour Server Action */}
      <input type="hidden" name={name} value={selectedId} />

      <button type="button" onClick={() => setOpen(o => !o)} style={trigger}>
        {selected ? (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600 }}>{selected.name}</span>
            <span style={muted}>· {TYPE_LABELS[selected.type] ?? selected.type}{selected.client_name ? ` · ${selected.client_name}` : ""}</span>
          </span>
        ) : (
          <span style={{ color: "#6b7280" }}>— Aucun mandat —</span>
        )}
        <span style={{ color: "#6b7280", fontSize: 11, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={dropdown}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un mandat…"
            style={search}
            autoFocus
          />

          {/* Option "Aucun mandat" */}
          <button type="button" onClick={() => pick("")} style={{
            ...item, color: selectedId === "" ? "#1a56db" : "#6b7280",
            fontWeight: selectedId === "" ? 600 : 400,
          }}>
            — Aucun mandat —
          </button>

          {filtered.length === 0 && query && (
            <div style={{ padding: "12px 13px", fontSize: 12.5, color: "#6b7280" }}>
              Aucun résultat pour « {query} »
            </div>
          )}

          {filtered.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m.id)}
              style={{
                ...item,
                background: m.id === selectedId ? "#eff6ff" : "transparent",
                fontWeight: m.id === selectedId ? 600 : 400,
              }}
              onMouseEnter={e => { if (m.id !== selectedId) e.currentTarget.style.background = "#f9fafb"; }}
              onMouseLeave={e => { if (m.id !== selectedId) e.currentTarget.style.background = "transparent"; }}
            >
              <div>{m.name}</div>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                {TYPE_LABELS[m.type] ?? m.type}
                {m.status ? ` · ${m.status}` : ""}
                {m.client_name ? ` · ${m.client_name}` : ""}
              </div>
            </button>
          ))}

          {onCreateNew && (
            <div style={{ borderTop: "1px solid #e5e7eb" }}>
              <button
                type="button"
                onClick={() => { setOpen(false); onCreateNew(); }}
                style={{ ...item, color: "#1a56db", fontWeight: 600 }}
              >
                + Créer un nouveau mandat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
