// Types et constantes RH partagés entre Server Actions et composants client
// Séparés de actions/recruitment-kanban.ts (fichier "use server" ne peut exporter que des async functions)

export const DEFAULT_RECRUITMENT_STAGES = [
  { value: "sourcing",         label: "Sourcing" },
  { value: "approche",         label: "Approche" },
  { value: "entretien_rh",     label: "Entretien RH" },
  { value: "entretien_client", label: "Entretien client" },
  { value: "offre",            label: "Offre" },
  { value: "closing",          label: "Closing" },
] as const;

export type PipelineStage = { value: string; label: string };

export type KanbanCandidate = {
  dc_id: string;
  stage: string;
  combined_score: number | null;
  notes: string | null;
  needs_review: boolean;
  placement_fee: number | null;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    title: string | null;
    current_company: string | null;
    candidate_status: string;
    seniority: string | null;
  } | null;
};

export type KanbanData = {
  stages: PipelineStage[];
  columns: Record<string, KanbanCandidate[]>;
};
