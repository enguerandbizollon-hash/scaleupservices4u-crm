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

  it("normalise les alias FR courants vers le référentiel small cap", () => {
    expect(normalizeSectorText("Généraliste")).toBe("Généraliste");
    expect(normalizeSectorText("Logiciel SaaS B2B")).toBe("Éditeurs de logiciels / SaaS");
    expect(normalizeSectorText("software")).toBe("Éditeurs de logiciels / SaaS");
    expect(normalizeSectorText("Fintech")).toBe("Fintech / Assurtech");
    expect(normalizeSectorText("santé")).toBe("Santé & Médico-social");
    expect(normalizeSectorText("cybersécurité")).toBe("Cybersécurité");
    expect(normalizeSectorText("e-commerce")).toBe("E-commerce");
    expect(normalizeSectorText("énergie")).toBe("Immobilier & Énergie");
    expect(normalizeSectorText("agroalimentaire")).toBe("Industrie agroalimentaire");
    expect(normalizeSectorText("juridique")).toBe("Conseil / Ingénierie");
    expect(normalizeSectorText("finance")).toBe("Services financiers");
  });

  it("fin du faux positif 'ia' : les mots contenant 'ia' ne deviennent plus Deeptech", () => {
    expect(normalizeSectorText("média")).toBe("Marketing / Communication / Média");
    expect(normalizeSectorText("industrial")).toBe("Industrie & Production");
    expect(normalizeSectorText("BTP gros œuvre")).toBe("Gros œuvre");
    expect(normalizeSectorText("génie climatique")).toBe("Génie climatique / CVC");
  });

  it("les libellés santé se rabattent sur la famille Santé & Médico-social", () => {
    expect(normalizeSectorText("healthtech")).toBe("Santé & Médico-social");
    expect(normalizeSectorText("EHPAD")).toBe("EHPAD / Médico-social");
  });
});

// ── parseMultiText ───────────────────────────────────────────────────────────

describe("parseMultiText", () => {
  it("retourne [] pour null", () => {
    expect(parseMultiText(null, normalizeSectorText)).toEqual([]);
  });

  it("découpe sur virgule et point-virgule puis normalise", () => {
    expect(parseMultiText("SaaS, cybersécurité; santé", normalizeSectorText)).toEqual([
      "Éditeurs de logiciels / SaaS", "Cybersécurité", "Santé & Médico-social",
    ]);
  });

  it("filtre les valeurs non normalisables", () => {
    expect(parseMultiText("SaaS, zzz", normalizeSectorText)).toEqual(["Éditeurs de logiciels / SaaS"]);
  });

  it("ne déduplique pas les valeurs normalisées identiques", () => {
    expect(parseMultiText("logiciel, software", normalizeSectorText)).toEqual([
      "Éditeurs de logiciels / SaaS", "Éditeurs de logiciels / SaaS",
    ]);
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
