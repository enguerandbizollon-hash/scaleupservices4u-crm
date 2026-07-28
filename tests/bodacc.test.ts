// Tests unitaires lib/connectors/bodacc.ts
// Normalisation des annonces BODACC : extraction SIREN, mapping familles,
// titres, sévérité, parsing tolérant. Calibrés sur des formes RÉELLES
// observées sur l'API le 2026-07-28.

import { describe, it, expect } from "vitest";
import {
  extractSirens,
  mapFamilleToType,
  severityFor,
  parseJsonField,
  buildTitre,
  normalizeAnnonce,
  type RawAnnonce,
} from "@/lib/connectors/bodacc";

// ── extractSirens ────────────────────────────────────────────────────────────

describe("extractSirens", () => {
  it("forme réelle API : tableau avec doublons espacés (cédant + repreneur)", () => {
    // Observé tel quel sur une annonce de vente réelle
    expect(extractSirens(["107458440", "107 458 440", "342408861", "342 408 861"]))
      .toEqual(["107458440", "342408861"]);
  });

  it("chaîne simple avec espaces", () => {
    expect(extractSirens("513 671 966")).toEqual(["513671966"]);
  });

  it("ignore les valeurs non-SIREN (SIRET 14 chiffres, texte, vide)", () => {
    expect(extractSirens(["12345678901234", "RCS Nice", ""])).toEqual([]);
  });

  it("null et undefined → tableau vide", () => {
    expect(extractSirens(null)).toEqual([]);
    expect(extractSirens(undefined)).toEqual([]);
  });

  it("préserve l'ordre (le premier SIREN = sujet de l'annonce)", () => {
    expect(extractSirens(["222222222", "111111111"])).toEqual(["222222222", "111111111"]);
  });
});

// ── mapFamilleToType / severityFor ───────────────────────────────────────────

describe("mapFamilleToType", () => {
  it("mappe les 4 familles ingérées", () => {
    expect(mapFamilleToType("Ventes et cessions")).toBe("vente_cession");
    expect(mapFamilleToType("Procédures collectives")).toBe("procedure_collective");
    expect(mapFamilleToType("Radiations")).toBe("radiation");
    expect(mapFamilleToType("Dépôts des comptes")).toBe("depot_comptes");
  });

  it("famille inconnue ou absente → null (annonce ignorée)", () => {
    expect(mapFamilleToType("Immatriculations")).toBeNull();
    expect(mapFamilleToType("Créations")).toBeNull();
    expect(mapFamilleToType(null)).toBeNull();
  });
});

describe("severityFor", () => {
  it("procédure collective = alerte, le reste = info", () => {
    expect(severityFor("procedure_collective")).toBe("alerte");
    expect(severityFor("vente_cession")).toBe("info");
    expect(severityFor("radiation")).toBe("info");
    expect(severityFor("depot_comptes")).toBe("info");
  });
});

// ── parseJsonField ───────────────────────────────────────────────────────────

describe("parseJsonField", () => {
  it("parse un JSON sérialisé (forme Opendatasoft)", () => {
    expect(parseJsonField('{"type":"initial","famille":"Jugement de clôture"}'))
      .toEqual({ type: "initial", famille: "Jugement de clôture" });
  });

  it("laisse passer un objet déjà parsé", () => {
    expect(parseJsonField({ a: 1 })).toEqual({ a: 1 });
  });

  it("JSON invalide, null, nombre → null sans throw", () => {
    expect(parseJsonField("pas du json")).toBeNull();
    expect(parseJsonField(null)).toBeNull();
    expect(parseJsonField(42)).toBeNull();
  });
});

// ── buildTitre ───────────────────────────────────────────────────────────────

