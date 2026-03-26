import Link from "next/link";
import { createCandidateAction } from "@/actions/candidates";
import { CANDIDATE_STATUSES, SENIORITY_OPTIONS, REMOTE_OPTIONS, RH_GEOGRAPHIES } from "@/lib/crm/matching-maps";

export default function NouveauCandidatPage() {
  const inp = "width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;font-family:inherit;outline:none;background:var(--surface);color:var(--text-1);box-sizing:border-box";
  const lbl = "display:block;font-size:11.5px;font-weight:700;color:var(--text-4);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em";
  const section = "background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:22px 24px;margin-bottom:14px";

  return (
    <div style={{ padding: "28px 24px", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Candidats</div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>Nouveau candidat</h1>
          </div>
          <Link href="/protected/candidats" style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", textDecoration: "none" }}>
            ← Retour
          </Link>
        </div>

        <form action={createCandidateAction}>

          {/* Identité */}
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Identité</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Prénom *</label>
                <input name="first_name" required style={{ cssText: inp } as React.CSSProperties} placeholder="Jean" />
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Nom *</label>
                <input name="last_name" required style={{ cssText: inp } as React.CSSProperties} placeholder="Dupont" />
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Email</label>
                <input name="email" type="email" style={{ cssText: inp } as React.CSSProperties} placeholder="jean.dupont@email.com" />
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Téléphone</label>
                <input name="phone" style={{ cssText: inp } as React.CSSProperties} placeholder="+33 6 xx xx xx xx" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ cssText: lbl } as React.CSSProperties}>LinkedIn</label>
                <input name="linkedin_url" style={{ cssText: inp } as React.CSSProperties} placeholder="https://linkedin.com/in/..." />
              </div>
            </div>
          </div>

          {/* Profil professionnel */}
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Profil professionnel</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Intitulé de poste</label>
                <input name="title" style={{ cssText: inp } as React.CSSProperties} placeholder="ex: Directeur Commercial" />
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Entreprise actuelle</label>
                <input name="current_company" style={{ cssText: inp } as React.CSSProperties} placeholder="ex: Acme SAS" />
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Séniorité</label>
                <select name="seniority" style={{ cssText: inp } as React.CSSProperties}>
                  <option value="">— Non renseignée —</option>
                  {SENIORITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Localisation</label>
                <select name="location" style={{ cssText: inp } as React.CSSProperties}>
                  <option value="">— Non renseignée —</option>
                  {Object.entries(
                    RH_GEOGRAPHIES.reduce((acc, g) => ({ ...acc, [g.group]: [...(acc[g.group as keyof typeof acc] ?? []), g] }), {} as Record<string, typeof RH_GEOGRAPHIES[number][]>)
                  ).map(([group, geos]) => (
                    <optgroup key={group} label={group}>
                      {geos.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Préférence remote</label>
                <select name="remote_preference" style={{ cssText: inp } as React.CSSProperties}>
                  <option value="">— Non renseignée —</option>
                  {REMOTE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Disponible à partir de</label>
                <input name="available_from" type="date" style={{ cssText: inp } as React.CSSProperties} />
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Rémunération actuelle (€/an)</label>
                <input name="salary_current" type="number" style={{ cssText: inp } as React.CSSProperties} placeholder="ex: 80000" />
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Prétentions (€/an)</label>
                <input name="salary_target" type="number" style={{ cssText: inp } as React.CSSProperties} placeholder="ex: 95000" />
              </div>
            </div>
          </div>

          {/* Statut initial */}
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Statut</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Statut initial</label>
                <select name="candidate_status" style={{ cssText: inp } as React.CSSProperties}>
                  {CANDIDATE_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ cssText: lbl } as React.CSSProperties}>Note initiale</label>
                <input name="initial_note" style={{ cssText: inp } as React.CSSProperties} placeholder="ex: Profil sourcé via LinkedIn" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ cssText: section } as React.CSSProperties}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 16 }}>Notes</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ cssText: lbl } as React.CSSProperties}>Notes internes <span style={{ fontWeight: 400, color: "var(--text-5)", textTransform: "none" }}>(jamais partagées)</span></label>
              <textarea name="notes_internal" rows={3} style={{ cssText: inp + ";resize:vertical" } as React.CSSProperties} placeholder="Contexte, points d'attention, informations confidentielles..." />
            </div>
            <div>
              <label style={{ cssText: lbl } as React.CSSProperties}>Notes partageables <span style={{ fontWeight: 400, color: "var(--text-5)", textTransform: "none" }}>(peuvent figurer dans le rapport client)</span></label>
              <textarea name="notes_shareable" rows={3} style={{ cssText: inp + ";resize:vertical" } as React.CSSProperties} placeholder="Points forts, synthèse partageable..." />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <Link href="/protected/candidats" style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-3)", textDecoration: "none", fontSize: 13.5 }}>
              Annuler
            </Link>
            <button type="submit" style={{ padding: "9px 22px", borderRadius: 9, background: "#1a56db", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Créer le candidat
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
