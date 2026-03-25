"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Quels sont mes dossiers actifs ?",
  "Quels contacts dois-je relancer cette semaine ?",
  "Crée une tâche de relance pour demain",
  "Résume les dernières activités",
];

export default function IAPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", text: msg };
    setMessages(p => [...p, userMsg]);
    setLoading(true);

    try {
      // Charger les stats CRM
      const statsRes = await fetch("/api/ia/stats");
      const stats = statsRes.ok ? await statsRes.json() : { deals:0, contacts:0, orgs:0 };

      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, stats }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(p => [...p, { role: "assistant", text: data.text }]);
    } catch(e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setMessages(p => [...p, { role: "assistant", text: `❌ Erreur : ${errorMessage}` }]);
    } finally {
      setLoading(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 0px)", background:"var(--bg)" }}>

      {/* Header */}
      <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border)", background:"var(--surface)", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ width:32, height:32, borderRadius:9, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Sparkles size={15} color="var(--text-3)"/>
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Assistant CRM</div>
          <div style={{ fontSize:12, color:"var(--text-5)" }}>Analyse, rédige, crée des tâches et activités</div>
        </div>
        <button onClick={() => setMessages([])} style={{ marginLeft:"auto", fontSize:12, color:"var(--text-5)", background:"none", border:"none", cursor:"pointer" }}>
          Effacer
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
        {empty && (
          <div style={{ textAlign:"center", paddingTop:40 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🤖</div>
            <div style={{ fontSize:15, fontWeight:600, color:"var(--text-2)", marginBottom:6 }}>Comment puis-je vous aider ?</div>
            <div style={{ fontSize:13, color:"var(--text-5)", marginBottom:24 }}>Je peux analyser vos dossiers, contacts et créer des tâches directement.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding:"8px 14px", borderRadius:20, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-3)", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{ width:28, height:28, borderRadius:8, background: m.role === "user" ? "#1a56db" : "var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {m.role === "user" ? <User size={13} color="#fff"/> : <Bot size={13} color="var(--text-3)"/>}
            </div>
            <div style={{
              maxWidth:"75%", padding:"10px 14px", borderRadius: m.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
              background: m.role === "user" ? "#1a56db" : "var(--surface)",
              border: m.role === "user" ? "none" : "1px solid var(--border)",
              color: m.role === "user" ? "#fff" : "var(--text-1)",
              fontSize:13.5, lineHeight:1.6, whiteSpace:"pre-wrap",
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"var(--surface-3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Bot size={13} color="var(--text-3)"/>
            </div>
            <div style={{ padding:"10px 14px", borderRadius:"4px 14px 14px 14px", background:"var(--surface)", border:"1px solid var(--border)", display:"flex", gap:6, alignItems:"center" }}>
              <Loader2 size={13} color="var(--text-4)" className="animate-spin"/>
              <span style={{ fontSize:13, color:"var(--text-4)" }}>Réflexion en cours…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)", background:"var(--surface)", flexShrink:0 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Posez une question ou donnez une instruction… (Entrée pour envoyer)"
            rows={1}
            style={{
              flex:1, padding:"10px 14px", border:"1px solid var(--border)", borderRadius:10,
              background:"var(--surface-2)", color:"var(--text-1)", fontSize:13.5,
              fontFamily:"inherit", outline:"none", resize:"none", lineHeight:1.5,
            }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            style={{ width:40, height:40, borderRadius:10, background: input.trim() && !loading ? "#1a56db" : "var(--surface-3)", border:"none", cursor: input.trim() && !loading ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Send size={15} color={input.trim() && !loading ? "#fff" : "var(--text-5)"}/>
          </button>
        </div>
      </div>
    </div>
  );
}
