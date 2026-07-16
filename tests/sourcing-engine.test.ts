// Tests unitaires lib/sourcing/engine.ts
// Clé de dédup, fusion cross-source des candidats et score algo rapide.

import { describe, it, expect } from "vitest";
import type { SourcingSegment } from "@/lib/ai/sourcing-strategy";
import {
  computeUniqueKey,
  dedupCandidates,
  computeQuickAlgoScore,
  type SourcingCandidate,
  type SourcingCandidateContact,
  type SourcingExecutionContext,
} from "@/lib/sourcing/engine";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContact(overrides: Partial<SourcingCandidateContact> = {}): SourcingCandidateContact {
  return {
    contact_id: null,
    first_name: "Jane",
    last_name: "Doe",
    email: null,
    title: null,
    linkedin_url: null,
    source: "apollo",
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<SourcingCandidate> = {}): SourcingCandidate {
  return {
    unique_key: "domain:acme.com",
    name: "Acme",
    website: null,
    linkedin_url: null,
    normalized_name: "acme",
    domain: "acme.com",
    organization_type: null,
    sector: null,
    location: null,
    description: null,
    employee_count: null,
    existing_org_id: null,
    apollo_id: null,
    harmonic_id: null,
    sources: ["apollo"],
    segment_name: "Segment A",
    segment_priority: 2,
    contacts: [],
    ...overrides,
  };
}

function makeSegment(overrides: Partial<SourcingSegment> = {}): SourcingSegment {
  return {
    name: "PE mid-market",
    priority: 1,
    actor_type: "private_equity",
    keywords: [],
    geographies: [],
    employee_min: null,
    employee_max: null,
    rationale: "test",
    ...overrides,
  };
}

function makeContext(overrides: Partial<SourcingExecutionContext> = {}): SourcingExecutionContext {
  return {
    userId: "u1",
    dealId: "d1",
    dealType: "ma_sell",
    currency: "EUR",
    dealSector: null,
    dealGeography: null,
    latestRevenue: null,
    targetSectors: null,
    excludedSectors: null,
    ...overrides,
  };
}

// ── computeUniqueKey ─────────────────────────────────────────────────────────

describe("computeUniqueKey", () => {
  it("priorité 1 : apollo_id même si domaine et nom présents", () => {
    expect(computeUniqueKey("acme", "ap-123", "acme.com")).toBe("apollo:ap-123");
  });

  it("priorité 2 : domaine si pas d'apollo_id", () => {
    expect(computeUniqueKey("acme", null, "acme.com")).toBe("domain:acme.com");
  });

  it("priorité 3 : nom normalisé si ni apollo_id ni domaine", () => {
    expect(computeUniqueKey("acme", null, null)).toBe("name:acme");
  });

  it("fallback : clé raw aléatoire si tout est vide (jamais de collision déterministe)", () => {
    const a = computeUniqueKey("", null, null);
    const b = computeUniqueKey("", null, null);
    expect(a.startsWith("raw:")).toBe(true);
    expect(b.startsWith("raw:")).toBe(true);
    expect(a).not.toBe(b);
  });
});

// ── dedupCandidates ──────────────────────────────────────────────────────────

describe("dedupCandidates", () => {
  it("fusionne les candidats cross-source partageant la même unique_key", () => {
    const crm = makeCandidate({
      sources: ["crm"],
      existing_org_id: "org-1",
      sector: "Fintech",
      website: null,
      contacts: [makeContact({ email: "jane@acme.com", source: "crm" })],
    });
    const apollo = makeCandidate({
      sources: ["apollo"],
      apollo_id: "ap-1",
      sector: "SaaS",
      website: "https://acme.com",
      segment_name: "Segment prioritaire",
      segment_priority: 1,
      contacts: [
        makeContact({ email: "JANE@ACME.COM" }),               // doublon (email, casse différente)
        makeContact({ first_name: "John", last_name: "Smith", email: "john@acme.com" }),
      ],
    });

    const result = dedupCandidates([crm, apollo]);
    expect(result).toHaveLength(1);

    const merged = result[0];
    expect([...merged.sources].sort()).toEqual(["apollo", "crm"]);
    // Champs : premier non-null conservé
    expect(merged.existing_org_id).toBe("org-1");
    expect(merged.apollo_id).toBe("ap-1");
    expect(merged.sector).toBe("Fintech");          // valeur du premier candidat conservée
    expect(merged.website).toBe("https://acme.com"); // null comblé par le second
    // Segment : la priorité la plus basse (la plus haute) gagne
    expect(merged.segment_priority).toBe(1);
    expect(merged.segment_name).toBe("Segment prioritaire");
    // Contacts : dédupliqués par email insensible à la casse, pas de doublon
    expect(merged.contacts).toHaveLength(2);
    expect(merged.contacts.filter(c => c.email?.toLowerCase() === "jane@acme.com")).toHaveLength(1);
    expect(merged.contacts.some(c => c.email === "john@acme.com")).toBe(true);
  });

  it("ne fusionne pas des unique_key différentes", () => {
    const a = makeCandidate({ unique_key: "domain:acme.com" });
    const b = makeCandidate({ unique_key: "domain:globex.com", name: "Globex" });
    expect(dedupCandidates([a, b])).toHaveLength(2);
  });

  it("déduplique les contacts sans email par prénom + nom (insensible à la casse)", () => {
    const a = makeCandidate({ contacts: [makeContact({ first_name: "Jane", last_name: "Doe" })] });
    const b = makeCandidate({
      sources: ["crm"],
      contacts: [
        makeContact({ first_name: "JANE", last_name: "DOE" }),  // doublon par nom
        makeContact({ first_name: "Bob", last_name: "Roe" }),
      ],
    });
    const result = dedupCandidates([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].contacts).toHaveLength(2);
  });

  it("limite les contacts fusionnés à 3", () => {
    const a = makeCandidate({
      contacts: [
        makeContact({ email: "a@acme.com" }),
        makeContact({ email: "b@acme.com" }),
      ],
    });
    const b = makeCandidate({
      contacts: [
        makeContact({ email: "c@acme.com" }),
        makeContact({ email: "d@acme.com" }),
      ],
    });
    const result = dedupCandidates([a, b]);
    expect(result[0].contacts).toHaveLength(3);
  });

  it("ne mute pas les candidats d'entrée lors de la fusion", () => {
    const a = makeCandidate({ contacts: [makeContact({ email: "a@acme.com" })] });
    const b = makeCandidate({ sources: ["crm"], contacts: [makeContact({ email: "b@acme.com" })] });
    dedupCandidates([a, b]);
    expect(a.contacts).toHaveLength(1);
    expect(a.sources).toEqual(["apollo"]);
  });
});

// ── computeQuickAlgoScore ────────────────────────────────────────────────────

describe("computeQuickAlgoScore", () => {
  it("retourne 0 si le secteur du candidat est exclu (drop-dead)", () => {
    const candidate = makeCandidate({
      sector: "Fintech",
      employee_count: 100,
      location: "Paris, France",
      sources: ["crm", "apollo"],
      description: "Une description largement assez longue pour dépasser soixante caractères.",
      contacts: [makeContact({ email: "jane@acme.com" })],
    });
    const score = computeQuickAlgoScore(
      candidate,
      makeSegment({ keywords: ["fintech"] }),
      makeContext({ excludedSectors: ["FINTECH"] }),  // insensible à la casse
    );
    expect(score).toBe(0);
  });

  it("cas de match complet : 30+20+15+10+10+5+10 = 100", () => {
    const candidate = makeCandidate({
      sector: "Fintech",
      employee_count: 100,
      location: "Paris, France",
      sources: ["crm", "apollo"],
      description: "Plateforme fintech de paiement B2B pour les PME européennes en croissance.",
      contacts: [makeContact({ email: "jane@acme.com" })],
    });
    const segment = makeSegment({
      keywords: ["fintech"],
      geographies: ["france"],
      employee_min: 10,
      employee_max: 500,
    });
    expect(computeQuickAlgoScore(candidate, segment, makeContext())).toBe(100);
  });

  it("candidat minimal avec segment sans critères : 15 (keywords vides) + 8 (taille inconnue) + 6 (géo inconnue) = 29", () => {
    expect(computeQuickAlgoScore(makeCandidate(), makeSegment(), makeContext())).toBe(29);
  });

  it("secteur présent mais aucun mot-clé matché : 8 + 8 + 6 = 22", () => {
    const candidate = makeCandidate({ sector: "Industrie" });
    const segment = makeSegment({ keywords: ["fintech"] });
    expect(computeQuickAlgoScore(candidate, segment, makeContext())).toBe(22);
  });

  it("géographie non matchée : 3 pts au lieu de 15", () => {
    const candidate = makeCandidate({ sector: "Fintech", location: "Tokyo, Japan" });
    const segment = makeSegment({ keywords: ["fintech"], geographies: ["france"] });
    // 30 (keyword) + 8 (taille inconnue) + 3 (géo mismatch) = 41
    expect(computeQuickAlgoScore(candidate, segment, makeContext())).toBe(41);
  });

  it("taille hors fourchette : 5 pts au lieu de 20", () => {
    const candidate = makeCandidate({ sector: "Fintech", employee_count: 5000 });
    const segment = makeSegment({ keywords: ["fintech"], employee_min: 10, employee_max: 500 });
    // 30 + 5 + 6 (pas de localisation) = 41
    expect(computeQuickAlgoScore(candidate, segment, makeContext())).toBe(41);
  });

  it("le mot-clé peut matcher dans le nom ou la description, pas seulement le secteur", () => {
    const candidate = makeCandidate({ name: "Fintech Partners" });
    const segment = makeSegment({ keywords: ["fintech"] });
    // 30 + 8 + 6 = 44
    expect(computeQuickAlgoScore(candidate, segment, makeContext())).toBe(44);
  });
});
