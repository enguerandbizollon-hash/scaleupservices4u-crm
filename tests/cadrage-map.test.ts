import { describe, it, expect } from "vitest";
import { validateCadrageContent, type CadrageContent } from "@/lib/ai/cadrage-engine";
import { cadrageToChasseFilters, cadrageToDealPatch, cadrageChasseName } from "@/lib/crm/cadrage-map";

// Fiche de cadrage type ROUSSON (buy-side) une fois extraite par l'IA.
const ROUSSON: CadrageContent = {
  repreneur_nom: "Damien ROUSSON",
  projet: "Reprendre et développer une PME dans le service ou l'industrie.",
  secteurs: ["Agence digitale", "Déménagement", "Génie climatique"],
  naf_codes: ["62.02A", "70.21Z", "49.42Z", "25.72Z", "43.22B"],
  ca_min: 500_000,
  ca_max: 1_500_000,
  effectif_min: 3,
  effectif_max: 10,
  departements: ["38", "69"],
  regions: [],
  dirigeant_age_min: null,
  dirigeant_age_max: null,
  full_acquisition: true,
  management_retention: true,
  apport: 300_000,
  confidence: 82,
};

describe("validateCadrageContent", () => {
  it("normalise les nombres, déduplique et met les NAF en majuscules", () => {
    const c = validateCadrageContent({
      secteurs: ["Agence digitale", "Agence digitale", "  "],
      naf_codes: ["62.02a", "62.02A", " 43.22b "],
      ca_min: 500000,
      ca_max: 1500000,
      confidence: 82,
      dirigeant_age_min: 58.6,
      full_acquisition: true,
    });
    expect(c.secteurs).toEqual(["Agence digitale"]);
    expect(c.naf_codes).toEqual(["62.02A", "43.22B"]);
    expect(c.ca_min).toBe(500000);
    expect(c.ca_max).toBe(1500000);
    expect(c.dirigeant_age_min).toBe(59); // int arrondi (58.6 -> 59)
    expect(c.full_acquisition).toBe(true);
    expect(c.regions).toEqual([]);
  });

  it("borne la confiance et laisse les champs absents à null / vide", () => {
    const c = validateCadrageContent({ confidence: 250 });
    expect(c.confidence).toBe(100);
    expect(c.secteurs).toEqual([]);
    expect(c.naf_codes).toEqual([]);
    expect(c.ca_min).toBeNull();
    expect(c.full_acquisition).toBeNull();
    expect(c.repreneur_nom).toBeNull();
  });

  it("plancher la confiance à 0 si absente ou non numérique", () => {
    expect(validateCadrageContent({}).confidence).toBe(0);
    expect(validateCadrageContent({ confidence: -5 }).confidence).toBe(0);
  });
});

describe("cadrageToChasseFilters", () => {
  it("dérive les filtres de chasse de la fiche ROUSSON", () => {
    const f = cadrageToChasseFilters(ROUSSON);
    expect(f.naf).toEqual(["62.02A", "70.21Z", "49.42Z", "25.72Z", "43.22B"]);
    expect(f.ca_min).toBe(500_000);
    expect(f.ca_max).toBe(1_500_000);
    expect(f.departements).toEqual(["38", "69"]);
    expect(f.actives_seulement).toBe(true);
    // Pas d'âge dans cette fiche : les clés ne sont pas posées.
    expect(f.age_dirigeant_min).toBeUndefined();
    expect(f.age_dirigeant_max).toBeUndefined();
  });

  it("pose les bornes d'âge quand la fiche les donne", () => {
    const f = cadrageToChasseFilters({ ...ROUSSON, dirigeant_age_min: 58, dirigeant_age_max: 72 });
    expect(f.age_dirigeant_min).toBe(58);
    expect(f.age_dirigeant_max).toBe(72);
  });

  it("n'ajoute pas de clés vides (fiche minimale)", () => {
    const f = cadrageToChasseFilters(validateCadrageContent({ confidence: 40 }));
    expect(f).toEqual({ actives_seulement: true });
  });
});

describe("cadrageToDealPatch", () => {
  it("ne renseigne que les critères présents", () => {
    const p = cadrageToDealPatch(ROUSSON);
    expect(p.target_sectors).toEqual(["Agence digitale", "Déménagement", "Génie climatique"]);
    expect(p.target_geographies).toEqual(["38", "69"]);
    expect(p.target_revenue_min).toBe(500_000);
    expect(p.target_revenue_max).toBe(1_500_000);
    expect(p.full_acquisition_required).toBe(true);
    expect(p.management_retention).toBe(true);
    expect(p.acquisition_budget_min).toBe(300_000);
    expect(p.strategic_rationale).toContain("Reprendre");
  });

  it("un patch vide pour une fiche sans critère (n'écrase rien)", () => {
    const p = cadrageToDealPatch(validateCadrageContent({ confidence: 10 }));
    expect(Object.keys(p)).toHaveLength(0);
  });

  it("fusionne départements et régions dans target_geographies", () => {
    const p = cadrageToDealPatch({ ...ROUSSON, regions: ["Auvergne-Rhône-Alpes"] });
    expect(p.target_geographies).toEqual(["38", "69", "Auvergne-Rhône-Alpes"]);
  });
});

describe("cadrageChasseName", () => {
  it("nomme d'après le repreneur", () => {
    expect(cadrageChasseName(ROUSSON, "Mandat X")).toBe("Cibles pour Damien ROUSSON");
  });
  it("retombe sur le nom du mandat sans repreneur", () => {
    expect(cadrageChasseName({ ...ROUSSON, repreneur_nom: null }, "Mandat X")).toBe("Cibles : Mandat X");
  });
});
