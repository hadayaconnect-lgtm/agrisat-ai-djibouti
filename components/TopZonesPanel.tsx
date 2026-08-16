"use client";

import { useEffect, useState } from "react";

interface TopZone {
  score: number;
  superficie_km2: number;
  centroide: { lat: number; lon: number };
  niveau_confiance: string;
  raison_principale: string;
  nb_pixels: number;
}

interface TopZonesResponse {
  zones: TopZone[];
  methode: string;
  avertissement: string;
  erreur?: string;
}

const CONFIANCE_LABEL: Record<string, string> = {
  eleve: "Confiance élevée",
  moyen: "Confiance moyenne",
  faible: "Confiance faible",
};

export function TopZonesPanel({ onSelectPoint }: { onSelectPoint: (lat: number, lon: number) => void }) {
  const [data, setData] = useState<TopZonesResponse | null>(null);
  const [statut, setStatut] = useState<"chargement" | "pret" | "erreur">("chargement");

  useEffect(() => {
    fetch("/api/top-zones")
      .then((r) => r.json())
      .then((json: TopZonesResponse) => {
        if (json.erreur) setStatut("erreur");
        else {
          setData(json);
          setStatut("pret");
        }
      })
      .catch(() => setStatut("erreur"));
  }, []);

  if (statut === "chargement") {
    return (
      <div className="border-t border-sand-200 bg-sand-50 px-5 py-4 font-body text-sm text-stone-800">
        Détection des zones prioritaires en cours (peut prendre jusqu'à 30 secondes)…
      </div>
    );
  }

  if (statut === "erreur" || !data) {
    return (
      <div className="border-t border-sand-200 bg-sand-50 px-5 py-4 font-body text-xs text-potentiel-defavorable">
        Top 10 national indisponible pour le moment.
      </div>
    );
  }

  return (
    <div className="border-t border-sand-200 bg-sand-50 px-5 py-4">
      <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-signal">
        Top {data.zones.length} des zones à étudier en priorité
      </h3>
      <p className="telemetry mt-1">{data.methode}</p>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {data.zones.map((zone, i) => (
          <button
            key={i}
            onClick={() => onSelectPoint(zone.centroide.lat, zone.centroide.lon)}
            className="min-w-[210px] shrink-0 rounded border border-sand-200 bg-white/60 p-3 text-left transition hover:border-signal/40"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-lg font-semibold text-potentiel-eleve">#{i + 1}</span>
              <span className="font-mono text-sm font-semibold text-stone-900">{zone.score}/100</span>
            </div>
            <p className="mt-1 font-body text-xs text-stone-800">{zone.raison_principale}</p>
            <div className="mt-2 flex items-center justify-between telemetry">
              <span>{zone.superficie_km2} km²</span>
              <span>{CONFIANCE_LABEL[zone.niveau_confiance] ?? zone.niveau_confiance}</span>
            </div>
          </button>
        ))}
        {data.zones.length === 0 && (
          <p className="font-body text-sm text-potentiel-insuffisant">
            Aucun cluster de potentiel élevé détecté pour l'instant.
          </p>
        )}
      </div>
    </div>
  );
}
