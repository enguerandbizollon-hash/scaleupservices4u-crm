import { describe, it, expect } from "vitest";
import { buildRawMessage } from "@/lib/gmail/gmail-client";

describe("buildRawMessage", () => {
  it("construit un message text/plain minimal", () => {
    const raw = buildRawMessage({
      to: ["jean.dupont@example.fr"],
      subject: "Opportunite de reprise",
      body: "Bonjour,\n\nMessage de test.",
    });
    const lines = raw.split("\r\n");
    expect(lines[0]).toBe("To: jean.dupont@example.fr");
    expect(lines[1]).toBe("Subject: Opportunite de reprise");
    expect(raw).toContain("Content-Type: text/plain; charset=utf-8");
    expect(raw.endsWith("Message de test.")).toBe(true);
    // Corps séparé des en-têtes par une ligne vide
    expect(raw).toContain("\r\n\r\nBonjour,");
  });

  it("encode les sujets accentués en RFC 2047", () => {
    const raw = buildRawMessage({
      to: ["a@b.fr"],
      subject: "Opportunité de cession confidentielle",
      body: "x",
    });
    const subjectLine = raw.split("\r\n").find(l => l.startsWith("Subject:"))!;
    expect(subjectLine).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    const b64 = subjectLine.match(/\?B\?([A-Za-z0-9+/=]+)\?=/)![1];
    expect(Buffer.from(b64, "base64").toString("utf8")).toBe("Opportunité de cession confidentielle");
  });

  it("accroche la relance au fil : In-Reply-To et References", () => {
    const raw = buildRawMessage({
      to: ["a@b.fr"],
      subject: "Re: Teaser",
      body: "Relance",
      inReplyTo: "<abc123@mail.gmail.com>",
      references: "<abc123@mail.gmail.com>",
    });
    expect(raw).toContain("In-Reply-To: <abc123@mail.gmail.com>");
    expect(raw).toContain("References: <abc123@mail.gmail.com>");
  });

  it("plusieurs destinataires séparés par des virgules", () => {
    const raw = buildRawMessage({ to: ["a@b.fr", "c@d.fr"], subject: "x", body: "y" });
    expect(raw).toContain("To: a@b.fr, c@d.fr");
  });
});
