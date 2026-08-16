export function GroundwaterPlaceholder({ potentiel }: { potentiel?: import("@/lib/types").PotentielEauSouterraine }) {
  if (!potentiel) {
    return (
      <div className="rounded border border-dashed border-signal/30 bg-signal/5 p-4">
        <h3 className="font-display text-sm font-semibold text-signal">
          Potentiel de présence d'eau souterraine
        </h3>
        <p className="mt-1 font-body text-sm text-stone-800">
          Cliquez sur la carte nationale pour estimer ce point (non disponible pour les zones pilotes fixes).
        </p>
      </div>
    );
  }

  const NIVEAU_LABEL: Record<string, string> = {
    eleve: "Potentiel élevé",
    modere: "Potentiel modéré",
    faible: "Potentiel faible",
    indetermine: "Indéterminé",
  };

  return (
    <div className="rounded border border-dashed border-signal/30 bg-signal/5 p-4">
      <h3 className="font-display text-sm font-semibold text-signal">
        Potentiel de présence d'eau souterraine
      </h3>
      <p className="mt-1 font-body text-sm font-medium text-stone-900">
        {NIVEAU_LABEL[potentiel.niveau] ?? potentiel.niveau}
      </p>
      {potentiel.indicateurs_utilises.length > 0 && (
        <p className="telemetry mt-1">
          BASÉ SUR · {potentiel.indicateurs_utilises.join(" · ").toUpperCase()}
        </p>
      )}
      <p className="mt-2 font-body text-xs italic text-stone-800">{potentiel.avertissement}</p>
    </div>
  );
}
