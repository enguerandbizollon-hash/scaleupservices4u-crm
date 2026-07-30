// Tests des normalisations Pappers (Deal OS, chantier B) : bénéficiaires
// effectifs (actionnariat) et fusion des finances profondes. Noms de champs
// vérifiés sur le client OpenAPI officiel de l'API Pappers.

import { describe, it, expect } from "vitest";
import {
  ageFromMmYyyy,
  normalizeBeneficiaires,
  mergeFinancesPappers,
} from "@/lib/connectors/pappers";

const NOW = new Date("2026-07-30T12:00:00Z");

describe("ageFromMmYyyy (format Pappers MM/AAAA)", () => {
  it("mois déjà passé cette année", () => {
    expect(ageFromMmYyyy("03/1954", NOW)).toBe(72);
  });
  it("mois pas encore atteint : un an de moins", () => {
    expect(ageFromMmYyyy("12/1983", NOW)).toBe(42);
  });
  it("formats invalides : null", () => {
    expect(ageFromMmYyyy("1983-12", NOW)).toBeNull();
    expect(ageFromMmYyyy("13/1990", NOW)).toBeNull();
    expect(ageFromMmYyyy("", NOW)).toBeNull();
    expect(ageFromMmYyyy(null, NOW)).toBeNull();
  });
});

describe("normalizeBeneficiaires", () => {
  const brut = [
    {
      type: "physique", nom: "ADAM", prenom: "OLIVIER JEAN", prenom_usuel: "OLIVIER",
      date_de_naissance_formatee: "03/1954", nationalite: "Française",
      pourcentage_parts: 40, pourcentage_parts_directes: 40, pourcentage_parts_indirectes: 0,
      pourcentage_votes: 40, beneficiaire_representant_legal: false,
    },
    {
      type: "physique", nom: "ADAM", prenom: "ROMAIN",
      date_de_naissance_formatee: "12/1983",
      pourcentage_parts: 60, pourcentage_parts_directes: 35, pourcentage_parts_indirectes: 25,
      pourcentage_votes: 60, beneficiaire_representant_legal: true,
    },
  ];

  it("trie par parts décroissantes, calcule les âges, préfère le prénom usuel", () => {
    const r = normalizeBeneficiaires(brut, NOW);
    expect(r).toHaveLength(2);
    expect(r[0].nom).toBe("ADAM");
    expect(r[0].pourcentage_parts).toBe(60);
    expect(r[0].age).toBe(42);
    expect(r[0].representant_legal).toBe(true);
    expect(r[0].pourcentage_parts_indirectes).toBe(25);
    expect(r[1].prenom).toBe("OLIVIER");
    expect(r[1].age).toBe(72);
  });

  it("écarte les entrées sans nom, tolère les personnes morales", () => {
    const r = normalizeBeneficiaires([
      { nom: null, pourcentage_parts: 10 },
      { type: "morale", nom: "HOLDING ADAM", pourcentage_parts: 100 },
    ], NOW);
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe("morale");
    expect(r[0].age).toBeNull();
  });

  it("liste vide ou absente : tableau vide", () => {
    expect(normalizeBeneficiaires(null, NOW)).toEqual([]);
    expect(normalizeBeneficiaires([], NOW)).toEqual([]);
  });
});

describe("mergeFinancesPappers", () => {
  const existing = {
    "2024": { ca: 1_600_000, resultat_net: -984 },
    "2023": { ca: 1_500_000, resultat_net: 20_000 },
  };

  it("enrichit une année existante sans perdre l'existant", () => {
    const merged = mergeFinancesPappers(existing, [
      { annee: 2024, excedent_brut_exploitation: 120_000, dettes_financieres: 300_000, tresorerie: 80_000, effectif: 8 },
    ]);
    expect(merged["2024"].ca).toBe(1_600_000);        // gratuit préservé
    expect(merged["2024"].resultat_net).toBe(-984);
    expect(merged["2024"].ebitda).toBe(120_000);       // profondeur Pappers
    expect(merged["2024"].dettes_financieres).toBe(300_000);
    expect(merged["2023"]).toEqual(existing["2023"]);  // année non touchée intacte
  });

  it("Pappers écrase le CA seulement s'il apporte une valeur", () => {
    const merged = mergeFinancesPappers(existing, [
      { annee: 2024, chiffre_affaires: 1_650_000, resultat: null },
    ]);
    expect(merged["2024"].ca).toBe(1_650_000);
    expect(merged["2024"].resultat_net).toBe(-984);
  });

  it("crée les années absentes de la fiche gratuite", () => {
    const merged = mergeFinancesPappers(existing, [
      { annee: 2022, chiffre_affaires: 1_400_000, resultat: 15_000, excedent_brut_exploitation: 90_000 },
    ]);
    expect(merged["2022"].ebitda).toBe(90_000);
    expect(Object.keys(merged).sort()).toEqual(["2022", "2023", "2024"]);
  });

  it("entrées sans année ignorées, existant nul toléré", () => {
    const merged = mergeFinancesPappers(null, [{ chiffre_affaires: 1 }, { annee: 2024, chiffre_affaires: 2 }]);
    expect(Object.keys(merged)).toEqual(["2024"]);
  });
});
