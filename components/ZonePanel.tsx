"use client";

import type { ZoneData } from "@/lib/types";
import { ndviRecentEtHistorique } from "@/lib/zones";
import { ScoreBadge } from "./ScoreBadge";
import { IndicateurValeur } from "./Telemetry";
import { NdviChart } from "./NdviChart";
import { GroundwaterPlaceholder } from "./GroundwaterPlaceholder";

function genererAnalyseIA(zone: ZoneData): string {
  const s = zone.score_potentiel;
  const { ndviRecent } = ndviRecentEtHistorique(zone);
  if (s.score === null) {
    return "Données insuffisantes pour produire une analyse fiable sur cette zone.";
  }

  const vegetationTxt =
    ndviRecent !== null && ndviRecent > 0.1
      ? "un niveau de végétation modéré et relativement stable"
      : "une végétation clairsemée mais mesurable sur plusieurs années";

  const eauTxt =
    (zone.climat.precipitation.valeur ?? 0) > 0.85
      ? "une pluviométrie légèrement plus favorable que la moyenne régionale"
      : "une pluviométrie faible, typique du climat aride de Djibouti";

  return `Cette zone présente ${vegetationTxt}, ainsi que ${eauTxt}. La topographie (pente ${zone.topographie.pente_deg.valeur}°) est ${
    (zone.topographie.pente_deg.valeur ?? 99) < 5 ? "favorable à l'exploitation" : "un facteur limitant à considérer"
  }. La disponibilité réelle en eau et la qualité du sol doivent être confirmées sur le terrain avant toute décision.`;
}

export function ZonePanel({ zone }: { zone: ZoneData }) {
  const { points } = ndviRecentEtHistorique(zone);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-sand-50">
      <div className="border-b border-sand-200 p-5">
        <p className="telemetry">{zone.description}</p>
        <h2 className="font-display text-2xl font-semibold text-stone-900">{zone.nom}</h2>
        <div className="mt-3">
          <ScoreBadge score={zone.score_potentiel} />
        </div>
      </div>

      <div className="border-b border-sand-200 p-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-signal">
          Analyse IA
        </h3>
        <p className="mt-2 font-body text-sm leading-relaxed text-stone-800">{genererAnalyseIA(zone)}</p>
      </div>

      <div className="border-b border-sand-200 p-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-signal">
          Indicateurs satellitaires
        </h3>
        <div className="mt-1">
          <IndicateurValeur
            label="NDVI (le plus récent)"
            champ={zone.historique_vegetation[Object.keys(zone.historique_vegetation).sort().pop()!].ndvi}
            formatValeur={(v) => v.toFixed(4)}
          />
          <IndicateurValeur
            label="NDMI (humidité de végétation)"
            champ={zone.historique_vegetation[Object.keys(zone.historique_vegetation).sort().pop()!].ndmi}
            formatValeur={(v) => v.toFixed(4)}
          />
          <IndicateurValeur
            label="Pluviométrie moyenne"
            champ={zone.climat.precipitation}
            formatValeur={(v) => `${v} mm/j`}
          />
          <IndicateurValeur
            label="Température moyenne"
            champ={zone.climat.temperature}
            formatValeur={(v) => `${v} °C`}
          />
          <IndicateurValeur
            label="Altitude"
            champ={zone.topographie.elevation_m}
            formatValeur={(v) => `${v} m`}
          />
          <IndicateurValeur
            label="Pente"
            champ={zone.topographie.pente_deg}
            formatValeur={(v) => `${v}°`}
          />
        </div>
      </div>

      <div className="border-b border-sand-200 p-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-signal">
          Évolution du NDVI
        </h3>
        <div className="mt-3">
          <NdviChart points={points} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-b border-sand-200 p-5 sm:grid-cols-2">
        <div>
          <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-potentiel-eleve">
            Points favorables
          </h4>
          <ul className="mt-2 space-y-1.5">
            {zone.analyse_qualitative.points_favorables.map((p, i) => (
              <li key={i} className="font-body text-sm text-stone-800">
                + {p}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-potentiel-faible">
            Points de vigilance
          </h4>
          <ul className="mt-2 space-y-1.5">
            {zone.analyse_qualitative.points_vigilance.map((p, i) => (
              <li key={i} className="font-body text-sm text-stone-800">
                − {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-b border-sand-200 p-5">
        <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-signal">
          À vérifier sur le terrain
        </h4>
        <ul className="mt-2 space-y-1.5">
          {zone.analyse_qualitative.a_verifier_terrain.map((p, i) => (
            <li key={i} className="font-body text-sm text-stone-800">
              □ {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-b border-sand-200 p-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-signal">
          Recommandation
        </h3>
        <p className="mt-2 rounded bg-signal/5 p-3 font-body text-sm font-medium text-signal">
          {zone.analyse_qualitative.recommandation}
        </p>
      </div>

      <div className="p-5">
        <GroundwaterPlaceholder potentiel={zone.potentiel_eau_souterraine} />
      </div>
    </div>
  );
}
