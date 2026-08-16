import { statistiquesGlobales } from "@/lib/zones";

export function Header() {
  const stats = statistiquesGlobales();
  const dateFormatee = stats.derniereMiseAJour.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 bg-sand-50 px-5 py-3">
      <div>
        <h1 className="font-display text-lg font-bold tracking-tight text-signal">
          AGRISAT AI DJIBOUTI
        </h1>
        <p className="font-body text-xs text-stone-800">
          Cartographie intelligente du potentiel agricole national
        </p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Stat label="Zones analysées" valeur={stats.zonesAnalysees.toString()} />
        <Stat label="Potentiel élevé" valeur={stats.potentielEleve.toString()} />
        <Stat label="Potentiel modéré" valeur={stats.potentielModere.toString()} />
        <Stat label="Superficie analysée" valeur={`${stats.superficieTotaleKm2} km²`} />
        <Stat label="Dernière MàJ" valeur={dateFormatee} />
      </div>
    </header>
  );
}

function Stat({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="text-right">
      <div className="font-mono text-sm font-semibold text-stone-900">{valeur}</div>
      <div className="telemetry !text-[0.6rem]">{label}</div>
    </div>
  );
}
