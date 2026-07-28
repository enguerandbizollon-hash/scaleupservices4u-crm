// Tests unitaires du screening marché (lib/connectors/recherche-entreprises.ts)
// Conversion âge → dates de naissance, construction des paramètres API,
// post-filtre dirigeant (sémantique « au moins un » de l'API + exclusion des
// commissaires aux comptes, vérifiées en réel le 2026-07-28).

import { describe, it, expect } from "vitest";
import {
  birthDateRangeForAges,
  buildScreeningParams,
  computeAgeFromBirth,
  findDirigeantPrincipal,
  DEPARTEMENTS_FR,
  type RawEntreprise,
} from "@/lib/connectors/recherche-entreprises";
import { NAF_CODES_BY_DIVISION, nafCodesForDivisions } from "@/lib/crm/naf-codes";

const NOW = new Date("2026-07-28T12:00:00Z");

// ── birthDateRangeForAges ────────────────────────────────────────────────────

describe("birthDateRangeForAges", () => {
  it("âge min 58 → né au plus tard il y a 58 ans", () => {
    const r = birthDateRangeForAges(58, null, NOW);
    expect(r.max).toBe("1968-07-28");
    expect(r.min).toBeUndefined();
  });

  it("âge max 70 → né au plus tôt il y a 71 ans + 1 jour", () => {
    const r = birthDateRangeForAges(null, 70, NOW);
    expect(r.min).toBe("1955-07-29");
    expect(r.max).toBeUndefined();
  });

  it("tranche 58-70 : les deux bornes, cohérentes (min < max)", () => {
    const r = birthDateRangeForAges(58, 70, NOW);
    expect(r.min).toBe("1955-07-29");
    expect(r.max).toBe("1968-07-28");
    expect(r.min! < r.max!).toBe(true);
  });

  it("null/0 → aucune borne", () => {
    expect(birthDateRangeForAges(null, null, NOW)).toEqual({});
    expect(birthDateRangeForAges(0, 0, NOW)).toEqual({});
  });
});

// ── buildScreeningParams ─────────────────────────────────────────────────────

describe("buildScreeningParams", () => {
  it("requête de screening complète (la requête vérifiée en réel)", () => {
    const p = buildScreeningParams({
      naf: ["43.21A", "43.22A"],
      ca_min: 2_000_000,
      ca_max: 20_000_000,
      age_dirigeant_min: 58,
      age_dirigeant_max: 70,
      departements: ["69", "38"],
    }, 2, 25, NOW);
    expect(p.get("activite_principale")).toBe("43.21A,43.22A");
    expect(p.get("ca_min")).toBe("2000000");
    expect(p.get("ca_max")).toBe("20000000");
    expect(p.get("departement")).toBe("69,38");
    expect(p.get("date_naissance_personne_min")).toBe("1955-07-29");
    expect(p.get("date_naissance_personne_max")).toBe("1968-07-28");
    expect(p.get("etat_administratif")).toBe("A"); // actives par défaut
    expect(p.get("page")).toBe("2");
    expect(p.get("per_page")).toBe("25");
  });

  it("actives_seulement=false retire le filtre d'état", () => {
    const p = buildScreeningParams({ naf: ["43.21A"], actives_seulement: false }, 1, 25, NOW);
    expect(p.get("etat_administratif")).toBeNull();
  });

  it("filtres vides → uniquement pagination + état actif", () => {
    const p = buildScreeningParams({}, 1, 25, NOW);
    expect([...p.keys()].sort()).toEqual(["etat_administratif", "page", "per_page"]);
  });
});

// ── computeAgeFromBirth ──────────────────────────────────────────────────────

