import Link from "next/link";
import { ExternalLink } from "lucide-react";

export default function ConnecteursPage() {
  return (
    <div style={{ padding:"28px 24px", maxWidth:700, margin:"0 auto" }}>
      <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text-1)", marginBottom:6 }}>Connecteurs</h1>
      <p style={{ fontSize:13.5, color:"var(--text-4)", marginBottom:28 }}>
        Intégrations externes pour enrichir et centraliser les données du CRM.
      </p>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

        {/* Google Drive */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#f0fdf4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📁</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Google Drive</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>Liez des documents Drive directement dans les dossiers</div>
              </div>
            </div>
            <a href="https://drive.google.com" target="_blank" rel="noreferrer"
              style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", color:"var(--text-3)", textDecoration:"none", fontSize:13 }}>
              <ExternalLink size={12}/> Ouvrir Drive
            </a>
          </div>
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:8, fontSize:12.5, color:"var(--text-4)" }}>
            <strong>Comment l'utiliser :</strong> Dans un dossier → section Documents → "+ Ajouter" → colle le lien de partage Google Drive.
            Pour partager un fichier Drive : clic droit → "Obtenir le lien" → "Toute personne avec le lien".
          </div>
        </div>

        {/* Pappers */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏛</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Pappers</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>Enrichissement automatique — SIRET, CA, effectif, dirigeants</div>
              </div>
            </div>
            <div style={{ fontSize:12, padding:"4px 10px", borderRadius:20, background:"var(--fund-bg)", color:"var(--fund-tx)", fontWeight:600 }}>
              Actif
            </div>
          </div>
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:8, fontSize:12.5, color:"var(--text-4)" }}>
            Bouton "Enrichir" disponible sur chaque fiche organisation. Clé API à configurer dans <code style={{ background:"var(--surface-3)", padding:"1px 5px", borderRadius:4 }}>.env.local</code> : <code style={{ background:"var(--surface-3)", padding:"1px 5px", borderRadius:4 }}>PAPPERS_API_KEY=…</code>
          </div>
        </div>

        {/* Hunter */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"18px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"#fff7ed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔍</div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text-1)" }}>Hunter.io</div>
                <div style={{ fontSize:12.5, color:"var(--text-4)", marginTop:2 }}>Recherche d'emails professionnels par nom + domaine</div>
              </div>
            </div>
            <div style={{ fontSize:12, padding:"4px 10px", borderRadius:20, background:"var(--surface-3)", color:"var(--text-4)", fontWeight:600 }}>
              Optionnel
            </div>
          </div>
          <div style={{ marginTop:14, padding:"10px 14px", background:"var(--surface-2)", borderRadius:8, fontSize:12.5, color:"var(--text-4)" }}>
            Bouton "Enrichir" sur chaque fiche contact. Clé API : <code style={{ background:"var(--surface-3)", padding:"1px 5px", borderRadius:4 }}>HUNTER_API_KEY=…</code>
          </div>
        </div>

      </div>
    </div>
  );
}
