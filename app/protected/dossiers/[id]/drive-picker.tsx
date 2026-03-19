"use client";

import { useState } from "react";
import { HardDrive, Loader2 } from "lucide-react";

declare global {
  interface Window { gapi?: any; google?: any; }
}

export function DrivePicker({ onSelect }: { onSelect: (url: string, name: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPicker() {
    setLoading(true);
    setError("");
    try {
      // Récupérer le token Google depuis la session NextAuth
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const token = session?.access_token;

      if (!token) {
        setError("Connecte-toi à Google dans le menu Connecteurs.");
        setLoading(false);
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setError("NEXT_PUBLIC_GOOGLE_CLIENT_ID manquant dans .env.local");
        setLoading(false);
        return;
      }

      // Charger l'API Google Picker
      await new Promise<void>((resolve, reject) => {
        if (window.gapi?.picker) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://apis.google.com/js/api.js";
        s.onload = () => {
          window.gapi!.load("picker", { callback: resolve });
        };
        s.onerror = () => reject(new Error("Impossible de charger l'API Google"));
        document.head.appendChild(s);
      });

      const picker = new window.gapi.picker.PickerBuilder()
        .addView(window.gapi.picker.ViewId.DOCS)
        .addView(window.gapi.picker.ViewId.SPREADSHEETS)
        .addView(window.gapi.picker.ViewId.PRESENTATIONS)
        .addView(window.gapi.picker.ViewId.PDFS)
        .setOAuthToken(token)
        .setDeveloperKey(clientId)
        .setCallback((data: any) => {
          if (data.action === window.gapi.picker.Action.PICKED) {
            const doc = data.docs[0];
            const url = doc.url ?? `https://drive.google.com/file/d/${doc.id}/view`;
            onSelect(url, doc.name);
            setLoading(false);
          } else if (data.action === window.gapi.picker.Action.CANCEL) {
            setLoading(false);
          }
        })
        .build();

      picker.setVisible(true);
    } catch (e: any) {
      setError(e.message ?? "Erreur Drive Picker");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPicker}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 9,
          border: "1px solid var(--border)",
          background: "var(--su-50)", color: "var(--su-700)",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}
      >
        {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <HardDrive size={13} />}
        {loading ? "Ouverture Drive…" : "Choisir depuis Drive"}
      </button>
      {error && (
        <p style={{ fontSize: 11, color: "var(--deal-recruitment-text)", marginTop: 5 }}>{error}</p>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
