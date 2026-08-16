"use client";

import { useState } from "react";
import type { ZoneData, CategoriePotentiel } from "@/lib/types";
import { CATEGORIE_LABEL, CATEGORIE_COULEUR } from "@/lib/zones";
import { ScoreBadge } from "./ScoreBadge";

const CATEGORIES: CategoriePotentiel[] = [
  "potentiel_eleve",
  "potentiel_modere",
  "potentiel_faible",
  "conditions_defavorables",
];

export function RankingStrip({
  zones,
  zoneSelectionnee,
  onSelectZone,
}: {
  zones: ZoneData[];
  zoneSelectionnee: string | null;
  onSelectZone: (id: string) => void;
}) {
  const [filtresActifs, setFiltresActifs] = useState<Set<CategoriePotentiel>>(new Set());
  const [scoreMin, setScoreMin] = useState(0);

  const zonesTriees = [...zones].sort(
    (a, b) => (b.score_potentiel.score ?? -1) - (a.score_potentiel.score ?? -1)
  );

  const zonesFiltrees = zonesTriees.filter((z) => {
    const score = z.score_potentiel.score ?? 0;
    if (score < scoreMin) return false;
    if (filtresActifs.size === 0) return true;
    return z.score_potentiel.categorie && filtresActifs.has(z.score_potentiel.categorie);
  });

  function toggleFiltre(cat: CategoriePotentiel) {
    setFiltresActifs((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="border-t border-sand-200 bg-sand-50 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-signal">
          Zones prioritaires
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleFiltre(cat)}
              className={`rounded-full border px-2.5 py-0.5 font-body text-xs transition ${
                filtresActifs.has(cat)
                  ? "border-transparent text-sand-50"
                  : "border-sand-200 text-stone-800"
              }`}
              style={filtresActifs.has(cat) ? { backgroundColor: CATEGORIE_COULEUR[cat] } : {}}
            >
              {CATEGORIE_LABEL[cat]}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 font-body text-xs text-stone-800">
          Score minimum
          <input
            type="range"
            min={0}
            max={100}
            value={scoreMin}
            onChange={(e) => setScoreMin(Number(e.target.value))}
            className="w-24 accent-signal"
          />
          <span className="font-mono">{scoreMin}</span>
        </label>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {zonesFiltrees.map((zone) => {
          const estSelectionnee = zoneSelectionnee === zone.zone_id;
          return (
            <button
              key={zone.zone_id}
              onClick={() => onSelectZone(zone.zone_id)}
              className={`min-w-[190px] shrink-0 rounded border p-3 text-left transition ${
                estSelectionnee
                  ? "border-signal bg-signal/5"
                  : "border-sand-200 bg-white/60 hover:border-signal/40"
              }`}
            >
              <p className="font-display text-sm font-semibold text-stone-900">{zone.nom}</p>
              <div className="mt-1.5">
                <ScoreBadge score={zone.score_potentiel} size="small" />
              </div>
            </button>
          );
        })}
        {zonesFiltrees.length === 0 && (
          <p className="font-body text-sm text-potentiel-insuffisant">
            Aucune zone ne correspond aux filtres sélectionnés.
          </p>
        )}
      </div>
    </div>
  );
}