describe("buildTitre", () => {
  it("cession : nom + ville", () => {
    const a = { id: "x", dateparution: "2026-07-28", commercant: "ELITE CARROSSERIE", ville: "Saint-Laurent-du-Var" } as RawAnnonce;
    expect(buildTitre("vente_cession", a)).toBe("Cession : ELITE CARROSSERIE (Saint-Laurent-du-Var)");
  });

  it("procédure collective : famille du jugement en tête", () => {
    const a = {
      id: "x", dateparution: "2026-07-21", commercant: "SUBWAY SAINT LO",
      jugement: '{"famille":"Jugement de clôture","nature":"Clôture pour insuffisance d\'actif"}',
    } as RawAnnonce;
    expect(buildTitre("procedure_collective", a)).toBe("Jugement de clôture : SUBWAY SAINT LO");
  });

  it("procédure collective sans jugement parsable : libellé générique", () => {
    const a = { id: "x", dateparution: "2026-07-21", commercant: "X SARL", jugement: null } as RawAnnonce;
    expect(buildTitre("procedure_collective", a)).toBe("Procédure collective : X SARL");
  });

  it("société sans nom : placeholder", () => {
    const a = { id: "x", dateparution: "2026-07-21", commercant: "  " } as RawAnnonce;
    expect(buildTitre("radiation", a)).toBe("Radiation : (société inconnue)");
  });
});

// ── normalizeAnnonce (bout en bout) ──────────────────────────────────────────

describe("normalizeAnnonce", () => {
  const base: RawAnnonce = {
    id: "A202600123456",
    dateparution: "2026-07-28",
    familleavis_lib: "Ventes et cessions",
    commercant: "ELITE CARROSSERIE",
    registre: ["107458440", "107 458 440", "342408861", "342 408 861"],
    ville: "Saint-Laurent-du-Var",
    cp: "06700",
    numerodepartement: "06",
    region_nom_officiel: "Provence-Alpes-Côte d'Azur",
    tribunal: "Greffe du Tribunal de Commerce d'Antibes",
    acte: '{"descriptif":"Acte sous seing privé...","vente":{"categorieVente":"Apport"}}',
    url_complete: "https://www.bodacc.fr/annonce/x",
  };

  it("annonce de vente réelle : signal complet", () => {
    const s = normalizeAnnonce(base);
    expect(s).not.toBeNull();
    expect(s!.external_id).toBe("A202600123456");
    expect(s!.siren).toBe("107458440");
    expect(s!.sirens).toEqual(["107458440", "342408861"]);
    expect(s!.signal_type).toBe("vente_cession");
    expect(s!.signal_date).toBe("2026-07-28");
    expect(s!.severity).toBe("info");
    expect(s!.titre).toContain("ELITE CARROSSERIE");
    expect(s!.payload.departement).toBe("06");
    expect((s!.payload.acte as Record<string, unknown>).vente).toEqual({ categorieVente: "Apport" });
    expect(s!.payload.url).toBe("https://www.bodacc.fr/annonce/x");
  });

  it("famille hors périmètre → null", () => {
    expect(normalizeAnnonce({ ...base, familleavis_lib: "Immatriculations" })).toBeNull();
  });

  it("sans SIREN → null (inexploitable pour le pivot)", () => {
    expect(normalizeAnnonce({ ...base, registre: ["RCS 123"] })).toBeNull();
    expect(normalizeAnnonce({ ...base, registre: null })).toBeNull();
  });

  it("sans id ou sans date → null (idempotence impossible)", () => {
    expect(normalizeAnnonce({ ...base, id: "" })).toBeNull();
    expect(normalizeAnnonce({ ...base, dateparution: "" as string })).toBeNull();
  });

  it("jugement JSON invalide : signal conservé, payload.jugement null", () => {
    const s = normalizeAnnonce({
      ...base,
      familleavis_lib: "Procédures collectives",
      jugement: "{invalide",
    });
    expect(s).not.toBeNull();
    expect(s!.signal_type).toBe("procedure_collective");
    expect(s!.severity).toBe("alerte");
    expect(s!.payload.jugement).toBeNull();
  });
});