describe("computeAgeFromBirth", () => {
  it("précision au mois (forme réelle 'AAAA-MM')", () => {
    expect(computeAgeFromBirth("1964-11", NOW)).toBe(61); // anniversaire pas encore passé
    expect(computeAgeFromBirth("1964-07", NOW)).toBe(62); // déjà passé
    expect(computeAgeFromBirth("1964-08", NOW)).toBe(61); // mois suivant → pas encore
  });

  it("valeurs invalides → null", () => {
    expect(computeAgeFromBirth(null, NOW)).toBeNull();
    expect(computeAgeFromBirth("", NOW)).toBeNull();
    expect(computeAgeFromBirth("11/1964", NOW)).toBeNull();
    expect(computeAgeFromBirth("1850-01", NOW)).toBeNull();
  });
});

// ── findDirigeantPrincipal ───────────────────────────────────────────────────

describe("findDirigeantPrincipal", () => {
  // Cas réel observé : deux gérants + un commissaire aux comptes dans dirigeants
  const raw = {
    siren: "385246913",
    dirigeants: [
      { nom: "ABENOZA", prenoms: "RENAUD", qualite: "Gérant", date_de_naissance: "1964-11" },
      { nom: "ETEVE", prenoms: "MATTHIEU", qualite: "Gérant", date_de_naissance: "1976-10" },
      { qualite: "Commissaire aux comptes titulaire" },
    ],
  } as RawEntreprise;

  it("retourne le dirigeant LE PLUS ÂGÉ satisfaisant la tranche (le cédant probable)", () => {
    const d = findDirigeantPrincipal(raw, 55, 70, NOW);
    expect(d).not.toBeNull();
    expect(d!.nom).toBe("ABENOZA");
    expect(d!.age).toBe(61);
  });

  it("écarte la fiche si AUCUN dirigeant dans la tranche (corrige le « au moins un » de l'API)", () => {
    expect(findDirigeantPrincipal(raw, 65, 80, NOW)).toBeNull();
  });

  it("sans contrainte d'âge : le plus âgé des dirigeants exerçants", () => {
    const d = findDirigeantPrincipal(raw, null, null, NOW);
    expect(d!.nom).toBe("ABENOZA");
  });

  it("exclut commissaires aux comptes et personnes morales", () => {
    const holding = {
      siren: "111111111",
      dirigeants: [
        { denomination: "HOLDING SAS", siren: "222222222", qualite: "Président" },
        { qualite: "Commissaire aux comptes suppléant", nom: "CAC", date_de_naissance: "1960-01" },
      ],
    } as RawEntreprise;
    expect(findDirigeantPrincipal(holding, null, null, NOW)).toBeNull();
  });

  it("qualite hors direction (ex. simple associé non listé) : ignorée par le filtre de qualité", () => {
    const r = {
      siren: "333333333",
      dirigeants: [{ nom: "X", qualite: "Contrôleur de gestion", date_de_naissance: "1960-01" }],
    } as RawEntreprise;
    expect(findDirigeantPrincipal(r, null, null, NOW)).toBeNull();
  });
});

// ── Référentiels ─────────────────────────────────────────────────────────────

describe("référentiels screening", () => {
  it("DEPARTEMENTS_FR : 101 départements, Corse incluse, pas de doublon", () => {
    expect(DEPARTEMENTS_FR).toHaveLength(101);
    expect(DEPARTEMENTS_FR).toContain("2A");
    expect(DEPARTEMENTS_FR).toContain("2B");
    expect(DEPARTEMENTS_FR).toContain("75");
    expect(DEPARTEMENTS_FR).toContain("974");
    expect(new Set(DEPARTEMENTS_FR).size).toBe(DEPARTEMENTS_FR.length);
  });

  it("naf-codes : division 43 présente avec des codes complets valides", () => {
    expect(NAF_CODES_BY_DIVISION["43"]).toContain("43.21A");
    for (const code of NAF_CODES_BY_DIVISION["43"]) {
      expect(code).toMatch(/^\d{2}\.\d{2}[A-Z]$/);
    }
  });

  it("nafCodesForDivisions : concatène et ignore les divisions inexistantes", () => {
    // "00" et "04" n'existent pas dans la NAF rév. 2 (04 est un trou officiel)
    const codes = nafCodesForDivisions(["43", "00", "04"]);
    expect(codes.length).toBe(NAF_CODES_BY_DIVISION["43"].length);
  });
});
