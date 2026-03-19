"use client";
import { useState } from "react";
import { Search, Mail, Phone, Linkedin, Edit2, Plus, X, Loader2, CheckCircle } from "lucide-react";

type Contact = { id:string; fullName:string; firstName:string; lastName:string; title:string; email:string; phone:string; linkedinUrl:string|null; sector:string; ticket:string; organisation:string; status:string; notes:string; };

const STATUS: Record<string,{label:string;cls:string;bg:string;tx:string}> = {
  active:    {label:"Actif",       cls:"cs-active",    bg:"var(--cs-active-bg)",    tx:"var(--cs-active-tx)"},
  priority:  {label:"Prioritaire", cls:"cs-priority",  bg:"var(--cs-priority-bg)",  tx:"var(--cs-priority-tx)"},
  qualified: {label:"Qualifié",    cls:"cs-qualified",  bg:"var(--cs-qualified-bg)", tx:"var(--cs-qualified-tx)"},
  to_qualify:{label:"À qualifier", cls:"cs-to_qualify",bg:"var(--cs-qualify-bg)",   tx:"var(--cs-qualify-tx)"},
  dormant:   {label:"Dormant",     cls:"cs-dormant",   bg:"var(--cs-dormant-bg)",   tx:"var(--cs-dormant-tx)"},
  inactive:  {label:"Inactif",     cls:"cs-inactive",  bg:"var(--cs-inactive-bg)",  tx:"var(--cs-inactive-tx)"},
  excluded:  {label:"Exclu",       cls:"cs-excluded",  bg:"var(--cs-excluded-bg)",  tx:"var(--cs-excluded-tx)"},
};

