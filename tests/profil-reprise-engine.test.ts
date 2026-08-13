import { describe, it, expect } from "vitest";
import {
  buildProfilReprisePrompt,
  validateProfilRepriseContent,
  anonymizeProfilReprise,
  type ProfilRepriseContent,
} from "@/lib/ai/profil-reprise-engine";
import { forbiddenTokens } from "@/lib/ai/teaser-engine";

const CONTENT: ProfilRepriseContent = {
  titre: "Repreneur individuel, services B2B, région lyonnaise",
  accroche: "Damien ROUSSON, accompagné par Vectis Finance, recherche une entreprise à reprendre.",
  profil: "ROUSSON a dirigé une PME de services pendant dix ans.",
  projet: "Reprendre et développer l'entreprise dans la continuité.",
  criteres: [{ label: "CA cible", valeur: "500 k EUR à 1,5 M EUR" }],
  capacite: "Apport de 300 k EUR, complété par un financement bancaire.",
  demarche: "Échange confidentiel sans engagement, puis NDA.",
};

describe("validateProfilRepriseContent", () => {
  it("valide un contenu complet", () => {
    expect(validateProfilRepriseContent(CONTENT)).not.toBeNull();
  });
  it("refuse un contenu sans critères ou sans champ narratif", () => {
    expect(validateProfilRepriseContent({ ...CONTENT, criteres: [] })).toBeNull();
    expect(validateProfilRepriseContent({ ...CONTENT, profil: "  " })).toBeNull();
    expect(validateProfilRepriseContent(null)).toBeNull();
  });
});

describe("anonymizeProfilReprise", () => {
  it("scrubbe le nom du repreneur partout, remplacé par « le Repreneur »", () => {
    const tokens = forbiddenTokens("Damien ROUSSON", null);
    const a = anonymizeProfilReprise(CONTENT, tokens);
    const all = JSON.stringify(a).toLowerCase();
    expect(all).not.toContain("rousson");
    expect(all).not.toContain("damien");
    expect(a.profil).toContain("le Repreneur");
  });
});

describe("buildProfilReprisePrompt", () => {
  it("porte la matière du mandat et marque le nom comme interdit", () => {
    const p = buildProfilReprisePrompt({
      repreneur_nom: "Damien ROUSSON",
      projet: "Reprendre une PME de services.",
      secteurs: ["Génie climatique / CVC"],
      geographies: ["38 Isère", "69 Rhône"],
      ca_min: 500_000,
      ca_max: 1_500_000,
      apport: 300_000,
      budget_max: null,
      full_acquisition: true,
      management_retention: true,
      deal_timing: "0 à 6 mois",
    });
    expect(p).toContain("INTERDIT dans le rendu");
    expect(p).toContain("Damien ROUSSON");
    expect(p).toContain("Génie climatique / CVC");
    expect(p).toContain("38 Isère");
    expect(p).toContain("500 k EUR");
    expect(p).toContain("1,5 M EUR");
    expect(p).toContain("majoritaire");
  });

  it("omet les lignes sans matière (rien ne s'invente)", () => {
    const p = buildProfilReprisePrompt({
      repreneur_nom: null, projet: null, secteurs: [], geographies: [],
      ca_min: null, ca_max: null, apport: null, budget_max: null,
      full_acquisition: null, management_retention: null, deal_timing: null,
    });
    expect(p).not.toContain("Secteurs visés");
    expect(p).not.toContain("Apport");
    expect(p).toContain("personne physique accompagnée par Vectis Finance");
  });
});
