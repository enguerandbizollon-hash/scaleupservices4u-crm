import { NextRequest, NextResponse } from "next/server";

// OAuth2 Google : le SEUL flux de consentement de l'outil (NextAuth a été
// supprimé). Les 4 scopes sont listés explicitement : avec prompt=consent,
// le refresh token émis est limité aux scopes demandés ICI, en omettre un
// casserait la fonctionnalité correspondante à la reconnexion.
// - calendar.events : agenda (events, invitations)
// - drive.readonly  : import Google Drive
// - gmail.readonly  : ingestion des emails (boîte de tri, classification)
// - gmail.compose   : brouillons Gmail (funnel acquéreur), jamais d'envoi
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID manquant dans .env.local" }, { status: 500 });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/gcal/callback`;
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/calendar.events " +
    "https://www.googleapis.com/auth/drive.readonly " +
    "https://www.googleapis.com/auth/gmail.readonly " +
    "https://www.googleapis.com/auth/gmail.compose"
  );
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(url);
}
