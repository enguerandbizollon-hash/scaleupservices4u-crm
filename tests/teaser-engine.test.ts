// Tests du moteur de teaser (Deal OS, chantier C) : anonymisation par code,
// validation structurelle, construction du prompt. La confidentialité ne
// repose jamais sur la seule consigne au modèle.

import { describe, it, expect } from "vitest";
import {
  forbiddenTokens,
  anonymizeText,
  anonymizeTeaser,
  validateTeaserContent,
  buildTeaserPrompt,
  type TeaserContent,
} from "@/lib/ai/teaser-engine";

describe("forbiddenTokens", () => {
  it("garde les mots identifiants, écarte les formes juridiques et mots-outils", () => {
    const t = forbiddenTokens("SARL SCIERIE FOREST", "320584279");
    expect(t).toContain("SCIERIE");
    expect(t).toContain("FOREST");
    expect(t).toContain("320584279");
    expect(t).not.toContain("SARL");
  });

  it("SOCIETE GRANITIERE DES ETABLISSEMENTS DIDIERLAURENT : les mots-outils tombent", () => {
    const t = forbiddenTokens("SOCIETE GRANITIERE DES ETABLISSEMENTS DIDIERLAURENT", null);
    expect(t).toEqual(["GRANITIERE", "DIDIERLAURENT"]);
  });
});

describe("anonymizeText", () => {
  const tokens = ["SCIERIE", "FOREST", "320584279"];

  it("scrub insensible à la casse", () => {
    expect(anonymizeText("La Scierie Forest est leader.", tokens)).toBe("La la Société est leader.");
  });

  it("le SIREN disparaît", () => {
    expect(anonymizeText("SIREN 320584279 immatriculée.", tokens)).not.toContain("320584279");
  });

  it("les doublons du scrub se compactent (et prennent la majuscule en tête de phrase)", () => {
    const out = anonymizeText("SCIERIE FOREST propose...", tokens);
    expect(out).toBe("La Société propose...");
    expect(anonymizeText("Fondée en 1980, SCIERIE FOREST propose...", tokens)).toBe("Fondée en 1980, la Société propose...");
  });

  it("texte sans occurrence : inchangé", () => {
    expect(anonymizeText("Une belle entreprise régionale.", tokens)).toBe("Une belle entreprise régionale.");
  });

  it("frontières de mot : un patronyme-métier ne corrompt pas le vocabulaire", () => {
    const t = forbiddenTokens("Marc Boulanger", null, 2);
    expect(anonymizeText("Boulangerie / pâtisserie", t, "le Repreneur")).toBe("Boulangerie / pâtisserie");
    expect(anonymizeText("Transport routier de marchandises", forbiddenTokens("Transports MARCHAND", null))).toBe("Transport routier de marchandises");
    expect(anonymizeText("Marc Boulanger reprend une boulangerie.", t, "le Repreneur")).toBe("Le Repreneur reprend une boulangerie.");
  });

  it("majuscule en tête de phrase et après un point", () => {
    const t = forbiddenTokens("Damien ROUSSON", null, 2);
    expect(anonymizeText("Damien ROUSSON reprend. ROUSSON vise le BTP.", t, "le Repreneur"))
      .toBe("Le Repreneur reprend. Le Repreneur vise le BTP.");
  });

  it("un nom de personne de deux lettres est scrubbé avec minLength 2, sans toucher les mots voisins", () => {
    const t = forbiddenTokens("Amadou Ba", null, 2);
    expect(t).toContain("Ba");
    expect(anonymizeText("Amadou Ba dirige un bateau-école basé à Bastia.", t, "le Repreneur"))
      .toBe("Le Repreneur dirige un bateau-école basé à Bastia.");
  });
});

const contenuValide: TeaserContent = {
  titre: "Scierie industrielle, région Auvergne-Rhône-Alpes",
  accroche: "Acteur établi du sciage de résineux, la SCIERIE FOREST sert les charpentiers régionaux depuis 1980.",
  activite: "La société transforme des résineux locaux pour la charpente et la construction bois.",
  chiffres_cles: [{ label: "Chiffre d'affaires 2024", valeur: "1,6 M EUR" }],
  points_forts: ["Outil de production récent", "Clientèle fidèle de charpentiers"],
  operation: "Cession totale dans un contexte de transmission.",
  localisation: "Région Auvergne-Rhône-Alpes",
};

describe("anonymizeTeaser", () => {
  it("scrub toutes les sections, y compris une fuite dans l'accroche", () => {
    const out = anonymizeTeaser(contenuValide, forbiddenTokens("SCIERIE FOREST", "320584279"));
    expect(out.accroche).not.toMatch(/SCIERIE|FOREST/i);
    expect(out.accroche).toContain("la Société");
    // Le titre légitime (« Scierie industrielle ») est scrubé aussi : le mot
    // fait partie du nom. C'est le prix de la sécurité, l'utilisateur relit.
    expect(out.titre).not.toMatch(/scierie/i);
  });
});

describe("validateTeaserContent", () => {
  it("contenu complet accepté", () => {
    expect(validateTeaserContent(contenuValide)).not.toBeNull();
  });

  it("chiffres clés vides ou points forts absents : rejeté", () => {
    expect(validateTeaserContent({ ...contenuValide, chiffres_cles: [] })).toBeNull();
    expect(validateTeaserContent({ ...contenuValide, points_forts: [] })).toBeNull();
  });

  it("champs texte manquants : rejeté", () => {
    expect(validateTeaserContent({ ...contenuValide, operation: "" })).toBeNull();
    expect(validateTeaserContent("pas un objet")).toBeNull();
  });
});

describe("buildTeaserPrompt", () => {
  it("embarque les finances arrondies et les consignes de contexte", () => {
    const p = buildTeaserPrompt({
      company_name: "SCIERIE FOREST", siren: "320584279", ville: "CHATTE",
      sector: "Bois & Ameublement", location_region: "Auvergne-Rhône-Alpes",
      description: null, executive_summary: null, key_differentiators: null,
      deal_context: "succession", partial_sale_ok: false, management_retention: false,
      asking_price_min: 800_000, asking_price_max: 1_200_000,
      finances: [{ fiscal_year: 2024, revenue: 1_600_000, ebitda: 90_000, net_income: -984, headcount: 8 }],
      synthese_fiche: null,
    });
    expect(p).toContain("1,6 M EUR");
    expect(p).toContain("90 k EUR");
    expect(p).toContain("cession totale");
    expect(p).toContain("NE PAS le mettre dans le teaser");
  });
});
