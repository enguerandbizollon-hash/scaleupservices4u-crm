"use client";
import { useState } from "react";
import { X, Mail, Users, User } from "lucide-react";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  org_name?: string;
}
interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
}

interface Props {
  task: Task;
  contacts: Contact[];
  onClose: () => void;
}

export function MailTaskModal({ task, contacts, onClose }: Props) {
  const withEmail = contacts.filter(c => c.email);
  const [selected, setSelected] = useState<string[]>(withEmail.map(c => c.id));
  const [mode, setMode] = useState<"grouped"|"separate">("separate");

  function toggle(id: string) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  const chosenContacts = withEmail.filter(c => selected.includes(c.id));

  function buildMailto() {
    const emails = chosenContacts.map(c => c.email!);
    const subject = encodeURIComponent(`[Action] ${task.title}`);
    const body = encodeURIComponent(`Bonjour,\n\nJe reviens vers vous concernant : ${task.title}.\n\n${task.description || ""}\n\nCordialement`);
    if (mode === "grouped") {
      return `mailto:${emails.join(",")}?subject=${subject}&body=${body}`;
    }
    return emails.map(e => `mailto:${e}?subject=${subject}&body=${body}`).join("|");
  }

  function handleSend() {
    if (chosenContacts.length === 0) return;
    if (mode === "grouped") {
      window.open(buildMailto());
    } else {
      // Ouvrir un mail par contact
      const emails = chosenContacts.map(c => c.email!);
      const subject = encodeURIComponent(`[Action] ${task.title}`);
      const body = encodeURIComponent(`Bonjour,\n\nJe reviens vers vous concernant : ${task.title}.\n\n${task.description || ""}\n\nCordialement`);
      emails.forEach((email, i) => {
        setTimeout(() => {
          window.open(`mailto:${email}?subject=${subject}&body=${body}`);
        }, i * 300);
      });
    }
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border-2)", borderRadius:16, padding:24, width:"100%", maxWidth:440 }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Mail size={16} color="#1a56db"/>
            <span style={{ fontSize:15, fontWeight:700, color:"var(--text-1)" }}>Email — {task.title}</span>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-4)" }}><X size={15}/></button>
        </div>

        {withEmail.length === 0 ? (
          <div style={{ fontSize:13, color:"var(--text-4)", textAlign:"center", padding:"20px 0" }}>
            Aucun contact avec email dans ce dossier.
          </div>
        ) : (
          <>
            {/* Mode */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--text-4)", marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>Mode d'envoi</div>
              <div style={{ display:"flex", gap:8 }}>
                {[
                  { value:"separate", label:"Mails séparés", icon:User, desc:"Un mail par contact" },
                  { value:"grouped",  label:"Mail groupé",   icon:Users, desc:"Tous en destinataires" },
                ].map(m => (
                  <button key={m.value} onClick={() => setMode(m.value as any)}
                    style={{ flex:1, padding:"10px 12px", borderRadius:9, border:`1.5px solid ${mode===m.value?"#1a56db":"var(--border)"}`, background:mode===m.value?"#eff6ff":"var(--surface-2)", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <m.icon size={12} color={mode===m.value?"#1a56db":"var(--text-4)"}/>
                      <span style={{ fontSize:13, fontWeight:600, color:mode===m.value?"#1a56db":"var(--text-2)" }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize:11.5, color:"var(--text-5)" }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sélection contacts */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--text-4)", marginBottom:8, textTransform:"uppercase", letterSpacing:".05em" }}>Destinataires</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {withEmail.map(c => (
                  <label key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, border:`1px solid ${selected.includes(c.id)?"#1a56db":"var(--border)"}`, background:selected.includes(c.id)?"#eff6ff":"var(--surface-2)", cursor:"pointer" }}>
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} style={{ accentColor:"#1a56db" }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize:11.5, color:"var(--text-5)" }}>{c.email}{c.org_name ? ` · ${c.org_name}` : ""}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={onClose} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface-2)", color:"var(--text-3)", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>Annuler</button>
              <button onClick={handleSend} disabled={chosenContacts.length === 0}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:8, background:chosenContacts.length>0?"#1a56db":"var(--surface-3)", color:chosenContacts.length>0?"#fff":"var(--text-5)", border:"none", fontSize:13, fontWeight:600, cursor:chosenContacts.length>0?"pointer":"default", fontFamily:"inherit" }}>
                <Mail size={13}/>
                Ouvrir {mode==="separate" && chosenContacts.length>1 ? `${chosenContacts.length} mails` : "le mail"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
