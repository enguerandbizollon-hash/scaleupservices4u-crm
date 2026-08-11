import { describe, it, expect } from "vitest";
import { deriveChasseFiltersFromDeal, nafCodesForSector } from "@/lib/crm/buy-criteria-sync";
import type { CadrageContent } from "@/lib/ai/cadrage-engine";
import { validateCadrageContent } from "@/lib/ai/cadrage-engine";

const CADRAGE: CadrageContent = validateCadrageContent({
  naf_codes: ["62.02A", "70.21Z"],
  confidence: 80,
});

const DEAL = {
  target_sectors: ["Éditeurs de logiciels / SaaS"],
  target_geographies: ["38", "69", "auvergne_rhone_alpes"],
  target_revenue_min: 500_000,
  target_revenue_max: 1_500_000,
};

describe("deriveChasseFiltersFromDeal", () => {
  it("le dossier fait foi : CA et géographie écrasent la chasse", () => {
    const f = deriveChasseFiltersFromDeal(DEAL, null, {
      ca_min: 1, ca_max: 2, departements: ["75"], regions: ["bretagne"], actives_seulement: true,
    });
    expect(f.ca_min).toBe(500_000);
    expect(f.ca_max).toBe(1_500_000);
    expect(f.departements).toEqual(["38", "69"]);
    expect(f.regions).toEqual(["auvergne_rhone_alpes"]);
  });

  it("préserve les affinages propres à la chasse (âge, effectifs, catégorie)", () => {
    const f = deriveChasseFiltersFromDeal(DEAL, null, {
      age_dirigeant_min: 58, age_dirigeant_max: 72,
      effectif_tranches: ["02", "03"], categorie: "PME",
      resultat_net_min: 0, actives_seulement: false,
    });
    expect(f.age_dirigeant_min).toBe(58);
    expect(f.age_dirigeant_max).toBe(72);
    expect(f.effectif_tranches).toEqual(["02", "03"]);
    expect(f.categorie).toBe("PME");
    expect(f.resultat_net_min).toBe(0);
    expect(f.actives_seulement).toBe(false);
  });

  it("NAF : précision du cadrage plus couverture des secteurs du référentiel", () => {
    const f = deriveChasseFiltersFromDeal(DEAL, CADRAGE, null);
    expect(f.naf).toContain("62.02A");
    expect(f.naf).toContain("70.21Z");
    // Le secteur SaaS (famille Numérique & Tech) étend la couverture NAF.
    const derived = nafCodesForSector("Éditeurs de logiciels / SaaS");
    expect(derived.length).toBeGreaterThan(0);
    for (const code of derived) expect(f.naf).toContain(code);
  });

  it("un secteur libre hors référentiel ne produit aucun NAF (le cadrage couvre)", () => {
    expect(nafCodesForSector("Agence digitale")).toEqual([]);
    const f = deriveChasseFiltersFromDeal(
      { ...DEAL, target_sectors: ["Agence digitale"] },
      CADRAGE,
      null,
    );
    expect(f.naf).toEqual(["62.02A", "70.21Z"]);
  });

  it("france seule = aucun filtre géographique ; dossier vide = pas de clés", () => {
    const f = deriveChasseFiltersFromDeal(
      { target_sectors: null, target_geographies: ["france"], target_revenue_min: null, target_revenue_max: null },
      null,
      null,
    );
    expect(f.departements).toBeUndefined();
    expect(f.regions).toBeUndefined();
    expect(f.ca_min).toBeUndefined();
    expect(f.naf).toBeUndefined();
    expect(f.actives_seulement).toBe(true);
  });
});
