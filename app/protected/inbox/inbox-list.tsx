"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Mail, Send, RefreshCw, Check, Link2, UserPlus, Folder, X, Sparkles, CheckSquare, Square } from "lucide-react";
import {
  assignReviewToDeal,
  assignReviewToContact,
  bulkAssignReviewsToDeal,
  bulkDismissReviews,
  createContactFromInboxEmail,
  dismissReview,
  triggerGmailSync,
  type InboxReviewRow,
  type GmailSyncStatus,
} from "@/actions/gmail-ingest";

interface DealOption {
  id: string;
  name: string;
  deal_type: string;
}
interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Props {
  items: InboxReviewRow[];
  syncStatus: GmailSyncStatus | null;
  dealOptions: DealOption[];
  contactOptions: ContactOption[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatRelative(isoTs: string | null): string {
  if (!isoTs) return "Jamais";
  const d = new Date(isoTs);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  return `il y a ${days} j`;
}

function reasonLabel(reason: string | null): string {
  switch (reason) {
    case "no_contact_match": return "Contact inconnu";
    case "no_deal_match":    return "Dossier indéterminé";
    case "low_confidence":   return "Classification IA peu sûre";
    case "ambiguous_deal":   return "Plusieurs dossiers possibles";
    default:                 return "À trier";
  }
}

type DirFilter = "all" | "inbound" | "outbound";
type ReasonFilter = "all" | "no_contact_match" | "no_deal_match" | "low_confidence";

export function InboxList({ items, syncStatus, dealOptions, contactOptions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirFilter, setDirFilter] = useState<DirFilter>("all");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkDealQuery, setBulkDealQuery] = useState("");
  const [bulkDealOpen, setBulkDealOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (dirFilter !== "all" && i.email_direction !== dirFilter) return false;
      if (reasonFilter !== "all" && i.review_reason !== reasonFilter) return false;
      if (q) {
        const hay = [
          i.email_subject ?? "",
          i.title ?? "",
          i.email_from ?? "",
          (i.email_to ?? []).join(" "),
          i.email_body_preview ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, dirFilter, reasonFilter, search]);

  const empty = filteredItems.length === 0;

  const visibleIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);
  const checkedVisible = visibleIds.filter((id) => checked.has(id)).length;
  const allChecked = visibleIds.length > 0 && checkedVisible === visibleIds.length;

  function toggleOne(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }
  function clearSelection() {
    setChecked(new Set());
    setBulkDealOpen(false);
    setBulkDealQuery("");
  }

  const bulkDealMatches = useMemo(() => {
    const q = bulkDealQuery.trim().toLowerCase();
    if (!q) return dealOptions.slice(0, 8);
    return dealOptions
      .filter((d) => d.name.toLowerCase().includes(q) || d.deal_type.toLowerCase().includes(q))
      .slice(0, 8);
  }, [bulkDealQuery, dealOptions]);

  function doBulkDismiss() {
    const ids = Array.from(checked);
    startTransition(async () => {
      const res = await bulkDismissReviews(ids);
      if (res.success) {
        clearSelection();
        router.refresh();
      }
    });
  }
  function doBulkAssign(dealId: string) {
    const ids = Array.from(checked);
    startTransition(async () => {
      const res = await bulkAssignReviewsToDeal(ids, dealId);
      if (res.success) {
        clearSelection();
        router.refresh();
      }
    });
  }

  return (
    <div style={{ padding: "28px 32px", background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(225,29,72,.18)", border: "1px solid rgba(225,29,72,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Inbox size={20} style={{ color: "#E11D48" }} strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Boîte de tri</h1>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {items.length === 0
                ? "Tout est rattaché."
                : `${items.length} email${items.length > 1 ? "s" : ""} à rattacher manuellement.`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", lineHeight: 1.4 }}>
            <div>Dernière sync : {formatRelative(syncStatus?.last_synced_at ?? null)}</div>
            {syncStatus?.last_run_status === "failure" && (
              <div style={{ color: "#DC2626", fontWeight: 600 }}>Erreur : {syncStatus.last_run_error}</div>
            )}
            {syncStatus?.last_run_status && syncStatus.last_run_status !== "failure" && (
              <div>Dernier passage : {syncStatus.last_run_fetched ?? 0} lus, {syncStatus.last_run_created ?? 0} créés</div>
            )}
          </div>
          <button
            onClick={() => {
              startTransition(async () => {
                const res = await triggerGmailSync();
                if (res.success) router.refresh();
              });
            }}
            disabled={pending}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 14px", borderRadius: 8,
              background: "var(--su-500)", color: "#fff",
              border: "none", cursor: pending ? "wait" : "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              opacity: pending ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: pending ? "spin 1s linear infinite" : undefined }} />
            {pending ? "Synchronisation..." : "Lancer la sync"}
          </button>
        </div>
      </div>

      {/* Filtres */}
      {items.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Recherche par sujet, expéditeur ou contenu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 260px", minWidth: 260,
              padding: "8px 12px",
              background: "var(--surface)", color: "var(--text)",
              border: "1px solid var(--border)", borderRadius: 6,
              fontSize: 12, fontFamily: "inherit",
            }}
          />
          <FilterGroup
            label="Direction"
            value={dirFilter}
            onChange={setDirFilter}
            options={[
              { value: "all", label: "Tous" },
              { value: "inbound", label: "Reçus" },
              { value: "outbound", label: "Envoyés" },
            ]}
          />
          <FilterGroup
            label="Raison"
            value={reasonFilter}
            onChange={setReasonFilter}
            options={[
              { value: "all", label: "Toutes" },
              { value: "no_contact_match", label: "Contact inconnu" },
              { value: "no_deal_match", label: "Dossier ?" },
              { value: "low_confidence", label: "IA peu sûre" },
            ]}
          />
          {(dirFilter !== "all" || reasonFilter !== "all" || search.trim() !== "") && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {filteredItems.length} / {items.length}
            </span>
          )}
        </div>
      )}

      {/* Sélection bulk + barre d'actions */}
      {items.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 12px", marginBottom: 12,
          background: checked.size > 0 ? "rgba(225,29,72,.08)" : "var(--surface)",
          border: `1px solid ${checked.size > 0 ? "rgba(225,29,72,.4)" : "var(--border)"}`,
          borderRadius: 10,
          transition: "background .12s, border-color .12s",
        }}>
          <button
            onClick={toggleAllVisible}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "none",
              cursor: "pointer", color: "var(--text)",
              fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            }}
            title={allChecked ? "Tout désélectionner" : "Tout sélectionner"}
          >
            {allChecked ? <CheckSquare size={15} /> : <Square size={15} />}
            {checked.size === 0
              ? "Sélection"
              : `${checked.size} sélectionné${checked.size > 1 ? "s" : ""}`}
          </button>

          {checked.size > 0 && (
            <>
              <div style={{ flex: 1, position: "relative" }}>
                <button
                  onClick={() => setBulkDealOpen((o) => !o)}
                  disabled={pending}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 6,
                    background: "transparent", color: "var(--text)",
                    border: "1px solid var(--border)",
                    cursor: pending ? "wait" : "pointer",
                    fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                  }}
                >
                  <Folder size={12} /> Assigner au dossier...
                </button>
                {bulkDealOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0,
                    zIndex: 10, width: 320,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: 8,
                    boxShadow: "0 6px 24px rgba(0,0,0,.12)",
                  }}>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Rechercher un dossier..."
                      value={bulkDealQuery}
                      onChange={(e) => setBulkDealQuery(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 10px",
                        background: "var(--bg)", color: "var(--text)",
                        border: "1px solid var(--border)", borderRadius: 6,
                        fontSize: 12, fontFamily: "inherit",
                      }}
                    />
                    <div style={{ marginTop: 6, maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                      {bulkDealMatches.length === 0 ? (
                        <div style={{ fontSize: 11, color: "var(--muted)", padding: 8 }}>Aucun résultat</div>
                      ) : (
                        bulkDealMatches.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => doBulkAssign(d.id)}
                            disabled={pending}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "7px 10px", borderRadius: 6,
                              background: "transparent", color: "var(--text)",
                              border: "1px solid var(--border)",
                              cursor: pending ? "wait" : "pointer",
                              fontSize: 12, fontFamily: "inherit", textAlign: "left",
                            }}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>{d.deal_type}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={doBulkDismiss}
                disabled={pending}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 6,
                  background: "transparent", color: "var(--muted)",
                  border: "1px solid var(--border)",
                  cursor: pending ? "wait" : "pointer",
                  fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                }}
              >
                <X size={12} /> Tout ignorer
              </button>
              <button
                onClick={clearSelection}
                disabled={pending}
                style={{
                  background: "transparent", color: "var(--muted)",
                  border: "none", cursor: pending ? "wait" : "pointer",
                  fontSize: 11, fontFamily: "inherit",
                }}
              >
                Annuler
              </button>
            </>
          )}
        </div>
      )}

      {/* Liste */}
      {empty ? (
        <div style={{
          padding: 48, textAlign: "center",
          background: "var(--surface)", borderRadius: 12,
          border: "1px solid var(--border)",
          color: "var(--muted)",
        }}>
          <Check size={32} style={{ color: "#10B981", marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            {items.length === 0 ? "Boîte de tri vide" : "Aucun résultat avec ces filtres"}
          </div>
          <div style={{ fontSize: 13 }}>
            {items.length === 0
              ? "Les prochains mails ingérés apparaîtront ici si leur rattachement est ambigu."
              : "Modifie les filtres pour afficher d'autres mails."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredItems.map((item) => (
            <InboxItem
              key={item.id}
              item={item}
              isOpen={selectedId === item.id}
              onToggle={() => setSelectedId(selectedId === item.id ? null : item.id)}
              isChecked={checked.has(item.id)}
              onToggleCheck={() => toggleOne(item.id)}
              dealOptions={dealOptions}
              contactOptions={contactOptions}
              onChange={() => router.refresh()}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

interface FilterGroupProps<T extends string> {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

function FilterGroup<T extends string>({ label, value, onChange, options }: FilterGroupProps<T>) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "4px 10px", borderRadius: 4,
              background: value === opt.value ? "var(--su-500)" : "transparent",
              color: value === opt.value ? "#fff" : "var(--text)",
              border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "inherit",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface InboxItemProps {
  item: InboxReviewRow;
  isOpen: boolean;
  onToggle: () => void;
  isChecked: boolean;
  onToggleCheck: () => void;
  dealOptions: DealOption[];
  contactOptions: ContactOption[];
  onChange: () => void;
}

function InboxItem({ item, isOpen, onToggle, isChecked, onToggleCheck, dealOptions, contactOptions, onChange }: InboxItemProps) {
  const [pending, startTransition] = useTransition();
  const [dealQuery, setDealQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");

  const isInbound = item.email_direction !== "outbound";
  const Icon = isInbound ? Mail : Send;
  const directionLabel = isInbound ? "Reçu" : "Envoyé";
  const counterpart = isInbound
    ? item.email_from ?? "?"
    : (item.email_to ?? []).join(", ") || "?";

  const dealMatches = useMemo(() => {
    const q = dealQuery.trim().toLowerCase();
    if (!q) return dealOptions.slice(0, 8);
    return dealOptions
      .filter((d) => d.name.toLowerCase().includes(q) || d.deal_type.toLowerCase().includes(q))
      .slice(0, 8);
  }, [dealQuery, dealOptions]);

  const contactMatches = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contactOptions.slice(0, 8);
    return contactOptions
      .filter((c) => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
        const email = (c.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [contactQuery, contactOptions]);

  function doAssignDeal(dealId: string) {
    startTransition(async () => {
      const res = await assignReviewToDeal(item.id, dealId);
      if (res.success) onChange();
    });
  }
  function doAssignContact(contactId: string) {
    startTransition(async () => {
      const res = await assignReviewToContact(item.id, contactId);
      if (res.success) onChange();
    });
  }
  function doDismiss() {
    startTransition(async () => {
      const res = await dismissReview(item.id);
      if (res.success) onChange();
    });
  }
  function doCreateContact() {
    startTransition(async () => {
      const res = await createContactFromInboxEmail(item.id);
      if (res.success) onChange();
    });
  }

  const canCreateContact = item.contacts.length === 0 && (
    isInbound ? !!item.email_from : (item.email_to ?? []).length > 0
  );

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        transition: "border-color .12s",
        borderColor: isOpen ? "var(--su-400)" : "var(--border)",
      }}
    >
      {/* En-tête cliquable */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
          style={{
            background: "transparent", border: "none", padding: 4,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: 2, flexShrink: 0,
            color: isChecked ? "#E11D48" : "var(--muted)",
          }}
          title={isChecked ? "Désélectionner" : "Sélectionner"}
        >
          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: isInbound ? "rgba(37,99,235,.15)" : "rgba(15,118,110,.15)",
          border: `1px solid ${isInbound ? "rgba(37,99,235,.3)" : "rgba(15,118,110,.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={14} style={{ color: isInbound ? "#2563EB" : "#0F766E" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: isInbound ? "#2563EB" : "#0F766E", textTransform: "uppercase", letterSpacing: ".06em" }}>
              {directionLabel}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#E11D48", background: "rgba(225,29,72,.15)", padding: "1px 6px", borderRadius: 4 }}>
              {reasonLabel(item.review_reason)}
            </span>
            {item.classification_confidence != null && item.classification_source === "ai" && (
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                Confiance IA : {item.classification_confidence}%
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
              {formatDate(item.due_date)}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.email_subject || item.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isInbound ? "De " : "À "} <strong>{counterpart}</strong>
            {item.email_body_preview && (
              <span> · {item.email_body_preview.slice(0, 120)}{item.email_body_preview.length > 120 ? "…" : ""}</span>
            )}
          </div>
          {item.contacts.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              Contact lié :{" "}
              {item.contacts.map((c, i) => (
                <span key={c.id}>
                  {i > 0 ? ", " : ""}
                  {c.first_name} {c.last_name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Détail ouvert */}
      {isOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Rattacher dossier */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
              <Folder size={11} style={{ verticalAlign: "middle", marginRight: 4 }} /> Rattacher à un dossier
            </div>
            <input
              type="text"
              placeholder="Rechercher un dossier..."
              value={dealQuery}
              onChange={(e) => setDealQuery(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px",
                background: "var(--bg)", color: "var(--text)",
                border: "1px solid var(--border)", borderRadius: 6,
                fontSize: 12, fontFamily: "inherit",
              }}
            />
            <div style={{ marginTop: 6, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {dealMatches.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--muted)", padding: 8 }}>Aucun résultat</div>
              ) : (
                dealMatches.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => doAssignDeal(d.id)}
                    disabled={pending}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: 6,
                      background: "transparent", color: "var(--text)",
                      border: "1px solid var(--border)",
                      cursor: pending ? "wait" : "pointer",
                      fontSize: 12, fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>{d.deal_type}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Rattacher contact */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
              <UserPlus size={11} style={{ verticalAlign: "middle", marginRight: 4 }} /> Lier un contact
            </div>
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={contactQuery}
              onChange={(e) => setContactQuery(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px",
                background: "var(--bg)", color: "var(--text)",
                border: "1px solid var(--border)", borderRadius: 6,
                fontSize: 12, fontFamily: "inherit",
              }}
            />
            <div style={{ marginTop: 6, maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {contactMatches.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--muted)", padding: 8 }}>Aucun résultat</div>
              ) : (
                contactMatches.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => doAssignContact(c.id)}
                    disabled={pending}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: 6,
                      background: "transparent", color: "var(--text)",
                      border: "1px solid var(--border)",
                      cursor: pending ? "wait" : "pointer",
                      fontSize: 12, fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.first_name} {c.last_name}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>{c.email}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Actions globales */}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {canCreateContact && (
              <button
                onClick={doCreateContact}
                disabled={pending}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 12px", borderRadius: 6,
                  background: "rgba(126,87,194,.15)", color: "#7E57C2",
                  border: "1px solid rgba(126,87,194,.4)",
                  cursor: pending ? "wait" : "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                }}
                title="Créer un brouillon de contact depuis l'email et le lier à ce message"
              >
                <Sparkles size={12} /> Créer le contact depuis cet email
              </button>
            )}
            <button
              onClick={doDismiss}
              disabled={pending}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 6,
                background: "transparent", color: "var(--muted)",
                border: "1px solid var(--border)",
                cursor: pending ? "wait" : "pointer",
                fontSize: 12, fontFamily: "inherit",
              }}
              title="Marquer comme traité sans rattachement"
            >
              <X size={12} /> Ignorer
            </button>
            {(() => {
              const replyTo = isInbound
                ? item.email_from
                : (item.email_to && item.email_to.length > 0 ? item.email_to[0] : null);
              if (!replyTo) return null;
              const subj = item.email_subject ?? item.title ?? "";
              const reSubj = /^re:/i.test(subj) ? subj : `Re: ${subj}`;
              const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(replyTo)}&su=${encodeURIComponent(reSubj)}`;
              return (
                <a
                  href={composeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 6,
                    background: "rgba(52,104,176,.12)", color: "var(--su-500)",
                    border: "1px solid rgba(52,104,176,.3)",
                    fontSize: 12, fontWeight: 600, textDecoration: "none",
                  }}
                >
                  ↩ Répondre dans Gmail
                </a>
              );
            })()}
            {item.gmail_thread_id && (
              <a
                href={`https://mail.google.com/mail/u/0/#inbox/${item.gmail_thread_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 12px", borderRadius: 6,
                  background: "transparent", color: "var(--su-300)",
                  border: "1px solid var(--border)",
                  fontSize: 12, textDecoration: "none",
                }}
              >
                <Link2 size={12} /> Ouvrir dans Gmail
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
