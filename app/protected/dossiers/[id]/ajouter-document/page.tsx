import { Suspense } from "react";
import Link from "next/link";
import { addDocumentAction } from "./actions";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#6B8CAE]">Dossier</p>
            <h1 className="mt-1 text-2xl font-bold text-[#0F1B2D]">Ajouter un document</h1>
          </div>
          <Link href={`/protected/dossiers/${id}`} className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Retour</Link>
        </div>
        <form action={addDocumentAction} className="space-y-4">
          <input type="hidden" name="deal_id" value={id} />
          <div className="rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Nom du document *</label>
              <input name="name" required placeholder="Ex. Teaser Redpeaks v2" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Type</label>
                <select name="document_type" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                  <option value="pitch_deck">Pitch deck</option>
                  <option value="teaser">Teaser</option>
                  <option value="im">Information Memorandum</option>
                  <option value="financial_model">Modèle financier</option>
                  <option value="nda">NDA</option>
                  <option value="legal">Juridique</option>
                  <option value="finance">Finance</option>
                  <option value="hr">RH</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Statut</label>
                <select name="document_status" defaultValue="received" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]">
                  <option value="requested">Demandé</option>
                  <option value="received">Reçu</option>
                  <option value="modeled">Modélisé</option>
                  <option value="finalized">Finalisé</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Lien Google Drive</label>
              <input name="document_url" type="url" placeholder="https://drive.google.com/..." className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Version</label>
              <input name="version_label" placeholder="Ex. v1, v2, final" className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0F1B2D]">Note</label>
              <textarea name="note" rows={2} className="w-full rounded-xl border border-[#E8E0D0] px-4 py-3 text-sm outline-none focus:border-[#0F1B2D]" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Link href={`/protected/dossiers/${id}`} className="rounded-xl border border-[#E8E0D0] px-4 py-2 text-sm font-medium text-[#0F1B2D] hover:bg-[#F5F0E8]">Annuler</Link>
            <button type="submit" className="rounded-xl bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B2A4A]">Ajouter</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AjouterDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="p-8"><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /></div>}><Content params={params} /></Suspense>;
}
