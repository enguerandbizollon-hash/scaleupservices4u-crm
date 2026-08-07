import { describe, it, expect } from "vitest";
import {
  computeFunnelStage,
  defaultNextFollowup,
  FOLLOWUP_RULES,
  FUNNEL_STEPS,
  isOutboundStep,
  funnelStageLabel,
  funnelStepLabel,
} from "@/lib/crm/funnel";

const base = {
  status: "approved",
  teaser_sent_at: null,
  nda_signed_at: null,
  im_sent_at: null,
  offer_received_at: null,
};

describe("computeFunnelStage", () => {
  it("la date la plus avancée l'emporte, dans l'ordre du funnel", () => {
    expect(computeFunnelStage({ ...base, teaser_sent_at: "2026-08-01T10:00:00Z" })).toBe("teaser_envoye");
    expect(computeFunnelStage({ ...base, teaser_sent_at: "2026-08-01T10:00:00Z", nda_signed_at: "2026-08-05T10:00:00Z" })).toBe("nda_signe");
    expect(computeFunnelStage({ ...base, im_sent_at: "2026-08-08T10:00:00Z", nda_signed_at: "2026-08-05T10:00:00Z" })).toBe("im_envoye");
    expect(computeFunnelStage({ ...base, offer_received_at: "2026-09-01T10:00:00Z" })).toBe("offre_recue");
  });

  it("une étape peut être marquée sans les précédentes (NDA direct)", () => {
    expect(computeFunnelStage({ ...base, nda_signed_at: "2026-08-05T10:00:00Z" })).toBe("nda_signe");
  });

  it("sans date, retombe sur le statut (rétro-compat lignes d'avant v73)", () => {
    expect(computeFunnelStage({ ...base, status: "contacted" })).toBe("teaser_envoye");
    expect(computeFunnelStage({ ...base, status: "approved" })).toBe("approuve");
    expect(computeFunnelStage({ ...base, status: "suggested" })).toBe("pre_approche");
    expect(computeFunnelStage({ ...base, status: "deferred" })).toBe("pre_approche");
  });

  it("les dates priment sur le statut", () => {
    expect(computeFunnelStage({ ...base, status: "suggested", im_sent_at: "2026-08-08T10:00:00Z" })).toBe("im_envoye");
  });
});

describe("defaultNextFollowup", () => {
  const from = new Date("2026-08-01T09:00:00Z");

  it("applique les règles J+N par étape", () => {
    expect(defaultNextFollowup("teaser_envoye", from)).toBe("2026-08-08");
    expect(defaultNextFollowup("nda_signe", from)).toBe("2026-08-04");
    expect(defaultNextFollowup("im_envoye", from)).toBe("2026-08-11");
  });

  it("pas de relance après l'offre ni avant l'approche", () => {
    expect(defaultNextFollowup("offre_recue", from)).toBeNull();
    expect(defaultNextFollowup("approuve", from)).toBeNull();
    expect(defaultNextFollowup("pre_approche", from)).toBeNull();
  });

  it("les règles couvrent toutes les étapes", () => {
    for (const step of FUNNEL_STEPS) {
      expect(FOLLOWUP_RULES).toHaveProperty(step.key);
    }
  });
});

describe("isOutboundStep", () => {
  it("seuls teaser et IM sont des gestes sortants", () => {
    expect(isOutboundStep("teaser_envoye")).toBe(true);
    expect(isOutboundStep("im_envoye")).toBe(true);
    expect(isOutboundStep("nda_signe")).toBe(false);
    expect(isOutboundStep("offre_recue")).toBe(false);
  });
});

describe("libellés role-aware", () => {
  it("les mêmes dates ont des sens miroirs selon le rôle", () => {
    // Côté acquéreur : on pousse un dossier.
    expect(funnelStageLabel("teaser_envoye", "acquirer")).toBe("Teaser envoyé");
    expect(funnelStageLabel("im_envoye", "acquirer")).toBe("IM envoyé");
    expect(funnelStageLabel("offre_recue", "acquirer")).toBe("Offre reçue");
    // Côté cible : on approche pour un repreneur.
    expect(funnelStageLabel("teaser_envoye", "target")).toBe("Approchée");
    expect(funnelStageLabel("im_envoye", "target")).toBe("Infos reçues");
    expect(funnelStageLabel("offre_recue", "target")).toBe("Offre envoyée (LOI)");
  });

  it("le NDA reste le NDA dans les deux sens", () => {
    expect(funnelStageLabel("nda_signe", "acquirer")).toBe("NDA signé");
    expect(funnelStageLabel("nda_signe", "target")).toBe("NDA signé");
  });

  it("funnelStepLabel coïncide avec le libellé d'étape", () => {
    for (const s of FUNNEL_STEPS) {
      expect(funnelStepLabel(s.key, "target")).toBe(funnelStageLabel(s.key, "target"));
      expect(funnelStepLabel(s.key, "acquirer")).toBe(funnelStageLabel(s.key, "acquirer"));
    }
  });
});
