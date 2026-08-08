import { describe, it, expect } from "vitest";
import {
  DEPARTEMENTS,
  DEPT_TO_REGION,
  REGION_TO_DEPTS,
  DEPARTEMENT_LABELS,
  isDepartementCode,
} from "@/lib/crm/departements";
import { DEPARTEMENTS_FR } from "@/lib/connectors/recherche-entreprises";
import { GEO_REGIONS_FRANCE } from "@/lib/crm/matching-maps";

describe("référentiel départements", () => {
  it("101 départements, alignés sur DEPARTEMENTS_FR (recherche-entreprises)", () => {
    expect(DEPARTEMENTS.length).toBe(101);
    const codes = new Set(DEPARTEMENTS.map((d) => d.code));
    expect(codes.size).toBe(101);
    expect(codes).toEqual(new Set(DEPARTEMENTS_FR));
  });

  it("chaque département a une région ∈ GEO_REGIONS_FRANCE", () => {
    const regions = new Set<string>(GEO_REGIONS_FRANCE as readonly string[]);
    const hors = DEPARTEMENTS.filter((d) => !regions.has(d.region)).map((d) => `${d.code}:${d.region}`);
    expect(hors).toEqual([]);
  });

  it("DEPT_TO_REGION total et cohérent (44, 75, Corse, DOM)", () => {
    expect(Object.keys(DEPT_TO_REGION).length).toBe(101);
    expect(DEPT_TO_REGION["44"]).toBe("pays_de_la_loire");
    expect(DEPT_TO_REGION["75"]).toBe("ile_de_france");
    expect(DEPT_TO_REGION["2A"]).toBe("corse");
    expect(DEPT_TO_REGION["974"]).toBe("dom_tom");
  });

  it("REGION_TO_DEPTS couvre tous les codes sans doublon", () => {
    const all = Object.values(REGION_TO_DEPTS).flat();
    expect(all.length).toBe(101);
    expect(new Set(all).size).toBe(101);
  });

  it("labels et isDepartementCode", () => {
    expect(DEPARTEMENT_LABELS["44"]).toBe("44 Loire-Atlantique");
    expect(isDepartementCode("38")).toBe(true);
    expect(isDepartementCode("2B")).toBe(true);
    expect(isDepartementCode("99")).toBe(false);
  });
});
