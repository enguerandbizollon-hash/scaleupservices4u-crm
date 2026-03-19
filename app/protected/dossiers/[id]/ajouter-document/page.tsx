import { Suspense } from "react";
import Link from "next/link";
import { addDocumentAction } from "./actions";
import { DocumentFormClient } from "./document-form-client";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div style={{ padding: 32, minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--su-600)", marginBottom: 4 }}>DOSSIER</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Ajouter un document</h1>
          </div>
          <Link href={`/protected/dossiers/${id}`} className="su-btn-secondary" style={{ textDecoration: "none" }}>← Retour</Link>
        </div>
        <DocumentFormClient dealId={id} />
      </div>
    </div>
  );
}

export default function AjouterDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div style={{ padding: 32, background: "var(--bg)" }}><div style={{ height: 300, borderRadius: 16, background: "#E8EEF4" }} /></div>}><Content params={params} /></Suspense>;
}