function EditModal({c,onClose,onSaved}:{c:Contact;onClose:()=>void;onSaved:(u:Partial<Contact>)=>void}) {
  const [f,setF]=useState({first_name:c.firstName,last_name:c.lastName,email:c.email,phone:c.phone,title:c.title,sector:c.sector,linkedin_url:c.linkedinUrl??"",base_status:c.status,notes:c.notes});
  const [loading,setLoading]=useState(false); const [done,setDone]=useState(false); const [err,setErr]=useState("");
  const set=(k:string)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setF(p=>({...p,[k]:e.target.value}));
  async function save(){
    setLoading(true);setErr("");
    const r=await fetch(`/api/contacts/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});
    if(!r.ok){setErr((await r.json()).error??"Erreur");setLoading(false);return;}
    setDone(true);
    onSaved({fullName:`${f.first_name} ${f.last_name}`.trim(),firstName:f.first_name,lastName:f.last_name,email:f.email,phone:f.phone,title:f.title,sector:f.sector,linkedinUrl:f.linkedin_url||null,status:f.base_status,notes:f.notes});
    setTimeout(onClose,900);
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(9,22,40,.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}} onClick={onClose}>
      <div className="animate-scalein card" style={{width:"100%",maxWidth:540,maxHeight:"92vh",overflowY:"auto",padding:28,boxShadow:"var(--shadow-xl)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
          <div><div className="section-label" style={{marginBottom:4}}>Modifier contact</div><h2 style={{fontSize:17,fontWeight:700}}>{c.fullName}</h2></div>
          <button className="btn-icon" onClick={onClose}><X size={15}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}}>
          {[["first_name","PRÉNOM"],["last_name","NOM"],["email","EMAIL"],["phone","TÉLÉPHONE"],["title","FONCTION"],["sector","SECTEUR"]].map(([k,l])=>(
            <div key={k}><label className="lbl">{l}</label><input className="inp" value={(f as any)[k]} onChange={set(k)}/></div>
          ))}
          <div style={{gridColumn:"1/-1"}}><label className="lbl">LINKEDIN</label><input className="inp" value={f.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/in/…"/></div>
          <div><label className="lbl">STATUT</label>
            <select className="inp" value={f.base_status} onChange={set("base_status")}>
              {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}><label className="lbl">NOTES</label><textarea className="inp" value={f.notes} onChange={set("notes")} rows={3}/></div>
        </div>
        {err&&<p style={{fontSize:12,color:"var(--rec-tx)",marginTop:10}}>{err}</p>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={loading||done} style={{minWidth:128,justifyContent:"center"}}>
            {loading&&<Loader2 size={14} className="animate-spin"/>}{done&&<CheckCircle size={14}/>}
            {loading?"Enregistrement…":done?"Enregistré !":"Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContactsList({contacts:init,stats}:{contacts:Contact[];stats:{total:number;bystatus:Record<string,number>}}) {
  const [contacts,setContacts]=useState(init);
  const [search,setSearch]=useState(""); const [statusF,setStatusF]=useState("all"); const [editing,setEditing]=useState<Contact|null>(null);

  const filtered=contacts.filter(c=>{
    const q=search.toLowerCase();
    return(!q||[c.fullName,c.email,c.organisation,c.sector,c.title].some(v=>v.toLowerCase().includes(q)))&&(statusF==="all"||c.status===statusF);
  });

  return (
    <div style={{padding:32,minHeight:"100vh",background:"var(--bg)"}}>
      {editing&&<EditModal c={editing} onClose={()=>setEditing(null)} onSaved={u=>{setContacts(p=>p.map(c=>c.id===editing.id?{...c,...u}:c));}}/>}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="section-label" style={{marginBottom:6}}>CRM</div>
          <h1 style={{margin:0}}>Contacts</h1>
          <div style={{marginTop:8,fontSize:12,color:"var(--text-4)"}}>{stats.total} contacts au total</div>
        </div>
        <a href="/protected/contacts/nouveau" className="btn btn-primary"><Plus size={14}/>Nouveau contact</a>
      </div>

      {/* Compteurs statuts */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        <button onClick={()=>setStatusF("all")} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:20,border:`2px solid ${statusF==="all"?"var(--su-400)":"transparent"}`,background:"var(--surface)",cursor:"pointer",fontSize:12,fontWeight:600,color:"var(--text-2)"}}>
          Tous <span style={{background:"var(--surface-3)",color:"var(--text-3)",borderRadius:10,padding:"1px 7px",fontSize:11}}>{stats.total}</span>
        </button>
        {Object.entries(STATUS).map(([k,v])=>{
          const cnt=stats.bystatus[k]??0; if(!cnt) return null;
          return (
            <button key={k} onClick={()=>setStatusF(k)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:20,border:`2px solid ${statusF===k?v.tx+"80":"transparent"}`,background:statusF===k?v.bg:"var(--surface)",cursor:"pointer",fontSize:12,fontWeight:600,color:v.tx}}>
              {v.label}<span style={{background:v.bg,borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Filtre recherche */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <div style={{position:"relative",flex:1,maxWidth:400}}>
          <Search size={13} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text-4)",pointerEvents:"none"}}/>
          <input className="inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, email, organisation, secteur…" style={{paddingLeft:36}}/>
        </div>
      </div>

      <div style={{fontSize:12,color:"var(--text-4)",marginBottom:12}}>{filtered.length} résultat{filtered.length!==1?"s":""}</div>

      {/* Liste sans avatars */}
      {filtered.length===0 ? (
        <div className="empty-state"><div style={{fontWeight:600,color:"var(--text-3)"}}>Aucun contact trouvé</div></div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          {filtered.map(c=>{
            const st=STATUS[c.status]??STATUS.to_qualify;
            return (
              <div key={c.id} className="card" style={{padding:"11px 18px",display:"flex",alignItems:"center",gap:14}}>
                {/* Status dot */}
                <div style={{width:8,height:8,borderRadius:"50%",background:st.tx,flexShrink:0,opacity:.7}}/>
                {/* Infos */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,color:"var(--text-1)",fontSize:13.5}}>{c.fullName}</span>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--text-3)",marginTop:1.5,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                    {c.title&&<span>{c.title}</span>}
                    {c.title&&c.organisation&&<span style={{color:"var(--border-2)"}}>·</span>}
                    {c.organisation&&<span style={{color:"var(--su-500)",fontWeight:600}}>{c.organisation}</span>}
                    {c.sector&&<><span style={{color:"var(--border-2)"}}>·</span><span>{c.sector}</span></>}
                  </div>
                </div>
                {/* Actions */}
                <div style={{display:"flex",gap:5,flexShrink:0}}>
                  {c.email&&c.email!=="—"&&<a href={`mailto:${c.email}`} className="btn-icon" title={c.email}><Mail size={12}/></a>}
                  {c.phone&&c.phone!=="—"&&<a href={`tel:${c.phone}`} className="btn-icon" title={c.phone} style={{color:"var(--fund-tx)"}}><Phone size={12}/></a>}
                  {c.linkedinUrl&&<a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="btn-icon" style={{color:"#0A66C2"}}><Linkedin size={12}/></a>}
                  <button className="btn-icon" onClick={()=>setEditing(c)}><Edit2 size={12}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
