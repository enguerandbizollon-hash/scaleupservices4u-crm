// Tests unitaires de la taxonomie sectorielle (lib/crm/matching-maps.ts)
// Couvre le mapping NAF → secteur et la normalisation des libellés longs.

import { describe, it, expect } from "vitest";
import {
  SECTORS,
  NAF_DIVISION_TO_SECTOR,
  sectorFromNaf,
  normalizeDealSector,
  DEAL_SECTOR_NORMALIZATION,
} from "@/lib/crm/matching-maps";

const SECTOR_SET = new Set<string>(SECTORS as readonly string[]);

describe("sectorFromNaf — formats de code acceptés", () => {
  it("accepte la sous-classe complète avec point (43.21A)", () => {
    expect(sectorFromNaf("43.21A")).toBe("BTP");
  });

  it("accepte la forme compacte sans point (4321A)", () => {
    expect(sectorFromNaf("4321A")).toBe("BTP");
  });

  it("accepte la classe seule (43.21) et la division seule (43)", () => {
    expect(sectorFromNaf("43.21")).toBe("BTP");
    expect(sectorFromNaf("43")).toBe("BTP");
  });

  it("tolère les espaces parasites", () => {
    expect(sectorFromNaf(" 43.21 A ")).toBe("BTP");
  });

  it("renvoie null sur entrée vide, nulle ou trop courte", () => {
    expect(sectorFromNaf(null)).toBeNull();
    expect(sectorFromNaf(undefined)).toBeNull();
    expect(sectorFromNaf("")).toBeNull();
    expect(sectorFromNaf("4")).toBeNull();
    expect(sectorFromNaf("ABC")).toBeNull();
  });

  it("renvoie null sur une division hors nomenclature", () => {
    // 04 et 34 n'existent pas en NAF rév. 2
    expect(sectorFromNaf("04.10Z")).toBeNull();
    expect(sectorFromNaf("34.00Z")).toBeNull();
  });
});

describe("sectorFromNaf — secteurs small cap traditionnels du pivot M&A", () => {
  it("construction → BTP", () => {
    expect(sectorFromNaf("41.20A")).toBe("BTP"); // construction de bâtiments
    expect(sectorFromNaf("42.11Z")).toBe("BTP"); // travaux publics
    expect(sectorFromNaf("43.99C")).toBe("BTP"); // travaux spécialisés
  });

  it("industries alimentaires → Agroalimentaire, culture → Agriculture", () => {
    expect(sectorFromNaf("10.71C")).toBe("Agroalimentaire"); // boulangerie industrielle
    expect(sectorFromNaf("11.02A")).toBe("Agroalimentaire"); // vins
    expect(sectorFromNaf("01.11Z")).toBe("Agriculture");     // céréales
  });

  it("commerce de gros → Négoce, commerce de détail → Retail", () => {
    expect(sectorFromNaf("46.73A")).toBe("Négoce"); // gros matériaux de construction
    expect(sectorFromNaf("47.11D")).toBe("Retail"); // supermarchés
  });

  it("commerce et réparation automobile → Automobile", () => {
    expect(sectorFromNaf("45.20A")).toBe("Automobile");
    expect(sectorFromNaf("29.10Z")).toBe("Automobile"); // construction de véhicules
  });

  it("services de soutien traditionnels", () => {
    expect(sectorFromNaf("81.21Z")).toBe("Propreté & Facility"); // nettoyage courant
    expect(sectorFromNaf("80.10Z")).toBe("Sécurité privée");     // activités de sécurité
    expect(sectorFromNaf("52.10B")).toBe("Logistique");          // entreposage
  });

  it("hôtellerie et restauration", () => {
    expect(sectorFromNaf("55.10Z")).toBe("Hôtellerie-Restauration");
    expect(sectorFromNaf("56.10A")).toBe("Hôtellerie-Restauration");
  });

  it("santé et médico-social", () => {
    expect(sectorFromNaf("86.10Z")).toBe("Santé & Médico-social"); // hôpitaux
    expect(sectorFromNaf("87.10A")).toBe("Santé & Médico-social"); // hébergement médicalisé
  });

  it("conseil et informatique", () => {
    expect(sectorFromNaf("70.22Z")).toBe("Conseil"); // conseil pour les affaires
    expect(sectorFromNaf("69.20Z")).toBe("Conseil"); // comptabilité
    expect(sectorFromNaf("62.01Z")).toBe("SaaS");    // programmation informatique
  });
});

describe("cohérence du référentiel", () => {
  it("toute valeur de NAF_DIVISION_TO_SECTOR appartient à SECTORS", () => {
    const inconnus = Object.entries(NAF_DIVISION_TO_SECTOR)
      .filter(([, secteur]) => !SECTOR_SET.has(secteur))
      .map(([division, secteur]) => `${division} → ${secteur}`);
    expect(inconnus).toEqual([]);
  });

  it("toute cible de DEAL_SECTOR_NORMALIZATION appartient à SECTORS", () => {
    const inconnus = Object.entries(DEAL_SECTOR_NORMALIZATION)
      .filter(([, secteur]) => !SECTOR_SET.has(secteur))
      .map(([libelle, secteur]) => `${libelle} → ${secteur}`);
    expect(inconnus).toEqual([]);
  });

  it("les clés de division NAF sont toutes sur 2 chiffres", () => {
    const malformees = Object.keys(NAF_DIVISION_TO_SECTOR).filter(k => !/^\d{2}$/.test(k));
    expect(malformees).toEqual([]);
  });

  it("SECTORS ne contient pas de doublon", () => {
    expect(SECTOR_SET.size).toBe(SECTORS.length);
  });
});

describe("normalizeDealSector", () => {
  it("normalise les libellés longs du formulaire vers le référentiel", () => {
    expect(normalizeDealSector("Construction / BTP")).toBe("BTP");
    expect(normalizeDealSector("Négoce / Distribution B2B")).toBe("Négoce");
    expect(normalizeDealSector("Agroalimentaire")).toBe("Agroalimentaire");
  });

  it("corrige l'ancien mapping erroné Tourisme → Sport", () => {
    expect(normalizeDealSector("Tourisme / Hospitality")).toBe("Hôtellerie-Restauration");
  });

  it("laisse passer une valeur déjà normalisée", () => {
    expect(normalizeDealSector("Industrie")).toBe("Industrie");
  });

  it("renvoie null sur entrée vide", () => {
    expect(normalizeDealSector(null)).toBeNull();
    expect(normalizeDealSector("")).toBeNull();
  });
});
