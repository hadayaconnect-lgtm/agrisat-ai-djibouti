import type { ChampDonnee } from "@/lib/types";

const STATUT_LABEL: Record<string, string> = {
  reelle: "RÉELLE",
  calculee: "CALCULÉE",
  indisponible: "INDISPONIBLE",
};

const STATUT_COULEUR: Record<string, string> = {
  reelle: "#2E7D6B",
  calculee: "#274A63",
  indisponible: "#A33B2B",
};

function dateCourte(dateObs: string | null): string {
  if (!dateObs) return "—";
  // Formats attendus: "2022-01-01/2022-12-31" ou "2022-01/2025-12" ou libellé libre
  const parts = dateObs.split("/");
  if (parts.length === 2) {
    const debut = parts[0].slice(0, 7);
    const fin = parts[1].slice(0, 7);
    return `${debut} → ${fin}`;
  }
  return dateObs;
}

export function Telemetry({ champ }: { champ: ChampDonnee }) {
  return (
    <div className="telemetry flex flex-wrap items-center">
      <span style={{ color: STATUT_COULEUR[champ.statut] }} className="font-semibold">
        {STATUT_LABEL[champ.statut]}
      </span>
      {champ.statut !== "indisponible" && (
        <>
          <span className="telemetry-sep">·</span>
          <span>{champ.source}</span>
          <span className="telemetry-sep">·</span>
          <span>{dateCourte(champ.date_observation)}</span>
          {champ.resolution_spatiale && (
            <>
              <span className="telemetry-sep">·</span>
              <span>{champ.resolution_spatiale}</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function IndicateurValeur({
  label,
  champ,
  formatValeur,
}: {
  label: string;
  champ: ChampDonnee;
  formatValeur?: (v: number) => string;
}) {
  const affichage =
    champ.statut === "indisponible" || champ.valeur === null
      ? "Donnée indisponible"
      : formatValeur
      ? formatValeur(champ.valeur)
      : `${champ.valeur} ${champ.unite ?? ""}`;

  return (
    <div className="border-b border-sand-200 py-3 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body text-sm text-stone-800">{label}</span>
        <span
          className={`font-mono text-base font-medium ${
            champ.statut === "indisponible" ? "text-potentiel-defavorable" : "text-signal"
          }`}
        >
          {affichage}
        </span>
      </div>
      <Telemetry champ={champ} />
    </div>
  );
}
