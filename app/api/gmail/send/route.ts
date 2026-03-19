import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const { to, subject, body } = await req.json();
  if (!to || !subject || !body) return NextResponse.json({ error: "Champs manquants" }, { status: 400 });

  const message = `To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=utf-8\n\n${body}`;
  const raw = Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json();
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}
