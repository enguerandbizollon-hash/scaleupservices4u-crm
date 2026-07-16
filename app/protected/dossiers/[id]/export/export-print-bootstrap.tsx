"use client";

import { useEffect } from "react";

/**
 * Petit composant client qui :
 *   - Met le titre de la page au nom du dossier (utile pour le PDF Save As).
 *   - Câble le bouton "Imprimer / Enregistrer en PDF".
 *   - Déclenche window.print() automatiquement si `autoPrint` est true
 *     (URL `?print=1`), avec un délai pour laisser le rendu se finaliser.
 */
export function ExportPrintBootstrap({ autoPrint, dealName }: { autoPrint: boolean; dealName: string }) {
  useEffect(() => {
    // Titre de l'onglet = base du nom du fichier PDF proposé par le navigateur
    document.title = `Synthèse — ${dealName}`;

    const btn = document.getElementById("trigger-print");
    const handler = () => window.print();
    btn?.addEventListener("click", handler);

    if (autoPrint) {
      const t = setTimeout(() => window.print(), 600);
      return () => {
        clearTimeout(t);
        btn?.removeEventListener("click", handler);
      };
    }
    return () => btn?.removeEventListener("click", handler);
  }, [autoPrint, dealName]);

  return null;
}
