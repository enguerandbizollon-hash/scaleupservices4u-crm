"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getRecruitmentKanban,
  searchCandidatesForDeal,
  addCandidateToDealAction,
  moveCandidateStageAction,
  removeCandidateFromDealAction,
  clearNeedsReviewAction,
  setPlacementFeeAction,
  type KanbanData,
  type KanbanCandidate,
} from "@/actions/recruitment-kanban";
import { CANDIDATE_STATUSES } from "@/lib/crm/matching-maps";
import { UserSearch, ChevronLeft, ChevronRight, X, Plus, Search } from "lucide-react";

const SENIORITY_SHORT: Record<string, string> = {
  junior: "Jr", mid: "Confirmé", senior: "Sr", lead: "Lead", director: "Dir.", "c-level": "C-Level",
};

function CandidateCard({
  item, stages, dealId, onMove, onRemove, onClearReview, onFeeSet,
}: {
  item: KanbanCandidate;
  stages: { value: string; label: string }[];
  dealId: string;
  onMove: (dcId: string, newStage: string) => Promise<void>;
  onRemove: (dcId: string) => Promise<void>;
  onClearReview: (dcId: string) => Promise<void>;
  onFeeSet: (dcId: string, fee: number | null) => Promise<void>;
}) {
  const [moving, setMoving]   = useState(false);
  const [feeEdit, setFeeEdit] = useState(false);
  const [feeVal, setFeeVal]   = useState(item.placement_fee != null ? String(item.placement_fee) : "");
  const cand = item.candidate;
  if (!cand) return null;

  const st = CANDIDATE_STATUSES.find(s => s.value === cand.candidate_status);
  const stageIdx = stages.findIndex(s => s.value === item.stage);
  const hasPrev = stageIdx > 0;
  const hasNext = stageIdx < stages.length - 1;
  const isClosing = item.stage === "closing";

  async function move(dir: "prev" | "next") {
    const newStage = dir === "prev" ? stages[stageIdx - 1].value : stages[stageIdx + 1].value;
    setMoving(true);
    await onMove(item.dc_id, newStage);
    setMoving(false);
  }

  async function saveFee() {
    const fee = feeVal.trim() ? Number(feeVal) : null;
    await onFeeSet(item.dc_id, fee);
    setFeeEdit(false);
  }

  return (
    <div style={{
      background: item.needs_review ? "#FFFBEB" : "var(--surface)",
      border: `1px solid ${item.needs_review ? "#F59E0B" : "var(--border)"}`,
      borderRadius: 9,
      padding: "10px 11px",
      marginBottom: 6,
      opacity: moving ? .5 : 1,
      transition: "opacity .15s",
    }}>
      {/* Alerte à revoir M5 */}
      {item.needs_review && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7, padding: "3px 7px", background: "#FEF3C7", borderRadius: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#92400E" }}>⚠ À revoir — dossier fermé</span>
          <button
            onClick={() => onClearReview(item.dc_id)}
            title="Marquer comme revu"
            style={{ border: "none", background: "transparent", color: "#92400E", cursor: "pointer", fontSize: 11, padding: 0, fontFamily: "inherit", fontWeight: 700 }}
          >
            ✓ Revu
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href={`/protected/candidats/${cand.id}`}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {cand.last_name} {cand.first_name}
          </Link>
          {cand.title && (
            <div style={{ fontSize: 11.5, color: "var(--text-4)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cand.title}
            </div>
          )}
        </div>
        <button
          onClick={() => onRemove(item.dc_id)}
          style={{ flexShrink: 0, padding: "2px 5px", border: "none", background: "transparent", color: "var(--text-5)", cursor: "pointer", fontSize: 12, lineHeight: 1 }}
          title="Retirer du dossier"
        >
          <X size={12} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          {st && (
            <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: st.bg, color: st.tx, fontWeight: 600 }}>
              {st.label}
            </span>
          )}
          {cand.seniority && (
            <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: "var(--surface-3)", color: "var(--text-4)", fontWeight: 600 }}>
              {SENIORITY_SHORT[cand.seniority] ?? cand.seniority}
            </span>
          )}
          {item.combined_score != null && (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#1a56db" }}>
              {Math.round(item.combined_score)}pts
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={() => move("prev")}
            disabled={!hasPrev || moving}
            style={{ padding: "2px 5px", border: "1px solid var(--border)", borderRadius: 5, background: "var(--surface-2)", color: hasPrev ? "var(--text-3)" : "var(--text-6)", cursor: hasPrev ? "pointer" : "default", opacity: hasPrev ? 1 : .3 }}
            title="Étape précédente"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            onClick={() => move("next")}
            disabled={!hasNext || moving}
            style={{ padding: "2px 5px", border: "1px solid var(--border)", borderRadius: 5, background: "var(--surface-2)", color: hasNext ? "var(--text-3)" : "var(--text-6)", cursor: hasNext ? "pointer" : "default", opacity: hasNext ? 1 : .3 }}
            title="Étape suivante"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Fee de placement M5 — visible en colonne Closing */}
      {isClosing && (
        <div style={{ marginTop: 8, paddingTop: 7, borderTop: "1px solid var(--border)" }}>
          {feeEdit ? (
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <input
                autoFocus
                type="number"
                value={feeVal}
                onChange={e => setFeeVal(e.target.value)}
                placeholder="Fee (€)"
                style={{ flex: 1, padding: "4px 7px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit", background: "var(--surface)", color: "var(--text-1)", outline: "none" }}
              />
              <button onClick={saveFee} style={{ padding: "4px 9px", border: "none", borderRadius: 6, background: "#1a56db", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                OK
              </button>
              <button onClick={() => setFeeEdit(false)} style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface-2)", color: "var(--text-4)", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setFeeEdit(true)}
              style={{ fontSize: 11, color: item.placement_fee != null ? "#065F46" : "var(--text-4)", background: item.placement_fee != null ? "#D1FAE5" : "var(--surface-3)", border: "none", borderRadius: 20, padding: "1px 8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
            >
              {item.placement_fee != null
                ? `Fee : ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(item.placement_fee)}`
                : "Saisir fee de placement"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddCandidatePanel({ dealId, onAdded }: { dealId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; first_name: string; last_name: string; title: string | null; candidate_status: string }[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    const r = await searchCandidatesForDeal(dealId, q);
    setResults(r);
  }, [dealId]);

  useEffect(() => {
    if (open) doSearch(search);
  }, [open, search, doSearch]);

  async function add(candidateId: string) {
    setAdding(candidateId);
    await addCandidateToDealAction(dealId, candidateId);
    setAdding(null);
    setResults(r => r.filter(c => c.id !== candidateId));
    onAdded();
  }

  return (
    <div style={{ margin: "12px 0 0 0" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
        >
          <Plus size={13} /> Ajouter un candidat au vivier
        </button>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Search size={13} color="var(--text-5)" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un candidat..."
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "var(--text-1)", outline: "none", fontFamily: "inherit" }}
            />
            <button onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", color: "var(--text-5)", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>

          {results.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--text-5)", textAlign: "center", padding: "8px 0" }}>
              {search ? "Aucun candidat trouvé" : "Tous les candidats du vivier sont déjà dans ce dossier"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
              {results.map(c => {
                const st = CANDIDATE_STATUSES.find(s => s.value === c.candidate_status);
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 7, background: "var(--surface-2)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                        {c.last_name} {c.first_name}
                      </div>
                      {c.title && <div style={{ fontSize: 11.5, color: "var(--text-5)" }}>{c.title}</div>}
                    </div>
                    {st && (
                      <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 20, background: st.bg, color: st.tx, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {st.label}
                      </span>
                    )}
                    <button
                      onClick={() => add(c.id)}
                      disabled={adding === c.id}
                      style={{ padding: "4px 10px", border: "none", borderRadius: 6, background: "#1a56db", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: adding === c.id ? .6 : 1, whiteSpace: "nowrap" }}
                    >
                      {adding === c.id ? "…" : "Ajouter"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RecruitmentKanban({ dealId }: { dealId: string }) {
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getRecruitmentKanban(dealId);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  async function handleMove(dcId: string, newStage: string) {
    if (!data) return;
    // Optimistic update
    const newColumns = { ...data.columns };
    let moved: KanbanCandidate | undefined;
    for (const stage of Object.keys(newColumns)) {
      const idx = newColumns[stage].findIndex(c => c.dc_id === dcId);
      if (idx !== -1) {
        moved = { ...newColumns[stage][idx], stage: newStage };
        newColumns[stage] = newColumns[stage].filter(c => c.dc_id !== dcId);
        break;
      }
    }
    if (moved) {
      newColumns[newStage] = [...(newColumns[newStage] ?? []), moved];
      setData({ ...data, columns: newColumns });
    }
    const res = await moveCandidateStageAction(dcId, newStage, dealId);
    if (!res.success) load(); // revert on error
    else load(); // reload to get updated statuses from M5 triggers
  }

  async function handleRemove(dcId: string) {
    if (!data) return;
    const newColumns = { ...data.columns };
    for (const stage of Object.keys(newColumns)) {
      newColumns[stage] = newColumns[stage].filter(c => c.dc_id !== dcId);
    }
    setData({ ...data, columns: newColumns });
    const res = await removeCandidateFromDealAction(dcId, dealId);
    if (!res.success) load();
  }

  async function handleClearReview(dcId: string) {
    if (!data) return;
    // Optimistic update
    const newColumns = { ...data.columns };
    for (const stage of Object.keys(newColumns)) {
      const idx = newColumns[stage].findIndex(c => c.dc_id === dcId);
      if (idx !== -1) {
        newColumns[stage][idx] = { ...newColumns[stage][idx], needs_review: false };
        break;
      }
    }
    setData({ ...data, columns: newColumns });
    await clearNeedsReviewAction(dcId, dealId);
  }

  async function handleFeeSet(dcId: string, fee: number | null) {
    await setPlacementFeeAction(dcId, dealId, fee);
    load();
  }

  if (loading) return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-5)", fontSize: 13 }}>
      Chargement du pipeline…
    </div>
  );

  if (error) return (
    <div style={{ padding: "20px", background: "#FEE2E2", borderRadius: 10, color: "#991B1B", fontSize: 13 }}>
      Erreur : {error}
    </div>
  );

  if (!data) return null;

  const totalCandidates = Object.values(data.columns).flat().length;
  const needsReviewCount = Object.values(data.columns).flat().filter(c => c.needs_review).length;

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: needsReviewCount > 0 ? 10 : 16 }}>
        <UserSearch size={15} color="var(--text-4)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Pipeline candidats
        </span>
        <span style={{ fontSize: 11.5, background: "var(--surface-3)", color: "var(--text-4)", borderRadius: 20, padding: "1px 7px", fontWeight: 600 }}>
          {totalCandidates}
        </span>
        {needsReviewCount > 0 && (
          <span style={{ fontSize: 11.5, background: "#FEF3C7", color: "#92400E", borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>
            ⚠ {needsReviewCount} à revoir
          </span>
        )}
      </div>

      {/* Kanban */}
      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, minWidth: `${data.stages.length * 210}px` }}>
          {data.stages.map(stage => {
            const cards = data.columns[stage.value] ?? [];
            return (
              <div key={stage.value} style={{ flex: 1, minWidth: 200 }}>
                {/* Colonne header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 10px", marginBottom: 6,
                  background: "var(--surface-2)", borderRadius: 8,
                  border: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: 11, background: cards.length > 0 ? "#DBEAFE" : "var(--surface-3)", color: cards.length > 0 ? "#1D4ED8" : "var(--text-5)", borderRadius: 20, padding: "1px 6px", fontWeight: 700 }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cartes */}
                <div style={{ minHeight: 60 }}>
                  {cards.map(item => (
                    <CandidateCard
                      key={item.dc_id}
                      item={item}
                      stages={data.stages}
                      dealId={dealId}
                      onMove={handleMove}
                      onRemove={handleRemove}
                      onClearReview={handleClearReview}
                      onFeeSet={handleFeeSet}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div style={{ height: 48, border: "1px dashed var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 11.5, color: "var(--text-6, var(--text-5))" }}>—</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ajouter candidat */}
      <AddCandidatePanel dealId={dealId} onAdded={load} />
    </div>
  );
}
