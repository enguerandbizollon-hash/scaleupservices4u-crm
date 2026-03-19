import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { files, deal_id } = await req.json() as {
    files: Array<{ id: string; name: string; url: string; type: string }>;
    deal_id: string;
  };

  if (!files?.length || !deal_id) return NextResponse.json({ imported: 0, errors: ["Fichiers ou dossier manquant"] });

  let imported = 0;
  const errors: string[] = [];

  for (const file of files) {
    const { error } = await supabase.from("deal_documents").insert({
      name: file.name,
      deal_id,
      document_type: file.type,
      document_status: "received",
      document_url: file.url,
      user_id: user.id,
    });

    if (error) errors.push(`${file.name}: ${error.message}`);
    else imported++;
  }

  return NextResponse.json({ imported, errors, total: files.length });
}
