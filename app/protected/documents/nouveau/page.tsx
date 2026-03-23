import { redirect } from "next/navigation";

// Les documents se créent depuis la fiche dossier
export default function DocumentsNouveauPage() {
  redirect("/protected/dossiers");
}
