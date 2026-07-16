"use client";
// Bloc d'édition de l'adresse structurée d'une organisation, avec géocodage
// via Nominatim. À placer dans la fiche organisation. Foundation pour le
// sourcing/screening géographique M&A.

import { useState, useTransition } from "react";
import { MapPin, Loader2, Check } from "lucide-react";
import {
  updateOrganisationAddress,
  geocodeOrganisationAction,
} from "@/actions/organisation-address";

interface Props {
  organisationId: string;
  initial: {
    street: string | null;
    postal_code: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    address_formatted: string | null;
    geocoded_at: string | null;
  };
}

export function OrganisationAddressBlock({ organisationId, initial }: Props) {
  const [street, setStreet] = useState(initial.street ?? "");
  const [postal, setPostal] = useState(initial.postal_code ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [region, setRegion] = useState(initial.region ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [lat, setLat] = useState(initial.latitude);
  const [lng, setLng] = useState(initial.longitude);
  const [formatted, setFormatted] = useState(initial.address_formatted ?? "");
  const [geocodedAt, setGeocodedAt] = useState(initial.geocoded_at);
  const [saving, setSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function persist(geocode: boolean) {
    setError(null);
    setSaving(async () => {
      const res = await updateOrganisationAddress(
        organisationId,
        { street, postal_code: postal, city, region, country },
        geocode,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.geocoded && res.latitude && res.longitude) {
        setLat(res.latitude);
        setLng(res.longitude);
        setGeocodedAt(new Date().toISOString());
      }
      setSavedAt(Date.now());
    });
  }

  async function geocodeOnly() {
    setError(null);
    setSaving(async () => {
      const res = await geocodeOrganisationAction(organisationId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.latitude && res.longitude) {
        setLat(res.latitude);
        setLng(res.longitude);
        setGeocodedAt(new Date().toISOString());
        setSavedAt(Date.now());
      }
    });
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
    } catch { return null; }
  };

  const showSaved = savedAt && Date.now() - savedAt < 3000;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 7,
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "var(--surface)",
    color: "var(--text-1)", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--text-4)",
    textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4,
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={15} color="var(--text-3)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>Adresse</span>
          {lat != null && lng != null && (
            <span style={{ fontSize: 11, color: "#065F46", fontWeight: 600, padding: "2px 7px", background: "#D1FAE5", borderRadius: 12 }}>
              Géocodé
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {showSaved && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#065F46", fontWeight: 600 }}><Check size={11}/>Enregistré</span>}
          {error && <span style={{ fontSize: 11, color: "#991B1B", fontWeight: 600 }}>{error}</span>}
          <button
            onClick={() => persist(true)}
            disabled={saving}
            style={{
              padding: "6px 12px", borderRadius: 7, background: "#1a56db", color: "#fff",
              border: "none", fontSize: 12, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {saving ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }}/> : <MapPin size={11}/>}
            Enregistrer & géocoder
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Rue (numéro + voie)</label>
          <input style={inputStyle} value={street} onChange={e => setStreet(e.target.value)} placeholder="12 rue de la Paix" />
        </div>
        <div>
          <label style={labelStyle}>Code postal</label>
          <input style={inputStyle} value={postal} onChange={e => setPostal(e.target.value)} placeholder="75002" />
        </div>
        <div>
          <label style={labelStyle}>Ville</label>
          <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="Paris" />
        </div>
        <div>
          <label style={labelStyle}>Région</label>
          <input style={inputStyle} value={region} onChange={e => setRegion(e.target.value)} placeholder="Île-de-France" />
        </div>
        <div>
          <label style={labelStyle}>Pays</label>
          <input style={inputStyle} value={country} onChange={e => setCountry(e.target.value)} placeholder="France" />
        </div>
      </div>

      {formatted && (
        <div style={{ fontSize: 11.5, color: "var(--text-5)", padding: "6px 10px", background: "var(--surface-2)", borderRadius: 6, marginBottom: 8 }}>
          {formatted}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 11, color: "var(--text-5)" }}>
          {lat != null && lng != null
            ? `GPS : ${lat.toFixed(5)}, ${lng.toFixed(5)}${geocodedAt ? ` · géocodé le ${fmtDate(geocodedAt)}` : ""}`
            : "Pas encore géocodé — saisir au moins ville + pays puis Enregistrer & géocoder"}
        </div>
        {lat == null && (street || city) && (
          <button
            onClick={geocodeOnly}
            disabled={saving}
            style={{
              padding: "4px 10px", borderRadius: 6, background: "transparent",
              color: "#1a56db", border: "1px solid #BFDBFE", fontSize: 11.5,
              fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
            }}
          >
            Géocoder cette adresse
          </button>
        )}
      </div>
    </div>
  );
}
