// Famille BODACC « Modifications diverses » (absorption routine Vectis,
// 2026-07-31) : classification par descriptif vérifiée sur les formulations
// réelles de l'API (échantillonnées en live le jour de l'implémentation).

import { describe, it, expect } from "vitest";
import { classifyModification, normalizeAnnonce, MODIFICATIONS_FAMILLE } from "@/lib/connectors/bodacc";
import { computeCedabilite } from "@/lib/crm/cedabilite";

describe("classifyModification", () => {
  it("fusion : « Sociétés ayant participé à l'opération de fusion »", () => {
    expect(classifyModification("Modification du capital. Sociétés ayant participé à l'opération de fusion : X RCS B 123.")).toBe("fusion_absorption");
  });

  it("TUP : « transmission universelle du patrimoine »", () => {
    expect(classifyModification("transmission universelle du patrimoine.")).toBe("fusion_absorption");
  });

  it("« diffusion » ne déclenche PAS fusion (frontière de mot)", () => {
    expect(classifyModification("Modification survenue sur l'activité de diffusion audiovisuelle.")).toBeNull();
  });

  it("location-gérance : « établissement principal donné en location-gérance »", () => {
    expect(classifyModification("établissement principal donné en location-gérance.")).toBe("location_gerance");
  });

  it("administration : « Modification survenue sur l'administration »", () => {
    expect(classifyModification("Modification survenue sur l'administration, la dénomination.")).toBe("changement_dirigeant");
  });

  it("modification banale (capital, activité) : aucun signal", () => {
    expect(classifyModification("Modification survenue sur le capital.")).toBeNull();
    expect(classifyModification("Modification survenue sur l'activité.")).toBeNull();
    expect(classifyModification(null)).toBeNull();
  });
});

describe("normalizeAnnonce sur Modifications diverses", () => {
  const base = {
    id: "A123",
    dateparution: "2026-07-30",
    familleavis_lib: MODIFICATIONS_FAMILLE,
    commercant: "SCIERIE TEST",
    registre: ["123456789", "123 456 789"],
    ville: "Lyon",
  };

  it("une TUP devient un signal fusion_absorption, sévérité opportunité", () => {
    const s = normalizeAnnonce({ ...base, modificationsgenerales: '{"descriptif": "transmission universelle du patrimoine."}' });
    expect(s?.signal_type).toBe("fusion_absorption");
    expect(s?.severity).toBe("opportunite");
    expect(s?.titre).toContain("Fusion / absorption : SCIERIE TEST");
  });

  it("une modification banale est ignorée (null)", () => {
    const s = normalizeAnnonce({ ...base, modificationsgenerales: '{"descriptif": "Modification survenue sur le capital."}' });
    expect(s).toBeNull();
  });
});

describe("computeCedabilite : barème routine (signaux + capital concentré)", () => {
  const fiche = {
    age_dirigeant_principal: 67,
    date_creation: "1990-01-01",
    finances: { "2024": { ca: 2_000_000, resultat_net: 200_000 } },
  };

  it("location-gérance ajoute +8 avec sa raison", () => {
    const sans = computeCedabilite(fiche, { types: [] });
    const avec = computeCedabilite(fiche, { types: ["location_gerance"] });
    expect(avec.score - sans.score).toBe(8);
    expect(avec.raisons.some(r => r.includes("location-gérance"))).toBe(true);
  });

  it("changement de dirigeant ajoute +4", () => {
    const sans = computeCedabilite(fiche, { types: [] });
    const avec = computeCedabilite(fiche, { types: ["changement_dirigeant"] });
    expect(avec.score - sans.score).toBe(4);
  });

  it("capital concentré (2 personnes physiques ≥ 80 %) ajoute +5", () => {
    const sans = computeCedabilite(fiche, { types: [] });
    const avec = computeCedabilite(
      { ...fiche, actionnariat: [
        { type: "physique", pourcentage_parts: 60 },
        { type: "physique", pourcentage_parts: 30 },
      ] },
      { types: [] },
    );
    expect(avec.score - sans.score).toBe(5);
    expect(avec.raisons.some(r => r.includes("capital concentré"))).toBe(true);
  });

  it("capital dispersé ou porté par des personnes morales : pas de bonus", () => {
    const sans = computeCedabilite(fiche, { types: [] });
    const disperse = computeCedabilite(
      { ...fiche, actionnariat: [
        { type: "physique", pourcentage_parts: 40 },
        { type: "physique", pourcentage_parts: 20 },
        { type: "physique", pourcentage_parts: 20 },
      ] },
      { types: [] },
    );
    const morale = computeCedabilite(
      { ...fiche, actionnariat: [{ type: "morale", pourcentage_parts: 95 }] },
      { types: [] },
    );
    expect(disperse.score).toBe(sans.score);
    expect(morale.score).toBe(sans.score);
  });

  it("le score reste plafonné à 100 même signaux cumulés", () => {
    const r = computeCedabilite(
      { ...fiche, actionnariat: [{ type: "physique", pourcentage_parts: 100 }] },
      { types: ["location_gerance", "changement_dirigeant", "depot_comptes"] },
    );
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
