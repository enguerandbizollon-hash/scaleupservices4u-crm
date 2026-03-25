"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

interface ContactOrgAssignmentWarningProps {
  showAlert: boolean;
  contactName: string;
  onAssignClick?: () => void;
  inline?: boolean;
}

/**
 * Affiche un warning si un contact n'a pas d'organisation primaire assignée
 *
 * inline=true : badge inline (pour listes)
 * inline=false : banner distincte (pour detail page)
 */
export function ContactOrgAssignmentWarning({
  showAlert,
  contactName,
  onAssignClick,
  inline = true,
}: ContactOrgAssignmentWarningProps) {
  if (!showAlert) return null;

  if (inline) {
    // Badge inline pour listes
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 6,
          cursor: onAssignClick ? "pointer" : "default",
        }}
        onClick={onAssignClick}
        role={onAssignClick ? "button" : undefined}
        tabIndex={onAssignClick ? 0 : undefined}
      >
        <AlertCircle size={12} style={{ color: "rgb(239, 68, 68)" }} />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "rgb(239, 68, 68)",
          }}
        >
          Org. manquante
        </span>
      </div>
    );
  }

  // Banner distincte pour detail pages
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "rgba(239, 68, 68, 0.05)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 8,
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={16} style={{ color: "rgb(239, 68, 68)", flexShrink: 0 }} />
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "rgb(239, 68, 68)",
              marginBottom: 2,
            }}
          >
            Organisation manquante
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "rgb(156, 163, 175)",
            }}
          >
            {contactName} n'a pas d'organisation primaire assignée. Cela peut affecter les recherches et
            les rapports.
          </div>
        </div>
      </div>
      {onAssignClick && (
        <button
          onClick={onAssignClick}
          style={{
            padding: "6px 12px",
            background: "rgb(239, 68, 68)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Assigner
        </button>
      )}
    </div>
  );
}
