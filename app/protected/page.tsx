import Link from "next/link";
export default function ProtectedPage() {
 const menuItems = [
  { label: "Dashboard", href: "/protected" },
  { label: "Dossiers", href: "/protected/dossiers" },
  { label: "Organisations", href: "/protected/organisations" },
  { label: "Contacts", href: "/protected/contacts" },
  { label: "Activités", href: "/protected/activites" },
  { label: "Documents", href: "/protected/documents" },
  { label: "Imports", href: "/protected/imports" },
  { label: "Connecteurs", href: "/protected/connecteurs" },
];

  const kpis = [
    { label: "Dossiers actifs", value: "8" },
    { label: "Relances à faire", value: "14" },
    { label: "Documents manquants", value: "9" },
    { label: "Priorités hautes", value: "6" },
  ];

  const activeDeals = [
    {
      name: "Redpeaks",
      type: "Fundraising",
      status: "Actif",
      owner: "Enguérand",
      step: "Investor outreach",
    },
    {
      name: "Hello Justice",
      type: "Fundraising",
      status: "Actif",
      owner: "Christophe",
      step: "Structuration",
    },
    {
      name: "TCF",
      type: "M&A Sell-side",
      status: "Actif",
      owner: "Enguérand",
      step: "Teaser / deck",
    },
    {
      name: "Mission CFO - Client A",
      type: "CFO Advisor",
      status: "Actif",
      owner: "Marcella",
      step: "Revue comptable",
    },
    {
      name: "Recrutement - Analyste",
      type: "Recrutement",
      status: "Actif",
      owner: "Christophe",
      step: "Shortlist candidats",
    },
  ];

  const priorities = [
    {
      title: "Deck investisseurs à finaliser",
      deal: "Redpeaks",
      dueDate: "18/03/2026",
      level: "Haute",
    },
    {
      title: "NDA à récupérer",
      deal: "Hello Justice",
      dueDate: "19/03/2026",
      level: "Haute",
    },
    {
      title: "Prévisions de trésorerie à mettre à jour",
      deal: "Mission CFO - Client A",
      dueDate: "20/03/2026",
      level: "Moyenne",
    },
  ];

  const followUps = [
    {
      contact: "Barry Dejaeger",
      organisation: "Bluecross Canada",
      deal: "Redpeaks",
      nextAction: "Relance après envoi du one-pager",
      lastContact: "12/03/2026",
    },
    {
      contact: "Louis Martin",
      organisation: "Fonds Growth Europe",
      deal: "Redpeaks",
      nextAction: "Proposer un call",
      lastContact: "10/03/2026",
    },
    {
      contact: "Cabinet X",
      organisation: "Cabinet X",
      deal: "Hello Justice",
      nextAction: "Relance sur documentation juridique",
      lastContact: "09/03/2026",
    },
  ];

  const recentActivity = [
    {
      action: "Email envoyé",
      deal: "Redpeaks",
      person: "Barry Dejaeger",
      date: "16/03/2026",
    },
    {
      action: "Checklist mise à jour",
      deal: "Mission CFO - Client A",
      person: "Marcella",
      date: "16/03/2026",
    },
    {
      action: "Document ajouté",
      deal: "TCF",
      person: "Enguérand",
      date: "15/03/2026",
    },
  ];

  const ownerBadgeClass = (owner: string) => {
    if (owner === "Enguérand") {
      return "bg-blue-100 text-blue-800";
    }
    if (owner === "Christophe") {
      return "bg-amber-100 text-amber-800";
    }
    if (owner === "Marcella") {
      return "bg-emerald-100 text-emerald-800";
    }
    return "bg-slate-100 text-slate-800";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-white p-6">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              CRM
            </p>
            <h1 className="mt-2 text-2xl font-bold">Scale Up services 4U</h1>
            <p className="mt-2 text-sm text-slate-500">
              Base master, dossiers et pilotage opérationnel
            </p>
          </div>

         <nav className="space-y-2">
  {menuItems.map((item, index) => (
    <Link
      key={item.href}
      href={item.href}
      className={`block rounded-xl px-4 py-3 text-sm font-medium ${
        index === 0
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {item.label}
    </Link>
  ))}
</nav>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Owners
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Enguérand</span>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                  Owner
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Christophe</span>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                  Owner
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Marcella</span>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                  Owner
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main className="p-6 lg:p-8">
          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Dashboard général
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">
                Pilotage du CRM
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Vue de synthèse avant branchement complet sur Supabase
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              Environnement web connecté — V1
            </div>
          </div>

         <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  {kpis.map((kpi) => (
    <div
      key={kpi.label}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-sm text-slate-500">{kpi.label}</p>
      <p className="mt-3 text-3xl font-bold">{kpi.value}</p>
    </div>
  ))}
</section>

<section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <Link
    href="/protected/dossiers"
    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50"
  >
    <p className="text-sm text-slate-500">Module</p>
    <p className="mt-2 text-lg font-semibold">Dossiers</p>
    <p className="mt-2 text-sm text-slate-600">
      Ouvrir la vue active / inactive / clôturée
    </p>
  </Link>

  <Link
    href="/protected/organisations"
    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50"
  >
    <p className="text-sm text-slate-500">Module</p>
    <p className="mt-2 text-lg font-semibold">Organisations</p>
    <p className="mt-2 text-sm text-slate-600">
      Voir clients, investisseurs et tiers
    </p>
  </Link>

  <Link
    href="/protected/contacts"
    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50"
  >
    <p className="text-sm text-slate-500">Module</p>
    <p className="mt-2 text-lg font-semibold">Contacts</p>
    <p className="mt-2 text-sm text-slate-600">
      Gérer les contacts et les dossiers concernés
    </p>
  </Link>

  <Link
    href="/protected/activites"
    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50"
  >
    <p className="text-sm text-slate-500">Module</p>
    <p className="mt-2 text-lg font-semibold">Activités</p>
    <p className="mt-2 text-sm text-slate-600">
      Suivre les échanges, relances et échéances
    </p>
  </Link>
</section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Dossiers actifs</h3>
                <span className="text-sm text-slate-500">
                  {activeDeals.length} dossiers
                </span>
              </div>

              <div className="space-y-4">
                {activeDeals.map((deal) => (
                  <div
                    key={deal.name}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="text-base font-semibold">{deal.name}</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {deal.type} • Étape : {deal.step}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {deal.status}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${ownerBadgeClass(
                            deal.owner
                          )}`}
                        >
                          {deal.owner}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Haute priorité</h3>
                <span className="text-sm text-slate-500">
                  {priorities.length} éléments
                </span>
              </div>

              <div className="space-y-4">
                {priorities.map((priority) => (
                  <div
                    key={`${priority.title}-${priority.deal}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{priority.title}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {priority.deal}
                        </p>
                      </div>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
                        {priority.level}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      Échéance : {priority.dueDate}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold">À relancer</h3>
                <span className="text-sm text-slate-500">
                  {followUps.length} relances
                </span>
              </div>

              <div className="space-y-4">
                {followUps.map((item) => (
                  <div
                    key={`${item.contact}-${item.deal}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <p className="font-medium">{item.contact}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.organisation}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      Dossier : <span className="font-medium">{item.deal}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Action : {item.nextAction}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dernier contact : {item.lastContact}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Activité récente</h3>
                <span className="text-sm text-slate-500">Traçabilité</span>
              </div>

              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={`${activity.action}-${activity.deal}-${activity.date}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <p className="font-medium">{activity.action}</p>
                    <p className="mt-1 text-sm text-slate-700">
                      Dossier : <span className="font-medium">{activity.deal}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Réalisé par : {activity.person}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Date : {activity.date}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}