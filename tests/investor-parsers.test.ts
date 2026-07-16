// Tests unitaires lib/crm/investor-parsers.ts
// Parsing tickets texte, normalisation stades/secteurs/géos, multi-valeurs.

import { describe, it, expect } from "vitest";
import {
  parseTicketText,
  normalizeStageText,
  normalizeSectorText,
  parseMultiText,
  normalizeGeoText,
} from "@/lib/crm/investor-parsers";

// ── parseTicketText ──────────────────────────────────────────────────────────

describe("parseTicketText", () => {
  it("retourne null pour null ou chaîne vide", () => {
    expect(parseTicketText(null)).toBeNull();
    expect(parseTicketText("")).toBeNull();
  });

  it("parse une fourchette avec tiret simple : '1M - 3M'", () => {
    expect(parseTicketText("1M - 3M")).toEqual({ min: 1_000_000, max: 3_000_000 });
  });

  it("parse une fourchette avec tiret demi-cadratin et devise : '1M – 3M€'", () => {
    expect(parseTicketText("1M – 3M€")).toEqual({ min: 1_000_000, max: 3_000_000 });
  });

  it("parse les montants en k : '100k - 300k'", () => {
    expect(parseTicketText("100k - 300k")).toEqual({ min: 100_000, max: 300_000 });
  });

  it("parse les décimales avec virgule ou point : '1,5M - 3M' / '0.5m-1m'", () => {
    expect(parseTicketText("1,5M - 3M")).toEqual({ min: 1_500_000, max: 3_000_000 });
    expect(parseTicketText("0.5m-1m")).toEqual({ min: 500_000, max: 1_000_000 });
  });

  it("parse une borne supérieure seule : '< 500k€'", () => {
    expect(parseTicketText("< 500k€")).toEqual({ min: null, max: 500_000 });
  });

  it("parse une borne inférieure seule : '> 25M€'", () => {
    expect(parseTicketText("> 25M€")).toEqual({ min: 25_000_000, max: null });
  });

  it("documente la limitation actuelle : une valeur seule sans < ni > n'est pas parsée", () => {
    // "500K" seul retourne null — signalé dans le rapport comme limitation.
    expect(parseTicketText("500K")).toBeNull();
  });

  it("retourne null pour un texte non parsable", () => {
    expect(parseTicketText("sur demande")).toBeNull();
  });
});

// ── normalizeStageText ───────────────────────────────────────────────────────

describe("normalizeStageText", () => {
  it("retourne null pour null, chaîne vide ou texte inconnu", () => {
    expect(normalizeStageText(null)).toBeNull();
    expect(normalizeStageText("")).toBeNull();
    expect(normalizeStageText("inconnu")).toBeNull();
  });

  it("normalise les alias FR/EN vers les valeurs du référentiel", () => {
    expect(normalizeStageText("Pre-seed")).toBe("Seed");
    expect(normalizeStageText("Seed")).toBe("Seed");
    expect(normalizeStageText("Series A")).toBe("Série A");
    expect(normalizeStageText("série b")).toBe("Série B");
    expect(normalizeStageText("Growth equity")).toBe("Growth");
    expect(normalizeStageText("Buyout / LBO")).toBe("Late Stage");
    expect(normalizeStageText("Toutes étapes")).toBe("Généraliste");
    expect(normalizeStageText("generaliste")).toBe("Généraliste");
  });

  it("détecte 'Pré-série A' avant 'Série A' (ordre des règles)", () => {
    expect(normalizeStageText("Pré-série A")).toBe("Pré-Série A");
    expect(normalizeStageText("pre-series a")).toBe("Pré-Série A");
  });

  it("est insensible à la casse", () => {
    expect(normalizeStageText("SEED")).toBe("Seed");
  });
});

// ── normalizeSectorText ──────────────────────────────────────────────────────

