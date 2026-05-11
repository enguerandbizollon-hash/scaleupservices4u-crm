"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Moon, FileWarning, ArrowRight } from "lucide-react";

export interface DashboardAlert {
  kind: "tasks_overdue" | "fees_overdue" | "deals_dormant" | "rgpd_expiring";
  count: number;
  href: string;
}

const META: Record<DashboardAlert["kind"], {
  label: (n: number) => string;
  icon: typeof AlertTriangle;
  bg: string;
  tx: string;
  border: string;
}> = {
  tasks_overdue: {
    label: (n) => `${n} tâche${n > 1 ? "s" : ""} en retard`,
    icon: Clock,
    bg: "#FEE2E2", tx: "#991B1B", border: "#FCA5A5",
  },
  fees_overdue: {
    label: (n) => `${n} jalon${n > 1 ? "s" : ""} fees en retard (>30j)`,
    icon: FileWarning,
    bg: "#FEF3C7", tx: "#92400E", border: "#FDE68A",
  },
  deals_dormant: {
    label: (n) => `${n} dossier${n > 1 ? "s" : ""} dormant${n > 1 ? "s" : ""}`,
    icon: Moon,
    bg: "#E0E7FF", tx: "#3730A3", border: "#C7D2FE",
  },
  rgpd_expiring: {
    label: (n) => `${n} échéance${n > 1 ? "s" : ""} RGPD < 30j`,
    icon: AlertTriangle,
    bg: "#FCE7F3", tx: "#9D174D", border: "#FBCFE8",
  },
};

export function AlertsBar({ alerts }: { alerts: DashboardAlert[] }) {
  const filtered = alerts.filter(a => a.count > 0);
  if (filtered.length === 0) return null;

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 8,
      marginBottom: 20,
      padding: "12px 16px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 11, fontWeight: 700, color: "var(--text-4)",
        textTransform: "uppercase", letterSpacing: ".06em",
        marginRight: 8,
      }}>
        <AlertTriangle size={13} color="var(--text-4)" />
        Points d&apos;attention
      </div>
      {filtered.map((alert) => {
        const meta = META[alert.kind];
        const Icon = meta.icon;
        return (
          <Link
            key={alert.kind}
            href={alert.href}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 11px",
              borderRadius: 18,
              background: meta.bg,
              color: meta.tx,
              border: `1px solid ${meta.border}`,
              fontSize: 12.5, fontWeight: 600,
              textDecoration: "none",
              transition: "transform .12s, box-shadow .12s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(-1px)";
              el.style.boxShadow = "0 2px 6px rgba(0,0,0,.06)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "";
              el.style.boxShadow = "";
            }}
          >
            <Icon size={12} />
            <span>{meta.label(alert.count)}</span>
            <ArrowRight size={11} />
          </Link>
        );
      })}
    </div>
  );
}
