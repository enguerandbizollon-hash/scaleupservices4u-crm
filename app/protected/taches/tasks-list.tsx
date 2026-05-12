"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, Search, AlertTriangle, Calendar } from "lucide-react";
import { completeAction } from "@/actions/actions";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  deal_id: string | null;
  organization_id: string | null;
  deal_name: string | null;
  deal_type: string | null;
  organization_name: string | null;
};

const DEAL_TYPE_COLORS: Record<string, { bg: string; tx: string }> = {
  fundraising: { bg: "var(--fund-bg)", tx: "var(--fund-tx)" },
  ma_sell: { bg: "var(--sell-bg)", tx: "var(--sell-tx)" },
  ma_buy: { bg: "var(--buy-bg)", tx: "var(--buy-tx)" },
  cfo_advisor: { bg: "var(--cfo-bg)", tx: "var(--cfo-tx)" },
  recruitment: { bg: "var(--rec-bg)", tx: "var(--rec-tx)" },
};

const PRIO_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: "Haute", color: "#EF4444" },
  medium: { label: "Moyenne", color: "#F59E0B" },
  low: { label: "Basse", color: "#6B7280" },
};

type Bucket = "overdue" | "today" | "week" | "later" | "none";
const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "En retard",
  today: "Aujourd'hui",
  week: "Cette semaine",
  later: "Plus tard",
  none: "Sans échéance",
};
const BUCKET_TONES: Record<Bucket, { bg: string; tx: string }> = {
  overdue: { bg: "#FEE2E2", tx: "#991B1B" },
  today: { bg: "#FEF3C7", tx: "#92400E" },
  week: { bg: "#DBEAFE", tx: "#1D4ED8" },
  later: { bg: "var(--surface-3)", tx: "var(--text-3)" },
  none: { bg: "var(--surface-3)", tx: "var(--text-5)" },
};