describe("normalizeSectorText", () => {
  it("retourne null pour null ou texte inconnu", () => {
    expect(normalizeSectorText(null)).toBeNull();
    expect(normalizeSectorText("zzz")).toBeNull();
  });

  it("normalise les alias FR courants", () => {
    expect(normalizeSectorText("Généraliste")).toBe("Généraliste");
    expect(normalizeSectorText("Logiciel SaaS B2B")).toBe("SaaS");
    expect(normalizeSectorText("software")).toBe("SaaS");
    expect(normalizeSectorText("Fintech")).toBe("Fintech");
    expect(normalizeSectorText("santé")).toBe("MedTech");
    expect(normalizeSectorText("cybersécurité")).toBe("Cybersécurité");
    expect(normalizeSectorText("e-commerce")).toBe("Retail");
    expect(normalizeSectorText("énergie")).toBe("Energie");
    expect(normalizeSectorText("agroalimentaire")).toBe("Food");
    expect(normalizeSectorText("juridique")).toBe("Conseil");
    expect(normalizeSectorText("finance")).toBe("Fintech");
  });

  it("documente le faux positif du test 'ia' : tout mot contenant 'ia' devient Deeptech", () => {
    // Bug signalé dans le rapport : t.includes("ia") matche des sous-chaînes
    // de mots sans rapport ("média", "industrial", "aérospatial"...).
    expect(normalizeSectorText("média")).toBe("Deeptech");        // attendu : Média
    expect(normalizeSectorText("industrial")).toBe("Deeptech");   // attendu : Industrie
  });

  it("documente la branche Healthtech inatteignable : 'healthtech' contient 'health' → MedTech", () => {
    // Bug signalé dans le rapport : la règle MedTech (t.includes("health"))
    // précède la règle Healthtech, qui ne peut donc jamais matcher.
    expect(normalizeSectorText("healthtech")).toBe("MedTech");
  });
});

// ── parseMultiText ───────────────────────────────────────────────────────────

describe("parseMultiText", () => {
  it("retourne [] pour null", () => {
    expect(parseMultiText(null, normalizeSectorText)).toEqual([]);
  });

  it("découpe sur virgule, point-virgule et slash puis normalise", () => {
    expect(parseMultiText("SaaS, Fintech; santé", normalizeSectorText)).toEqual(["SaaS", "Fintech", "MedTech"]);
    expect(parseMultiText("SaaS / Fintech", normalizeSectorText)).toEqual(["SaaS", "Fintech"]);
  });

  it("filtre les valeurs non normalisables", () => {
    expect(parseMultiText("SaaS, zzz", normalizeSectorText)).toEqual(["SaaS"]);
  });

  it("ne déduplique pas les valeurs normalisées identiques", () => {
    expect(parseMultiText("logiciel, software", normalizeSectorText)).toEqual(["SaaS", "SaaS"]);
  });

  it("fonctionne avec normalizeStageText", () => {
    expect(parseMultiText("Seed, Series A", normalizeStageText)).toEqual(["Seed", "Série A"]);
  });
});

// ── normalizeGeoText ─────────────────────────────────────────────────────────

describe("normalizeGeoText", () => {
  it("retourne null pour null, chaîne vide ou géo inconnue", () => {
    expect(normalizeGeoText(null)).toBeNull();
    expect(normalizeGeoText("")).toBeNull();
    expect(normalizeGeoText("Atlantide")).toBeNull();
  });

  it("normalise les villes et régions françaises", () => {
    expect(normalizeGeoText("Paris")).toBe("ile_de_france");
    expect(normalizeGeoText("Lyon")).toBe("auvergne_rhone_alpes");
    expect(normalizeGeoText("Marseille")).toBe("paca");
    expect(normalizeGeoText("Bordeaux")).toBe("nouvelle_aquitaine");
  });

  it("détecte les régions avant la France générique", () => {
    expect(normalizeGeoText("Île-de-France")).toBe("ile_de_france");
    expect(normalizeGeoText("Hauts-de-France")).toBe("hauts_de_france");
    expect(normalizeGeoText("France")).toBe("france");
  });

  it("normalise les régions suisses avant la Suisse générique (rattachée à dach)", () => {
    expect(normalizeGeoText("Genève")).toBe("suisse_romande");
    expect(normalizeGeoText("Lausanne")).toBe("suisse_romande");
    expect(normalizeGeoText("Zurich")).toBe("suisse_alemanique");
    expect(normalizeGeoText("Suisse")).toBe("dach");
  });

  it("normalise les zones européennes et mondiales", () => {
    expect(normalizeGeoText("Belgique")).toBe("benelux");
    expect(normalizeGeoText("Royaume-Uni")).toBe("uk_ireland");
    expect(normalizeGeoText("Europe")).toBe("europe");
    expect(normalizeGeoText("USA")).toBe("amerique_nord");
    expect(normalizeGeoText("états-unis")).toBe("amerique_nord");
    expect(normalizeGeoText("Worldwide")).toBe("global");
  });

  it("est insensible à la casse", () => {
    expect(normalizeGeoText("PARIS")).toBe("ile_de_france");
  });
});
