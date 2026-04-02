"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAllTags, getTagsForObject, addTagToObject, removeTagFromObject, createAndAttachTag,
  type Tag, type ObjectType,
} from "@/actions/tags";
import { X, Plus } from "lucide-react";

// ── TagBadge ───────────────────────────────────────────────────────────────────

function TagBadge({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px 2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
      background: tag.color + "22",
      border: `1px solid ${tag.color}66`,
      color: tag.color,
    }}>
      {tag.name}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 0, display: "flex", alignItems: "center", color: "inherit", opacity: 0.7,
          }}
          title="Retirer le tag"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

// ── TagInput ───────────────────────────────────────────────────────────────────

interface TagInputProps {
  objectType: ObjectType;
  objectId:   string;
  /** Couleur par défaut des nouveaux tags. Si non fournie → #6B7280 */
  defaultColor?: string;
}

export function TagInput({ objectType, objectId, defaultColor = "#6B7280" }: TagInputProps) {
  const [objectTags, setObjectTags] = useState<Tag[]>([]);
  const [allTags,    setAllTags]    = useState<Tag[]>([]);
  const [query,      setQuery]      = useState("");
  const [open,       setOpen]       = useState(false);
  const [loading,    setLoading]    = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const [attached, all] = await Promise.all([
      getTagsForObject(objectType, objectId),
      getAllTags(),
    ]);
    setObjectTags(attached);
    setAllTags(all);
  }, [objectType, objectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fermer dropdown si clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const attachedIds = new Set(objectTags.map(t => t.id));

  // Suggestions : tags existants non encore attachés, filtrés par query
  const suggestions = allTags.filter(t =>
    !attachedIds.has(t.id) &&
    (query.trim().length === 0 || t.name.toLowerCase().includes(query.toLowerCase()))
  );

  // Est-ce qu'il faut proposer "Créer ce tag" ?
  const canCreate = query.trim().length >= 1 &&
    !allTags.some(t => t.name.toLowerCase() === query.toLowerCase());

  async function handleAttach(tagId: string) {
    setLoading(true);
    const r = await addTagToObject(tagId, objectType, objectId);
    if (r.success) {
      const tag = allTags.find(t => t.id === tagId);
      if (tag) setObjectTags(p => [...p, tag]);
    }
    setQuery("");
    setOpen(false);
    setLoading(false);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setLoading(true);
    const r = await createAndAttachTag(
      { name, color: defaultColor },
      objectType,
      objectId,
    );
    if (r.success) {
      await loadData(); // reload to get the new tag with its generated id
    }
    setQuery("");
    setOpen(false);
    setLoading(false);
  }

  async function handleRemove(tagId: string) {
    setLoading(true);
    const r = await removeTagFromObject(tagId, objectType, objectId);
    if (r.success) setObjectTags(p => p.filter(t => t.id !== tagId));
    setLoading(false);
  }

  const inp: React.CSSProperties = {
    padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface-2)", color: "var(--text-1)", fontSize: 13,
    fontFamily: "inherit", outline: "none", width: 140,
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Tags attachés */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", minHeight: 28 }}>
        {objectTags.map(t => (
          <TagBadge key={t.id} tag={t} onRemove={() => handleRemove(t.id)} />
        ))}

        {/* Bouton ajouter */}
        <button
          onClick={() => setOpen(p => !p)}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 500,
            background: "var(--surface-2)", border: "1px dashed var(--border)",
            color: "var(--text-4)", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Plus size={11} /> Tag
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
          background: "var(--surface)", border: "1px solid var(--border-2)",
          borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          padding: 8, minWidth: 220, maxWidth: 280,
        }}>
          <input
            autoFocus
            style={{ ...inp, width: "100%", marginBottom: 6, boxSizing: "border-box" }}
            placeholder="Rechercher ou créer…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && canCreate) handleCreate();
              if (e.key === "Escape") setOpen(false);
            }}
          />

          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {suggestions.length === 0 && !canCreate && (
              <div style={{ fontSize: 12, color: "var(--text-5)", padding: "4px 6px" }}>
                {query.trim() ? "Aucun tag trouvé" : "Pas d'autres tags disponibles"}
              </div>
            )}

            {suggestions.map(t => (
              <button
                key={t.id}
                onClick={() => handleAttach(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, width: "100%",
                  padding: "5px 6px", background: "none", border: "none",
                  cursor: "pointer", borderRadius: 6, textAlign: "left",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: t.color, flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, color: "var(--text-1)" }}>{t.name}</span>
                {t.category !== "autre" && (
                  <span style={{ fontSize: 11, color: "var(--text-5)", marginLeft: "auto" }}>{t.category}</span>
                )}
              </button>
            ))}

            {canCreate && (
              <button
                onClick={handleCreate}
                style={{
                  display: "flex", alignItems: "center", gap: 6, width: "100%",
                  padding: "5px 6px", background: "none", border: "none",
                  cursor: "pointer", borderRadius: 6, textAlign: "left",
                  fontFamily: "inherit", borderTop: suggestions.length > 0 ? "1px solid var(--border)" : "none",
                  marginTop: suggestions.length > 0 ? 4 : 0, paddingTop: suggestions.length > 0 ? 9 : 5,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <Plus size={12} color="var(--text-3)" />
                <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                  Créer <strong>"{query.trim()}"</strong>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