function bucketOf(due: string | null): Bucket {
  if (!due) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueD = new Date(due);
  dueD.setHours(0, 0, 0, 0);
  const diff = Math.floor((dueD.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

function fmtDue(due: string | null, time: string | null): string {
  if (!due) return "—";
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueD = new Date(due);
  dueD.setHours(0, 0, 0, 0);
  const diff = Math.floor((dueD.getTime() - today.getTime()) / 86400000);
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
  const suffix = time ? ` · ${time.slice(0, 5)}` : "";
  if (diff === 0) return `Aujourd'hui${suffix}`;
  if (diff === 1) return `Demain${suffix}`;
  if (diff === -1) return `Hier${suffix}`;
  if (diff < 0) return `${fmt} (il y a ${-diff}j)`;
  if (diff <= 7) return `${fmt} (dans ${diff}j)`;
  return `${fmt}${suffix}`;
}

export function TasksList({ tasks: init }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(init);
  const [search, setSearch] = useState("");
  const [filterDeal, setFilterDeal] = useState("all");
  const [filterPrio, setFilterPrio] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const dealOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) {
      if (t.deal_id && t.deal_name) m.set(t.deal_id, t.deal_name);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.deal_name ?? "").toLowerCase().includes(q) ||
      (t.organization_name ?? "").toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q);
    const matchDeal =
      filterDeal === "all" ||
      (filterDeal === "none" ? !t.deal_id : t.deal_id === filterDeal);
    const matchPrio = filterPrio === "all" || t.priority === filterPrio;
    return matchSearch && matchDeal && matchPrio;
  });

  const buckets: Record<Bucket, TaskRow[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    none: [],
  };
  for (const t of filtered) buckets[bucketOf(t.due_date)].push(t);

  const overdueCount = tasks.filter((t) => bucketOf(t.due_date) === "overdue").length;
  const todayCount = tasks.filter((t) => bucketOf(t.due_date) === "today").length;

  async function markDone(id: string) {
    setBusy(id);
    const res = await completeAction(id);
    if (res.success) {
      setTasks((p) => p.filter((t) => t.id !== id));
      setTimeout(() => router.refresh(), 800);
    }
    setBusy(null);
  }

  return (
    <div style={{ padding: 32, minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>
            Productivité
          </div>
          <h1 style={{ margin: 0 }}>Tâches</h1>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-4)", display: "flex", gap: 14, alignItems: "center" }}>
            <span>
              {tasks.length} tâche{tasks.length > 1 ? "s" : ""} ouverte
              {tasks.length > 1 ? "s" : ""}
            </span>
            {overdueCount > 0 && (
              <span style={{ color: "#991B1B", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertTriangle size={12} /> {overdueCount} en retard
              </span>
            )}
            {todayCount > 0 && (
              <span style={{ color: "#92400E", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <Calendar size={12} /> {todayCount} aujourd&apos;hui
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 420 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-4)", pointerEvents: "none" }} />
          <input className="inp" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titre, dossier, organisation…" style={{ paddingLeft: 36 }} />
        </div>
        <select className="inp" value={filterDeal} onChange={(e) => setFilterDeal(e.target.value)} style={{ minWidth: 200 }}>
          <option value="all">Tous dossiers</option>
          <option value="none">— Hors dossier —</option>
          {dealOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select className="inp" value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
          <option value="all">Toutes priorités</option>
          <option value="high">Haute</option>
          <option value="medium">Moyenne</option>
          <option value="low">Basse</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontWeight: 600, color: "var(--text-3)" }}>
            {tasks.length === 0 ? "Aucune tâche ouverte. Bien joué !" : "Aucune tâche ne correspond aux filtres."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => {
            const items = buckets[b];
            if (items.length === 0) return null;
            const tone = BUCKET_TONES[b];
            return (
              <div key={b}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    padding: "0 4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: 20,
                      background: tone.bg,
                      color: tone.tx,
                      letterSpacing: ".03em",
                      textTransform: "uppercase",
                    }}
                  >
                    {BUCKET_LABELS[b]}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-4)" }}>
                    {items.length} tâche{items.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {items.map((t) => (
                    <TaskCard key={t.id} task={t} busy={busy === t.id} onDone={() => markDone(t.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  busy,
  onDone,
}: {
  task: TaskRow;
  busy: boolean;
  onDone: () => void;
}) {
  const prio = PRIO_LABELS[task.priority] ?? PRIO_LABELS.medium;
  const dealColor = task.deal_type ? DEAL_TYPE_COLORS[task.deal_type] : null;
  return (
    <div
      className="card"
      style={{ padding: "11px 18px", display: "flex", alignItems: "center", gap: 14 }}
    >
      <button
        onClick={onDone}
        disabled={busy}
        title="Marquer comme fait"
        style={{
          background: "none",
          border: "none",
          cursor: busy ? "wait" : "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          color: "var(--text-4)",
        }}
        onMouseOver={(e) => (e.currentTarget.style.color = "var(--cs-active-tx)")}
        onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-4)")}
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
      </button>
      <div style={{ width: 6, height: 22, borderRadius: 3, background: prio.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }}>{task.title}</div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-4)",
            marginTop: 2,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {task.deal_id && task.deal_name && (
            <Link
              href={`/protected/dossiers/${task.deal_id}`}
              style={{
                color: dealColor?.tx ?? "var(--su-500)",
                fontWeight: 600,
                textDecoration: "none",
                background: dealColor?.bg ?? "transparent",
                padding: dealColor ? "1px 8px" : 0,
                borderRadius: 6,
              }}
            >
              {task.deal_name}
            </Link>
          )}
          {task.organization_id && task.organization_name && (
            <>
              {task.deal_id && <span style={{ color: "var(--border-2)" }}>·</span>}
              <Link
                href={`/protected/organisations/${task.organization_id}`}
                style={{ color: "var(--text-3)", textDecoration: "none" }}
              >
                {task.organization_name}
              </Link>
            </>
          )}
          {task.description && (
            <>
              <span style={{ color: "var(--border-2)" }}>·</span>
              <span style={{ color: "var(--text-4)" }}>
                {task.description.length > 80 ? task.description.slice(0, 80) + "…" : task.description}
              </span>
            </>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: bucketOf(task.due_date) === "overdue" ? "#991B1B" : "var(--text-3)",
          textAlign: "right",
          minWidth: 130,
          flexShrink: 0,
        }}
      >
        {fmtDue(task.due_date, task.due_time)}
      </div>
    </div>
  );
}
