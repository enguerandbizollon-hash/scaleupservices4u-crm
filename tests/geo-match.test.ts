import { describe, it, expect } from "vitest";
import { geoIsCompatible, geoCompatiblePair, expandGeo } from "@/lib/crm/geo-match";

describe("geo-match — pont département <-> région <-> France", () => {
  it("un département matche sa région et la France", () => {
    expect(geoIsCompatible("44", ["pays_de_la_loire"])).toBe(true);
    expect(geoIsCompatible("44", ["france"])).toBe(true);
    expect(geoIsCompatible("75", ["ile_de_france"])).toBe(true);
  });

  it("une région matche ses départements et la France", () => {
    expect(geoIsCompatible("pays_de_la_loire", ["44"])).toBe(true);
    expect(geoIsCompatible("france", ["44"])).toBe(true);
    expect(geoIsCompatible("ile_de_france", ["france"])).toBe(true);
  });

  it("deux zones sans lien ne matchent pas", () => {
    expect(geoIsCompatible("44", ["bretagne"])).toBe(false);
    expect(geoIsCompatible("13", ["ile_de_france"])).toBe(false);
    expect(geoIsCompatible("44", ["35"])).toBe(false);
  });

  it("DOM et Corse", () => {
    expect(geoIsCompatible("971", ["dom_tom"])).toBe(true);
    expect(geoIsCompatible("2A", ["corse"])).toBe(true);
    expect(geoIsCompatible("2A", ["france"])).toBe(true);
  });

  it("critères vides ou valeur nulle", () => {
    expect(geoIsCompatible("44", [])).toBe(false);
    expect(geoIsCompatible(null, ["france"])).toBe(false);
  });

  it("expandGeo et geoCompatiblePair", () => {
    expect(expandGeo("44")).toEqual(expect.arrayContaining(["44", "pays_de_la_loire", "france"]));
    expect(expandGeo("pays_de_la_loire")).toContain("44");
    expect(expandGeo("france")).toContain("44");
    expect(geoCompatiblePair("44", "44")).toBe(true);
    expect(geoCompatiblePair("44", "bretagne")).toBe(false);
  });
});
