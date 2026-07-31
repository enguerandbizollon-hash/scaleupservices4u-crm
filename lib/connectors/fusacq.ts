// Connecteur Fusacq Buzz (recherche sourcing 2026-07-31, angle canaux) :
// le flux RSS public des opérations réalisées. Chaque item « X rachète Y »
// révèle un CONSOLIDATEUR actif (flux 2 de la routine : futur client
// buy-side et acquéreur potentiel pour les mandats sell-side).
//
// Flux vérifié en live le 2026-07-31 : ~40 items, titres porteurs des noms
// acquéreur/cible. L'extraction des noms est faite par IA (tier fast) chez
// l'appelant, ce module ne fait que du fetch + parse (regex : le runtime
// Node n'a pas de parseur XML natif, et un flux RSS simple ne justifie pas
// une dépendance).

const FEED_URL = "https://flux.fusacq.com/rss-fusacq-buzz-collaboratif.xml";

export interface FusacqBuzzItem {
  /** Identifiant stable : l'URL de l'article. */
  link: string;
  title: string;
  description: string;
  pub_date: string | null; // ISO
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(stripCdata(m[1].trim())) : null;
}

export function parseFusacqFeed(xml: string): FusacqBuzzItem[] {
  const items: FusacqBuzzItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const link = tag(block, "link");
    const title = tag(block, "title");
    if (!link || !title) continue;
    const rawDate = tag(block, "pubDate");
    const parsed = rawDate ? new Date(rawDate) : null;
    items.push({
      link,
      title,
      description: (tag(block, "description") ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      pub_date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null,
    });
  }
  return items;
}

export async function fetchFusacqBuzz(): Promise<FusacqBuzzItem[]> {
  const res = await fetch(FEED_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fusacq Buzz ${res.status}`);
  return parseFusacqFeed(await res.text());
}
