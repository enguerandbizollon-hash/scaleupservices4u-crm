// Connecteurs du sprint signaux (recherche sourcing 2026-07-31) :
// parsing du flux Fusacq Buzz, groupement RGE par SIREN, barème rge_expire.

import { describe, it, expect } from "vitest";
import { parseFusacqFeed } from "@/lib/connectors/fusacq";
import { groupRgeBySiren, type RgeExpiredRow } from "@/lib/connectors/rge";
import { computeCedabilite } from "@/lib/crm/cedabilite";

describe("parseFusacqFeed", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Fusacq Buzz</title>
<item>
  <title><![CDATA[AVANTIS COOP&#39;RATIVE met la main sur TRANSPORT JULES LANGLAIS]]></title>
  <link>http://www.fusacq.com/buzz/avantis-a260141.html</link>
  <pubDate>Fri, 31 Jul 2026 11:00:31 +0200</pubDate>
  <description><![CDATA[<p>Cette op&amp;eacute;ration renforce Avantis dans le transport laitier</p>]]></description>
</item>
<item>
  <title>Sans lien : ignoré</title>
</item>
</channel></rss>`;

  it("extrait titre, lien, date ISO et description sans balises", () => {
    const items = parseFusacqFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].link).toBe("http://www.fusacq.com/buzz/avantis-a260141.html");
    expect(items[0].title).toContain("AVANTIS");
    expect(items[0].pub_date).toBe("2026-07-31");
    expect(items[0].description).not.toContain("<p>");
  });

  it("flux vide ou HTML : aucun item, pas d'exception", () => {
    expect(parseFusacqFeed("<html>pas un flux</html>")).toEqual([]);
  });
});

describe("groupRgeBySiren", () => {
  const row = (siret: string, fin: string, domaine: string): RgeExpiredRow => ({
    siret,
    siren: siret.slice(0, 9),
    nom_entreprise: "MENUISERIE TEST",
    domaine,
    lien_date_fin: fin,
    commune: "LYON",
    code_postal: "69001",
  });

  it("plusieurs qualifications d'un même SIREN donnent UN groupe, date la plus récente", () => {
    const grouped = groupRgeBySiren([
      row("12345678900011", "2026-06-01", "Fenêtres"),
      row("12345678900011", "2026-06-15", "Isolation"),
      row("98765432100022", "2026-05-30", "Chauffage"),
    ]);
    expect(grouped).toHaveLength(2);
    const g = grouped.find((x) => x.siren === "123456789");
    expect(g?.derniere_fin).toBe("2026-06-15");
    expect(g?.domaines).toEqual(["Fenêtres", "Isolation"]);
  });
});

describe("computeCedabilite : rge_expire", () => {
  const fiche = {
    age_dirigeant_principal: 63,
    date_creation: "1995-01-01",
    finances: { "2024": { ca: 1_200_000, resultat_net: 90_000 } },
  };

  it("RGE non renouvelé ajoute +6 avec sa raison", () => {
    const sans = computeCedabilite(fiche, { types: [] });
    const avec = computeCedabilite(fiche, { types: ["rge_expire"] });
    expect(avec.score - sans.score).toBe(6);
    expect(avec.raisons.some((r) => r.includes("RGE"))).toBe(true);
  });
});
