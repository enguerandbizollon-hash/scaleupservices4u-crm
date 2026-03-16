export default function DossiersPage() {
  const activeDeals = [
    {
      name: "Redpeaks",
      type: "Fundraising",
      organisation: "Redpeaks",
      ownerPrimary: "Enguérand",
      ownerSecondary: "Christophe",
      status: "Actif",
      step: "Investor outreach",
      sector: "Technologie & SaaS",
      valuation: "CHF 18m",
      fundraising: "CHF 3m",
      launchDate: "01/02/2026",
      targetDate: "30/06/2026",
      priorities: [
        "Finaliser l’investor deck",
        "Relancer fonds prioritaires",
      ],
    },
    {
      name: "Hello Justice",
      type: "Fundraising",
      organisation: "Hello Justice",
      ownerPrimary: "Christophe",
      ownerSecondary: "Enguérand",
      status: "Actif",
      step: "Structuration",
      sector: "LegalTech & Compliance",
      valuation: "À définir",
      fundraising: "€5m",
      launchDate: "15/01/2026",
      targetDate: "31/07/2026",
      priorities: [
        "Consolider documentation juridique",
        "Mettre à jour le narratif investisseurs",
      ],
    },
    {
      name: "Mission CFO - Client A",
      type: "CFO Advisor",
      organisation: "Client A",
      ownerPrimary: "Marcella",
      ownerSecondary: "Enguérand",
      status: "Actif",
      step: "Revue comptable",
      sector: "Industrie & Manufacturing",
      valuation: "N/A",
      fundraising: "N/A",
      launchDate: "01/03/2026",
      targetDate: "30/09/2026",
      priorities: [
        "Revoir la balance âgée",
        "Mettre à jour le prévisionnel de trésorerie",
      ],
    },
    {
      name: "Recrutement - Analyste",
      type: "Recrutement",
      organisation: "Scale Up services 4U",
      ownerPrimary: "Christophe",
      ownerSecondary: "Marcella",
      status: "Actif",
      step: "Shortlist candidats",
      sector: "Services aux entreprises & B2B",
      valuation: "N/A",
      fundraising: "N/A",
      launchDate: "10/03/2026",
      targetDate: "30/04/2026",
      priorities: [
        "Finaliser shortlist",
        "Planifier entretiens",
      ],
    },
  ];

  const inactiveDeals = [
    {
      name: "TCF",
      type: "M&A Sell-side",
      organisation: "TCF",
      ownerPrimary: "Enguérand",
      ownerSecondary: "Christophe",
      status: "Inactif",
      step: "Teaser / deck",
      sector: "Transport & Logistique",
      valuation: "Confidentiel",
      fundraising: "N/A",
      launchDate: "01/12/2025",
      targetDate: "30/05/2026",
      priorities: ["Réactiver process acquéreurs"],
    },
    {
      name: "Mission CFO - Client B",
      type: "CFO Advisor",
      organisation: "Client B",
      ownerPrimary: "Marcella",
      ownerSecondary: "Enguérand",
      status: "Clôturé",
      step: "Mission terminée",
      sector: "Finance & Fintech",
      valuation: "N/A",
      fundraising: "N/A",
      launchDate: "01/09/2025",
      targetDate: "31/12/2025",
      priorities: ["Archiver les livrables"],
    },
  ];

  const ownerBadgeClass = (owner: string) => {
    if (owner === "Enguérand") return "bg-blue-100 text-blue-800";
    if (owner === "Christophe") return "bg-amber-100 text-amber-800";
    if (owner === "Marcella") return "bg-emerald-100 text-emerald-800";
    return "bg-slate-100 text-slate-800";
  };

  const DealCard = ({
    deal,
  }: {
    deal: {
      name: string;
      type: string;
      organisation: string;
      ownerPrimary: string;
      ownerSecondary: string;
      status: string;
      step: string;
      sector: string;
      valuation: string;
      fundraising: string;
      launchDate: string;
      targetDate: string;
      priorities: string[];
    };
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{deal.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {deal.type} • {deal.organisation}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Étape : <span className="font-medium">{deal.step}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {deal.status}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
              deal.ownerPrimary
            )}`}
          >
            {deal.ownerPrimary}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
              deal.ownerSecondary
            )}`}
          >
            {deal.ownerSecondary}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Secteur</p>
          <p className="mt-1 text-sm font-medium">{deal.sector}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Valorisation</p>
          <p className="mt-1 text-sm font-medium">{deal.valuation}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Fundraising</p>
          <p className="mt-1 text-sm font-medium">{deal.fundraising}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Date cible</p>
          <p className="mt-1 text-sm font-medium">{deal.targetDate}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-800">Priorités liées</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {deal.priorities.map((priority) => (
            <span
              key={priority}
              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700"
            >
              {priority}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Lancement</p>
          <p className="mt-1 text-sm font-medium">{deal.launchDate}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Organisation liée</p>
          <p className="mt-1 text-sm font-medium">{deal.organisation}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Dossiers</h1>
          <p className="mt-2 text-sm text-slate-500">
            Vue métier des dossiers actifs, inactifs et clôturés
          </p>
        </div>

        <section className="mb-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Dossiers actifs</h2>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {activeDeals.length} actifs
            </span>
          </div>

          <div className="space-y-5">
            {activeDeals.map((deal) => (
              <DealCard key={deal.name} deal={deal} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Dossiers inactifs / clôturés</h2>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              {inactiveDeals.length} dossiers
            </span>
          </div>

          <div className="space-y-5">
            {inactiveDeals.map((deal) => (
              <DealCard key={deal.name} deal={deal} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}