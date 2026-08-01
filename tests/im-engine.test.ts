import { describe, it, expect } from "vitest";
import { buildIMPrompt, validateIMContent, type IMInput } from "@/lib/ai/im-engine";

const baseInput: IMInput = {
  company_name: "SCIERIE MARTIN",
  siren: "123456789",
  ville: "Oyonnax",
  sector: "Bois & Ameublement",
  description: "Scierie familiale",
  executive_summary: "Scierie rentable, position locale forte",
  motivation_narrative: "Départ en retraite du dirigeant",
  competitive_landscape: "Deux concurrents régionaux",
  market_context: "Marché du bois de construction porteur",
  key_differentiators: ["Parc machines récent"],
  key_risks: ["Dépendance au dirigeant"],
  deal_context: "succession",
  partial_sale_ok: false,
  management_retention: true,
  dirigeant_nom: "Jean Martin",
  dirigeant_titre: "Gérant",
  finances: [
    { fiscal_year: 2025, revenue: 2_400_000, ebitda: 380_000, net_income: 210_000, headcount: 14, is_forecast: false },
    { fiscal_year: 2026, revenue: 2_600_000, ebitda: 410_000, net_income: null, headcount: null, is_forecast: true },
  ],
  synthese_fiche: null,
};

describe("buildIMPrompt", () => {
  it("l'IM est nominatif : le nom et le SIREN figurent dans le prompt", () => {
    const p = buildIMPrompt(baseInput);
    expect(p).toContain("SCIERIE MARTIN");
    expect(p).toContain("SIREN 123456789");
    expect(p).toContain("Jean Martin");
  });

  it("sépare exercices réels et projections, et marque les projections", () => {
    const p = buildIMPrompt(baseInput);
    expect(p).toContain("Exercices réels :");
    expect(p).toContain("2025 : CA 2,4 M EUR");
    expect(p).toContain("Projections (à présenter comme telles) :");
    expect(p).toContain("2026 (projection) : CA 2,6 M EUR");
  });

  it("les données absentes s'omettent au lieu de s'inventer", () => {
    const p = buildIMPrompt({ ...baseInput, market_context: null, key_risks: null, finances: [] });
    expect(p).not.toContain("Contexte de marché");
    expect(p).not.toContain("Risques identifiés");
    expect(p).toContain("Exercices réels : non disponibles");
  });
});

describe("validateIMContent", () => {
  const valid = {
    titre: "Information Memorandum : SCIERIE MARTIN",
    resume: "Résumé",
    societe_historique: "Historique",
    activite_modele: "Activité",
    marche_position: "Marché",
    chiffres_cles: [{ label: "CA 2025", valeur: "2,4 M EUR" }],
    finances_commentees: "Lecture des comptes",
    management_organisation: "Équipe",
    forces: ["Parc machines récent"],
    points_attention: ["Dépendance au dirigeant"],
    operation_envisagee: "Cession totale",
  };

  it("accepte un contenu complet", () => {
    expect(validateIMContent(valid)).not.toBeNull();
  });

  it("refuse un contenu sans chiffres clés ou sans forces", () => {
    expect(validateIMContent({ ...valid, chiffres_cles: [] })).toBeNull();
    expect(validateIMContent({ ...valid, forces: [] })).toBeNull();
  });

  it("refuse un champ narratif vide", () => {
    expect(validateIMContent({ ...valid, resume: " " })).toBeNull();
    expect(validateIMContent(null)).toBeNull();
  });
});
