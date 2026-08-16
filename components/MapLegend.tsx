import { CATEGORIE_COULEUR, CATEGORIE_LABEL } from "@/lib/zones";

export function MapLegend() {
  const entries = Object.entries(CATEGORIE_LABEL) as [keyof typeof CATEGORIE_LABEL, string][];
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded bg-sand-50/95 p-3 shadow-md">
      <p className="telemetry mb-1.5">Classification</p>
      <ul className="space-y-1">
        {entries.map(([key, label]) => (
          <li key={key} className="flex items-center gap-2 font-body text-xs text-stone-800">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORIE_COULEUR[key] }}
            />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2 font-body text-xs text-stone-800">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-potentiel-insuffisant" />
          Données insuffisantes
        </li>
      </ul>
    </div>
  );
}
