import { describe, it, expect } from "vitest";
import { computeIntentScore } from "@/lib/crm/intent-score";

const NOW = new Date("2026-08-20T10:00:00Z");

const inbound = (over: Partial<Parameters<typeof computeIntentScore>[0]["inbound"]> = {}) => ({
  first_reply_at: null,
  inbound_count: 0,
  last_interaction_at: null,
  thread_known: true,
  ...over,
});

describe("computeIntentScore", () => {
  it("un NDA signé avec réponse rapide et fil actif score haut", () => {
    const r = computeIntentScore({
      stage: "nda_signe",
      sent_at: "2026-08-10T09:00:00Z",
      inbound: inbound({
        first_reply_at: "2026-08-12T09:00:00Z",
        inbound_count: 3,
        last_interaction_at: "2026-08-18T09:00:00Z",
      }),
    }, NOW);
    // 35 étape + 25 réactivité (2 j) + 15 engagement + 10 fraîcheur (2 j)
    expect(r.score).toBe(85);
    expect(r.raisons.join(" ")).toContain("NDA signé");
  });

  it("teaser parti depuis plus de 14 jours sans réponse : malus silence", () => {
    const r = computeIntentScore({
      stage: "teaser_envoye",
      sent_at: "2026-08-01T09:00:00Z",
      inbound: inbound(),
    }, NOW);
    // 20 étape - 10 silence + 3 fraîcheur (19 j, < 30)
    expect(r.score).toBe(13);
    expect(r.raisons.join(" ")).toContain("-10 silence");
  });

  it("fil Gmail inconnu : les axes email sont non évalués, raison affichée", () => {
    const r = computeIntentScore({
      stage: "teaser_envoye",
      sent_at: "2026-08-18T09:00:00Z",
      inbound: inbound({ thread_known: false }),
    }, NOW);
    // 20 étape + 10 fraîcheur (2 j via sent_at), pas de malus (fil inconnu)
    expect(r.score).toBe(30);
    expect(r.raisons.join(" ")).toContain("Fil Gmail inconnu");
  });

  it("aucun envoi tracé : seule l'étape compte", () => {
    const r = computeIntentScore({ stage: "approuve", sent_at: null, inbound: inbound() }, NOW);
    expect(r.score).toBe(0);
    expect(r.raisons.join(" ")).toContain("Aucun envoi tracé");
  });

  it("offre reçue plafonne l'axe étape à 50", () => {
    const r = computeIntentScore({
      stage: "offre_recue",
      sent_at: "2026-08-10T09:00:00Z",
      inbound: inbound({ first_reply_at: "2026-08-11T09:00:00Z", inbound_count: 4, last_interaction_at: "2026-08-19T09:00:00Z" }),
    }, NOW);
    // 50 + 25 + 15 + 10 = 100 (plafond)
    expect(r.score).toBe(100);
  });

  it("le score ne descend jamais sous 0", () => {
    const r = computeIntentScore({
      stage: "teaser_envoye",
      sent_at: "2026-06-01T09:00:00Z",
      inbound: inbound(),
    }, NOW);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
