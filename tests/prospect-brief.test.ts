// Tests du brief prospect 360 (Deal OS, B2) : construction du prompt et
// parsing tolérant de la réponse JSON de l'IA.

import { describe, it, expect } from "vitest";
import { buildProspectPrompt, parseProspectBrief } from "@/lib/ai/prospect-brief";

const input = {
  nom: "SCIERIE FOREST",
  siren: "320584279",
  naf: "16.10A",
  secteur: "Bois & Ameublement",
  ville: "CHATTE",
  departement: "38",
  date_creation: "1980-05-01",
  effectif_label: "6 à 9 salariés",
  finances: { "2024": { ca: 1_600_000, resultat_net: -984, ebitda: 90_000 } },
  dirigeants: [
    { nom: "ADAM", prenoms: "OLIVIER", qualite: "Directeur Général" },
    { nom: "ADAM", prenoms: "ROMAIN", qualite: "Président de SAS" },
  ],
  actionnariat: [{ nom: "ADAM", prenom: "ROMAIN", age: 42, pourcentage_parts: 60 }],
  cedabilite_raisons: ["Relève familiale probable : ROMAIN ADAM (42 ans) aux commandes"],
  signaux: [{ signal_type: "depot_comptes", signal_date: "2026-07-01", titre: "Dépôt des comptes 2025" }],
};

describe("buildProspectPrompt", () => {
  it("embarque l'identité, les finances, l'actionnariat et le radar", () => {
    const p = buildProspectPrompt(input);
    expect(p).toContain("SCIERIE FOREST");
    expect(p).toContain("320584279");
    expect(p).toContain("1.6M EUR");
    expect(p).toContain("EBITDA 90k EUR");
    expect(p).toContain("ROMAIN ADAM : 60%");
    expect(p).toContain("Relève familiale probable");
    expect(p).toContain("depot_comptes");
  });

  it("nomme explicitement les absences plutôt que de les taire", () => {
    const p = buildProspectPrompt({ ...input, finances: {}, actionnariat: null, dirigeants: [] });
    expect(p).toContain("Finances publiées : aucune");
    expect(p).toContain("Actionnariat : non disponible");
    expect(p).toContain("Dirigeants : non renseignés");
  });
});

describe("parseProspectBrief", () => {
  const synthese = "Activité\nScierie familiale iséroise spécialisée dans le sciage de résineux pour la charpente.";

  it("JSON nu valide", () => {
    const r = parseProspectBrief(JSON.stringify({ website: "https://scierie-forest.fr", synthese }));
    expect(r).not.toBeNull();
    expect(r!.website).toBe("https://scierie-forest.fr");
    expect(r!.synthese).toContain("Scierie familiale");
  });

  it("JSON entouré de code fences ou de texte : toléré", () => {
    const r = parseProspectBrief("Voici la fiche :\n```json\n" + JSON.stringify({ website: null, synthese }) + "\n```");
    expect(r).not.toBeNull();
    expect(r!.website).toBeNull();
  });

  it("website non http rejeté en null, synthèse conservée", () => {
    const r = parseProspectBrief(JSON.stringify({ website: "scierie-forest.fr", synthese }));
    expect(r!.website).toBeNull();
  });

  it("synthèse trop courte ou absente : null", () => {
    expect(parseProspectBrief(JSON.stringify({ website: null, synthese: "trop court" }))).toBeNull();
    expect(parseProspectBrief("pas du json")).toBeNull();
  });
});
