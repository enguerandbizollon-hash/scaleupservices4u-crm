"use client";

import { useState } from "react";
import { HEALTH_META, type DealHealthResult } from "@/lib/crm/health-score";

export function DealHealthBadge({
  health,
  size = "md",
  showLabel = true,
  showScore = true,
}: {
  health: DealHealthResult;
  size?: "sm" | "md";
  showLabel?: boolean;
  showScore?: boolean;
}) {
  const meta = HEALTH_META[health.band];
  const [hovered, setHovered] = useState(false);

  const isSm = size === "sm";
  const sizeStyles: React.CSSProperties = isSm
    ? { fontSize: 10.5, padding: "2px 7px", gap: 4 }
    : { fontSize: 11.5, padding: "3px 9px", gap: 5 };

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 20,
        background: meta.bg,
        color: meta.tx,
        fontWeight: 700,
        cursor: health.reasons.length > 0 ? "help" : "default",
        whiteSpace: "nowrap",
        ...sizeStyles,
      }}
      title={health.reasons.join("\n")}
    >
      <span style={{
        width: isSm ? 5 : 6,
        height: isSm ? 5 : 6,
        borderRadius: "50%",
        background: meta.dot,
        flexShrink: 0,
      }} />
      {showLabel && <span>{meta.label}</span>}
      {showScore && (
        <span style={{ opacity: .8, fontWeight: 600 }}>
          {health.score}
        </span>
      )}

      {/* Tooltip détaillé au hover (medium / desktop seulement) */}
      {hovered && !isSm && health.reasons.length > 0 && (
        <span style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          zIndex: 50,
          minWidth: 240,
          maxWidth: 320,
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 9,
          padding: "10px 12px",
          fontSize: 11.5,
          fontWeight: 500,
          color: "var(--text-2)",
          boxShadow: "0 8px 16px rgba(0,0,0,.12)",
          textAlign: "left",
          whiteSpace: "normal",
          lineHeight: 1.5,
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
            Score santé · {health.score}/100
          </div>
          {health.reasons.map((r, i) => (
            <div key={i} style={{ marginBottom: 3, color: r.startsWith("-") ? "var(--rec-tx)" : "var(--text-2)" }}>{r}</div>
          ))}
        </span>
      )}
    </span>
  );
}
