import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  // Recherche dans Drive — tous les fichiers ou par nom
  const query = q
    ? `name contains '${q.replace(/'/g, "\\'")}' and trashed=false`
    : "trashed=false";

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)&orderBy=modifiedTime desc&pageSize=30`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

  const files = (data.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    url: f.webViewLink,
    icon: f.iconLink,
    size: f.size ? Math.round(f.size / 1024) + " Ko" : null,
    type: mimeToType(f.mimeType),
  }));

  return NextResponse.json({ files });
}

function mimeToType(mime: string): string {
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "financial_model";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "pitch_deck";
  if (mime.includes("document") || mime.includes("word")) return "im";
  if (mime.includes("pdf")) return "other";
  return "other";
}
