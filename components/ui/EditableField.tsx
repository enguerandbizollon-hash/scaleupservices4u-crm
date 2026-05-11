"use client";

import { useEffect, useRef, useState } from "react";

type FieldType = "text" | "number" | "date";

export function EditableField({
  value,
  onSave,
  type = "text",
  placeholder = "Ajouter",
  formatter,
  selectOptions,
  textarea = false,
}: {
  value: string | number | null;
  onSave: (newValue: string | number | null) => Promise<void> | void;
  type?: FieldType;
  placeholder?: string;
  formatter?: (v: string | number | null) => string;
  selectOptions?: { value: string; label: string }[];
  textarea?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [editing]);

  // Sync external value changes when not editing
  useEffect(() => {
    if (!editing) setDraft(value == null ? "" : String(value));
  }, [value, editing]);

  function startEdit() {
    setDraft(value == null ? "" : String(value));
    setEditing(true);
  }

  async function commit() {
    if (saving) return;
    const trimmed = draft.trim();
    let val: string | number | null;
    if (trimmed === "") {
      val = null;
    } else if (type === "number") {
      const n = Number(trimmed.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) {
        setEditing(false);
        return;
      }
      val = n;
    } else {
      val = trimmed;
    }
    setSaving(true);
    try {
      await onSave(val);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function cancel() {
    setDraft(value == null ? "" : String(value));
    setEditing(false);
  }

  const baseInputStyle: React.CSSProperties = {
    padding: "5px 9px",
    border: "1px solid var(--accent, #1a56db)",
    borderRadius: 6,
    background: "var(--surface)",
    color: "var(--text-1)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    minWidth: 120,
  };

  if (editing) {
    const sharedProps = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: () => void commit(),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !textarea) { e.preventDefault(); void commit(); }
        else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      },
    };

    if (selectOptions) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <select
            ref={(el) => { inputRef.current = el; }}
            {...sharedProps}
            style={baseInputStyle}
          >
            <option value="">— Vide —</option>
            {selectOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {saving && <span style={{ fontSize: 11, color: "var(--text-5)" }}>…</span>}
        </span>
      );
    }

    if (textarea) {
      return (
        <span style={{ display: "block" }}>
          <textarea
            ref={(el) => { inputRef.current = el; }}
            {...sharedProps}
            rows={3}
            style={{ ...baseInputStyle, width: "100%", minHeight: 60, resize: "vertical" }}
          />
          <div style={{ fontSize: 10.5, color: "var(--text-5)", marginTop: 3 }}>Echap pour annuler.</div>
        </span>
      );
    }

    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <input
          ref={(el) => { inputRef.current = el; }}
          type={type === "date" ? "date" : "text"}
          inputMode={type === "number" ? "decimal" : undefined}
          {...sharedProps}
          placeholder={placeholder}
          style={baseInputStyle}
        />
        {saving && <span style={{ fontSize: 11, color: "var(--text-5)" }}>…</span>}
      </span>
    );
  }

  const display = formatter
    ? formatter(value)
    : (value == null || value === "" ? "" : String(value));
  const isEmpty = value == null || value === "";

  return (
    <button
      type="button"
      onClick={startEdit}
      style={{
        background: "none",
        border: "1px dashed transparent",
        padding: "2px 5px",
        margin: "-2px -5px",
        cursor: "pointer",
        fontSize: 13,
        color: isEmpty ? "var(--text-5)" : "var(--text-1)",
        fontFamily: "inherit",
        fontStyle: isEmpty ? "italic" : "normal",
        textAlign: "left",
        borderRadius: 5,
        transition: "background .1s, border-color .1s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = "var(--surface-2)";
        el.style.borderColor = "var(--border)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "transparent";
        el.style.borderColor = "transparent";
      }}
      title="Cliquer pour modifier"
    >
      {isEmpty ? placeholder : display}
    </button>
  );
}
