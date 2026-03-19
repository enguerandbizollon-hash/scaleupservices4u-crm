"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Stats = {
  deals: number;
  contacts: number;
  orgs: number;
};

const SUGGESTIONS = [
  "Rédige un email de relance pour un investisseur qui n'a pas répondu depuis 2 semaines",
  "Génère un email d'introduction pour présenter Redpeaks à un family office",
  "Aide-moi à qualifier un nouveau contact investisseur",
  "Quels éléments clés inclure dans un teaser M&A sell-side ?",
];

export function AIChat({ stats }: { stats: Stats }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          stats,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion. Réessaie." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col p-8 pt-6">
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Module CRM</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Assistant IA</h1>
        <p className="mt-1 text-sm text-slate-500">
          {stats.deals} dossiers · {stats.contacts} contacts · {stats.orgs} organisations
        </p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F1B2D]">
              <Bot size={24} className="text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900">Comment puis-je t'aider ?</p>
              <p className="mt-1 text-sm text-slate-500">Rédaction d'emails, analyse de dossiers, qualification de contacts…</p>
            </div>
            <div className="grid gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-[#0F1B2D]" : "bg-slate-100"}`}>
                  {m.role === "user"
                    ? <User size={14} className="text-white" />
                    : <Bot size={14} className="text-slate-600" />
                  }
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-[#0F1B2D] text-white" : "bg-[#F5F0E8] text-[#0F1B2D] border border-[#E8E0D0]"}`}>
                  <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Loader2 size={14} className="text-slate-600 animate-spin" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  En train de rédiger…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Pose une question ou demande de l'aide…"
          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
          disabled={loading}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          <Send size={15} />
          Envoyer
        </button>
      </div>
    </div>
  );
}
