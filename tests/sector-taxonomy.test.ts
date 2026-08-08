// Tests unitaires de la taxonomie sectorielle (lib/crm/matching-maps.ts).
// Réforme small cap FR 2026-08 : le NAF classe à la FAMILLE (grossier), la
// sélection manuelle utilise les feuilles ; la compatibilité de scoring passe
// par la famille.

import { describe, it, expect } from "vitest";
import {
  SECTORS,
  SECTOR_GROUPS,
  SECTOR_FAMILIES,
  SECTOR_TO_FAMILY,
  NAF_DIVISION_TO_SECTOR,
  sectorFromNaf,
  sectorsCompatible,
  sectorsAreAdjacent,
  normalizeDealSector,
  DEAL_SECTOR_NORMALIZATION,
} from "@/lib/crm/matching-maps";

const SECTOR_SET = new Set<string>(SECTORS as readonly string[]);

describe("sectorFromNaf — formats de code acceptés", () => {
  it("accepte la sous-classe, la forme compacte, la classe et la division", () => {
    expect(sectorFromNaf("43.21A")).toBe("BTP & Construction");
    expect(sectorFromNaf("4321A")).toBe("BTP & Construction");
    expect(sectorFromNaf("43.21")).toBe("BTP & Construction");
    expect(sectorFromNaf("43")).toBe("BTP & Construction");
    expect(sectorFromNaf(" 43.21 A ")).toBe("BTP & Construction");
  });

  it("renvoie null sur entrée vide, nulle ou trop courte", () => {
    expect(sectorFromNaf(null)).toBeNull();
    expect(sectorFromNaf(undefined)).toBeNull();
    expect(sectorFromNaf("")).toBeNull();
    expect(sectorFromNaf("4")).toBeNull();
    expect(sectorFromNaf("ABC")).toBeNull();
  });

  it("renvoie null sur une division hors nomenclature (04, 34)", () => {
    expect(sectorFromNaf("04.10Z")).toBeNull();
    expect(sectorFromNaf("34.00Z")).toBeNull();
  });
});

describe("sectorFromNaf — classification à la FAMILLE", () => {
  it("construction → BTP & Construction", () => {
    expect(sectorFromNaf("41.20A")).toBe("BTP & Construction");
    expect(sectorFromNaf("42.11Z")).toBe("BTP & Construction");
    expect(sectorFromNaf("43.99C")).toBe("BTP & Construction");
  });

  it("industrie et agro-industrie → Industrie & Production ; culture → Agriculture & Agro", () => {
    expect(sectorFromNaf("10.71C")).toBe("Industrie & Production"); // boulangerie industrielle
    expect(sectorFromNaf("24.10Z")).toBe("Industrie & Production"); // sidérurgie
    expect(sectorFromNaf("01.11Z")).toBe("Agriculture & Agro");     // céréales
  });

  it("commerce de gros → Négoce & Distribution B2B ; détail et resto → Commerce & CHR", () => {
    expect(sectorFromNaf("46.73A")).toBe("Négoce & Distribution B2B");
    expect(sectorFromNaf("47.11D")).toBe("Commerce & CHR");
    expect(sectorFromNaf("45.20A")).toBe("Commerce & CHR");
    expect(sectorFromNaf("55.10Z")).toBe("Commerce & CHR");
  });

  it("services de soutien et transport", () => {
    expect(sectorFromNaf("81.21Z")).toBe("Services aux entreprises"); // nettoyage
    expect(sectorFromNaf("80.10Z")).toBe("Services aux entreprises"); // sécurité
    expect(sectorFromNaf("52.10B")).toBe("Transport & Logistique");   // entreposage
  });

  it("santé, conseil, informatique, finance", () => {
    expect(sectorFromNaf("86.10Z")).toBe("Santé & Médico-social");
    expect(sectorFromNaf("70.22Z")).toBe("Services aux entreprises"); // conseil
    expect(sectorFromNaf("62.01Z")).toBe("Numérique & Tech");         // programmation
    expect(sectorFromNaf("64.19Z")).toBe("Services financiers");      // banque
  });
});

describe("cohérence du référentiel", () => {
  it("toute valeur de NAF_DIVISION_TO_SECTOR appartient à SECTORS", () => {
    const inconnus = Object.entries(NAF_DIVISION_TO_SECTOR)
      .filter(([, s]) => !SECTOR_SET.has(s))
      .map(([d, s]) => `${d} → ${s}`);
    expect(inconnus).toEqual([]);
  });

  it("le NAF classe toujours à une FAMILLE", () => {
    const nonFamilles = Object.entries(NAF_DIVISION_TO_SECTOR)
      .filter(([, s]) => !SECTOR_FAMILIES.includes(s))
      .map(([d, s]) => `${d} → ${s}`);
    expect(nonFamilles).toEqual([]);
  });

  it("toute cible de DEAL_SECTOR_NORMALIZATION appartient à SECTORS", () => {
    const inconnus = Object.entries(DEAL_SECTOR_NORMALIZATION)
      .filter(([, s]) => !SECTOR_SET.has(s))
      .map(([l, s]) => `${l} → ${s}`);
    expect(inconnus).toEqual([]);
  });

  it("les clés de division NAF sont toutes sur 2 chiffres", () => {
    const malformees = Object.keys(NAF_DIVISION_TO_SECTOR).filter((k) => !/^\d{2}$/.test(k));
    expect(malformees).toEqual([]);
  });

  it("SECTORS ne contient pas de doublon ; chaque feuille a une famille", () => {
    expect(SECTOR_SET.size).toBe(SECTORS.length);
    for (const g of SECTOR_GROUPS) {
      for (const o of g.options) expect(SECTOR_TO_FAMILY[o]).toBe(g.family);
    }
  });
});

describe("sectorsCompatible / sectorsAreAdjacent — par famille", () => {
  it("une feuille matche sa famille et ses feuilles sœurs", () => {
    expect(sectorsCompatible("Génie climatique / CVC", "BTP & Construction")).toBe(true);
    expect(sectorsCompatible("Génie climatique / CVC", "Gros œuvre")).toBe(true);
    expect(sectorsAreAdjacent("Génie climatique / CVC", "Second œuvre")).toBe(true);
  });
  it("deux familles différentes ne sont pas compatibles", () => {
    expect(sectorsCompatible("Génie climatique / CVC", "ESN / Infogérance")).toBe(false);
  });
  it("Généraliste est passe-partout", () => {
    expect(sectorsCompatible("Généraliste", "Gros œuvre")).toBe(true);
    expect(sectorsCompatible("Second œuvre", "Généraliste")).toBe(true);
  });
});

describe("normalizeDealSector", () => {
  it("normalise les anciens libellés vers le référentiel actuel", () => {
    expect(normalizeDealSector("Construction / BTP")).toBe("BTP & Construction");
    expect(normalizeDealSector("Négoce / Distribution B2B")).toBe("Négoce & Distribution B2B");
    expect(normalizeDealSector("SaaS")).toBe("Éditeurs de logiciels / SaaS");
    expect(normalizeDealSector("Tourisme / Hospitality")).toBe("Hôtellerie / Restauration");
  });

  it("laisse passer une valeur déjà dans le référentiel", () => {
    expect(normalizeDealSector("Génie climatique / CVC")).toBe("Génie climatique / CVC");
    expect(normalizeDealSector("Industrie & Production")).toBe("Industrie & Production");
  });

  it("renvoie null sur entrée vide", () => {
    expect(normalizeDealSector(null)).toBeNull();
    expect(normalizeDealSector("")).toBeNull();
  });
});
