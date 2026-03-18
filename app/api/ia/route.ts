import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { messages, stats } = await request.json();

    const systemPrompt = `Tu es un assistant CRM spécialisé en M&A, venture et advisory pour Scale Up Services 4U.
      
État actuel de la base :
- ${stats.deals} dossiers
- ${stats.contacts} contacts  
- ${stats.orgs} organisations

Tu peux aider à :
- Rédiger des emails professionnels (relance investisseurs, introduction, suivi)
- Analyser et qualifier des opportunités
- Structurer des informations sur des dossiers
- Conseiller sur la priorisation du pipeline

Réponds toujours en français. Sois direct, professionnel et concis.
Pour les emails, fournis directement le texte prêt à envoyer avec objet et corps.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "Erreur.";
    return NextResponse.json({ text });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
