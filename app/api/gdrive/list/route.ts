import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const query = q
    ? `name contains '${q.replace(/'/g, "\\'")}' and trashed=false`
    : "trashed=false";

  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,size)",
    orderBy: "modifiedTime desc",
    pageSize: "30",
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  
  if (data.error) {
    console.error("[Drive] Error:", data.error);
    return NextResponse.json({ error: data.error.message ?? "Erreur Drive", files: [] }, { status: 500 });
  }

  const files = (data.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    url: f.webViewLink,
    size: f.size ? Math.round(Number(f.size) / 1024) + " Ko" : null,
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
