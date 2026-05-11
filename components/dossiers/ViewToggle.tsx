"use client";

import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

export function ViewToggle({ current }: { current: "list" | "kanban" }) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    border: "1px solid var(--border)",
    transition: "background .12s, color .12s",
  };
  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    background: "var(--text-1)",
    color: "var(--bg)",
    borderColor: "var(--text-1)",
  };
  const inactiveStyle: React.CSSProperties = {
    ...baseStyle,
    background: "var(--surface-2)",
    color: "var(--text-3)",
  };

  return (
    <div style={{ display: "inline-flex", borderRadius: 9, overflow: "hidden", boxShadow: "0 1px 0 rgba(0,0,0,.02)" }}>
      <Link
        href="/protected/dossiers"
        style={{
          ...(current === "list" ? activeStyle : inactiveStyle),
          borderTopLeftRadius: 9,
          borderBottomLeftRadius: 9,
          borderRightWidth: 0,
        }}
      >
        <List size={13} /> Liste
      </Link>
      <Link
        href="/protected/dossiers?view=kanban"
        style={{
          ...(current === "kanban" ? activeStyle : inactiveStyle),
          borderTopRightRadius: 9,
          borderBottomRightRadius: 9,
        }}
      >
        <LayoutGrid size={13} /> Kanban
      </Link>
    </div>
  );
}
