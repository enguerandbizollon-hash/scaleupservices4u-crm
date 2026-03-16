export default function OrganisationsPage() {
  const organisations = [
    {
      name: "Redpeaks",
      type: "Client",
      sector: "Technologie & SaaS",
      country: "Suisse",
      website: "https://redpeaks.io",
      status: "Actif",
      roles: ["Client", "Fundraising"],
      linkedDeals: ["Redpeaks"],
    },
    {
      name: "Hello Justice",
      type: "Client",
      sector: "LegalTech & Compliance",
      country: "France",
      website: "https://hellojustice.fr",
      status: "Actif",
      roles: ["Client", "Fundraising"],
      linkedDeals: ["Hello Justice"],
    },
    {
      name: "Bluecross Canada",
      type: "Corporate",
      sector: "Santé & MedTech",
      country: "Canada",
      website: "https://www.bluecross.ca",
      status: "Qualifié",
      roles: ["Prospect partenaire", "Compte stratégique"],
      linkedDeals: ["Redpeaks"],
    },
    {
      name: "Cabinet X",
      type: "Avocat",
      sector: "LegalTech & Compliance",
      country: "France",
      website: "https://cabinet-x.fr",
      status: "Actif",
      roles: ["Tiers", "Conseil juridique"],
      linkedDeals: ["Hello Justice"],
    },
    {
      name: "Fonds Growth Europe",
      type: "Investisseur",
      sector: "Technologie & SaaS",
      country: "France",
      website: "https://growth-europe.vc",
      status: "Qualifié",
      roles: ["Investisseur"],
      linkedDeals: ["Redpeaks"],
    },
    {
      name: "Scale Up services 4U",
      type: "Conseil",
      sector: "Services aux entreprises & B2B",
      country: "Suisse",
      website: "https://scaleupservices4u.com",
      status: "Actif",
      roles: ["Conseil", "Recrutement"],
      linkedDeals: ["Recrutement - Analyste"],
    },
  ];

  const badgeClass = (type: string) => {
    if (type === "Client") return "bg-blue-100 text-blue-800";
    if (type === "Investisseur") return "bg-amber-100 text-amber-800";
    if (type === "Avocat") return "bg-violet-100 text-violet-800";
    if (type === "Conseil") return "bg-emerald-100 text-emerald-800";
    if (type === "Corporate") return "bg-slate-200 text-slate-800";
    return "bg-slate-100 text-slate-700";
  };

  const statusClass = (status: string) => {
    if (status === "Actif") return "bg-emerald-100 text-emerald-800";
    if (status === "Qualifié") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Module CRM</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Organisations</h1>
          <p className="mt-2 text-sm text-slate-500">
            Base master des sociétés, investisseurs, clients et tiers
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Organisations total</p>
            <p className="mt-3 text-3xl font-bold">{organisations.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Clients</p>
            <p className="mt-3 text-3xl font-bold">
              {organisations.filter((o) => o.type === "Client").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Investisseurs</p>
            <p className="mt-3 text-3xl font-bold">
              {organisations.filter((o) => o.type === "Investisseur").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tiers / conseils</p>
            <p className="mt-3 text-3xl font-bold">
              {
                organisations.filter((o) =>
                  ["Avocat", "Conseil"].includes(o.type)
                ).length
              }
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {organisations.map((org) => (
            <div
              key={org.name}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{org.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {org.sector} • {org.country}
                  </p>
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                  >
                    Accéder au site
                  </a>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                      org.type
                    )}`}
                  >
                    {org.type}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                      org.status
                    )}`}
                  >
                    {org.status}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Rôles
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {org.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 md:col-span-2 xl:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Dossiers concernés
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {org.linkedDeals.map((deal) => (
                      <span
                        key={deal}
                        className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                      >
                        {deal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}