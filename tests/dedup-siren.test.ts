// Tests unitaires de normalizeSiren (lib/dedup/organisations.ts)
// Le SIREN est la clé pivot du pivot M&A : dédup fiable + jointure BODACC/Pappers.

import { describe, it, expect } from "vitest";
import { normalizeSiren } from "@/lib/dedup/organisations";

describe("normalizeSiren", () => {
  it("accepte un SIREN compact de 9 chiffres", () => {
    expect(normalizeSiren("123456789")).toBe("123456789");
  });

  it("retire les espaces du format lisible", () => {
    expect(normalizeSiren("123 456 789")).toBe("123456789");
    expect(normalizeSiren("  123456789  ")).toBe("123456789");
  });

  it("retire la ponctuation et un préfixe textuel", () => {
    expect(normalizeSiren("123.456.789")).toBe("123456789");
    expect(normalizeSiren("SIREN 123456789")).toBe("123456789");
  });

  it("rejette un numéro trop court", () => {
    expect(normalizeSiren("12345678")).toBeNull();
  });

  it("rejette un SIRET (14 chiffres) — ce n'est pas un SIREN", () => {
    expect(normalizeSiren("12345678900012")).toBeNull();
  });

  it("rejette les entrées vides ou non numériques", () => {
    expect(normalizeSiren(null)).toBeNull();
    expect(normalizeSiren(undefined)).toBeNull();
    expect(normalizeSiren("")).toBeNull();
    expect(normalizeSiren("ABCDEFGHI")).toBeNull();
  });

  it("est idempotent", () => {
    const once = normalizeSiren("123 456 789");
    expect(normalizeSiren(once)).toBe(once);
  });
});
