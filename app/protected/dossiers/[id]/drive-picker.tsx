"use client";

import { useState } from "react";
import { HardDrive, Loader2, ExternalLink } from "lucide-react";

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export function DrivePicker({ onSelect }: { onSelect: (url: string, name: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPicker() {
    setLoading(true);
    setError("");
    try {
      // Récupérer le token Google
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const token = session?.access_token;

      if (!token) {
        setError("Connecte-toi à Google d'abord (menu Connecteurs).");
        setLoading(false);
        return;
      }

      // Charger le script Google Picker si pas déjà chargé
      await new Promise<void>((resolve, reject) => {
        if (window.gapi?.picker) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://apis.google.com/js/api.js";
        s.onload = () => window.gapi.load("picker", () => resolve());
        s.onerror = reject;
        document.body.appendChild(s);
      });

      const picker = new window.gapi.picker.PickerBuilder()
        .addView(window.gapi.picker.ViewId.DOCS)
        .setOAuthToken(token)
        .setCallback((data: any) => {
          if (data.action === "picked") {
            const doc = data.docs[0];
            onSelect(doc.url, doc.name);
          }
          setLoading(false);
        })
        .build();
      picker.setVisible(true);
    } catch (e: any) {
      setError("Erreur lors de l'ouverture de Drive.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={openPicker} disabled={loading}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--su-50)", color: "var(--su-700)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        {loading ? <Loader2 size={13} className="animate-spin" /> : <HardDrive size={13} />}
        {loading ? "Ouverture…" : "Choisir depuis Drive"}
      </button>
      {error && <p style={{ fontSize: 11, color: "var(--deal-recruitment-text)", marginTop: 6 }}>{error}</p>}
    </div>
  );
}
