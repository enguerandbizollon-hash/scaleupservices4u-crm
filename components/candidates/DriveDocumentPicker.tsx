"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addCandidateDocumentAction } from "@/actions/candidates";

const DOC_TYPES = [
  { value: "cv",           label: "CV" },
  { value: "cover_letter", label: "Lettre de motivation" },
  { value: "portfolio",    label: "Portfolio" },
  { value: "reference",    label: "Référence" },
  { value: "other",        label: "Autre" },
];

declare global {
  interface Window {
    gapi: {
      load: (lib: string, cb: () => void) => void;
      client?: unknown;
    };
    google: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        Action: { PICKED: string; CANCEL: string };
        ViewId: { DOCS: string };
        Feature: { NAV_HIDDEN: string; MULTISELECT_ENABLED: string };
        DocsView: new (viewId: string) => { setIncludeFolders: (v: boolean) => unknown };
      };
    };
  }
}

interface GooglePickerBuilder {
  addView: (view: unknown) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setCallback: (cb: (data: GooglePickerResult) => void) => GooglePickerBuilder;
  enableFeature: (feature: string) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
}

interface GooglePickerResult {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    mimeType: string;
    url: string;
  }>;
}

interface Props {
  candidateId: string;
}

export function DriveDocumentPicker({ candidateId }: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [docType, setDocType]   = useState("cv");
  const [error, setError]       = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  const loadScript = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }, []);

  async function openPicker() {
    if (!apiKey) {
      setError("NEXT_PUBLIC_GOOGLE_API_KEY non configurée");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Obtenir le token
      const tokenRes = await fetch("/api/gdrive/token");
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        setError(tokenData.error ?? "Impossible d'obtenir le token Google. Reconnectez votre compte.");
        setLoading(false);
        return;
      }
      const accessToken: string = tokenData.access_token;

      // 2. Charger les scripts Google
      await loadScript("https://apis.google.com/js/api.js");
      await new Promise<void>(resolve => window.gapi.load("picker", resolve));
      await loadScript("https://accounts.google.com/gsi/client");

      // 3. Ouvrir le picker
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setIncludeFolders(false);

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setTitle("Choisir un document Google Drive")
        .setCallback(async (data: GooglePickerResult) => {
          if (data.action === window.google.picker.Action.PICKED && data.docs?.length) {
            const file = data.docs[0];
            setLoading(true);

            const fd = new FormData();
            fd.append("candidate_id",  candidateId);
            fd.append("drive_file_id", file.id);
            fd.append("file_name",     file.name);
            fd.append("file_url",      file.url);
            fd.append("mime_type",     file.mimeType);
            fd.append("document_type", docType);

            try {
              await addCandidateDocumentAction(fd);
              router.refresh();
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur lors de l'ajout");
            }
            setLoading(false);
          }
        })
        .build();

      picker.setVisible(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setLoading(false);
  }

  const inp = "padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:13px;font-family:inherit;background:var(--surface);color:var(--text-1);outline:none;width:100%";

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 7, border: "1px dashed var(--border)", background: "var(--surface)", color: "var(--text-3)", cursor: "pointer", fontFamily: "inherit" }}
        >
          + Ajouter depuis Google Drive
        </button>
      ) : (
        <div style={{ padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface-2)", marginTop: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)", marginBottom: 10 }}>Ajouter un document</div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text-4)", marginBottom: 4, textTransform: "uppercase" }}>Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} style={{ cssText: inp } as React.CSSProperties}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#991B1B", background: "#FEE2E2", padding: "6px 10px", borderRadius: 6, marginBottom: 10 }}>
              {error}
              {error.includes("Reconnectez") && (
                <a href="/api/gcal" style={{ color: "#991B1B", fontWeight: 700, marginLeft: 8 }}>→ Connecter Google</a>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={openPicker}
              disabled={loading}
              style={{ flex: 1, padding: "7px 14px", borderRadius: 7, background: "#1a56db", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? .6 : 1 }}
            >
              {loading ? "Chargement…" : "Choisir dans Drive"}
            </button>
            <button
              onClick={() => { setOpen(false); setError(null); }}
              style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
