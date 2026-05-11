"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, Check } from "lucide-react";
import { createAction } from "@/actions/actions";
import { getPlaybook, type PlaybookAction } from "@/lib/crm/stage-playbooks";

const TYPE_ICON: Record<PlaybookAction["type"], string> = {
  task: "✓",
  email: "✉️",
  call: "📞",
  meeting: "🤝",
  deadline: "⏰",
  document_request: "📄",
  interview: "👥",
  technical_test: "🧪",
};

export function StagePlaybook({
  dealId,
  dealType,
  dealStage,
}: {
  dealId: string;
  dealType: string;
  dealStage: string;
}) {
  const playbook = getPlaybook(dealType, dealStage);
  const router = useRouter();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  if (!playbook) return null;

  async function handleAdd(action: PlaybookAction) {
    if (adding) return;
    setAdding(action.title);
    const dueDate = action.due_in_days != null
      ? new Date(Date.now() + action.due_in_days * 86400000).toISOString().split("T")[0]!
      : null;
    const res = await createAction({
      type: action.type,
      title: action.title,
      description: action.description ?? undefined,
      due_date: dueDate,
      hard_deadline: action.hard_deadline ?? false,
      deal_id: dealId,
    });
    setAdding(null);
    if (res.success) {
      setAdded(prev => new Set(prev).add(action.title));
      router.refresh();
    } else {
      alert(res.error ?? "Erreur lors de la création de l'action");
    }
  }

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "12px 16px",
          background: "linear-gradient(135deg, rgba(52,104,176,.08), rgba(90,140,208,.04))",
          border: "none", cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
          <ListChecks size={14} color="var(--text-3)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Playbook · {playbook.title}
            </div>
            {!collapsed && (
              <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3, fontWeight: 500, textTransform: "none", letterSpacing: 0, lineHeight: 1.4 }}>
                {playbook.intent}
              </div>
            )}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-4)" }}>
          {playbook.actions.length} suggestion{playbook.actions.length > 1 ? "s" : ""}
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: "8px 12px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {playbook.actions.map((action) => {
            const isAdded = added.has(action.title);
            const isAdding = adding === action.title;
            return (
              <div
                key={action.title}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 11px",
                  borderRadius: 9,
                  background: isAdded ? "rgba(16, 185, 129, .08)" : "var(--surface-2)",
                  border: `1px solid ${isAdded ? "rgba(16, 185, 129, .3)" : "var(--border)"}`,
                  opacity: isAdded ? 0.85 : 1,
                  transition: "background .12s, border-color .12s",
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: "var(--surface)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, flexShrink: 0,
                }}>
                  {TYPE_ICON[action.type]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.4 }}>
                    {action.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>
                    {action.due_in_days != null && <span>Échéance suggérée : J+{action.due_in_days}</span>}
                    {action.hard_deadline && <span style={{ marginLeft: 6, color: "var(--rec-tx)", fontWeight: 600 }}>· Hard deadline</span>}
                  </div>
                </div>
                {isAdded ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#065F46", padding: "4px 10px" }}>
                    <Check size={12} /> Ajoutée
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAdd(action)}
                    disabled={isAdding}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "5px 10px", borderRadius: 7,
                      border: "1px solid var(--accent, #1a56db)",
                      background: "var(--surface)",
                      color: "var(--accent, #1a56db)",
                      fontSize: 11.5, fontWeight: 600,
                      cursor: isAdding ? "default" : "pointer",
                      fontFamily: "inherit",
                      opacity: isAdding ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={11} />
                    {isAdding ? "..." : "Ajouter"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
