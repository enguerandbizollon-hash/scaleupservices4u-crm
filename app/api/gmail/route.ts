import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "list";

  try {
    if (action === "list") {
      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:inbox",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "get") {
      const id = searchParams.get("id");
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.access_token;
  if (!token) return NextResponse.json({ error: "Non connecté à Google" }, { status: 401 });

  const { to, subject, body } = await req.json();

  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\n");

  const encoded = Buffer.from(email).toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
  const data = await res.json();
  return NextResponse.json(data);
}
