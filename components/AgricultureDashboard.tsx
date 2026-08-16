"use client";

import { useEffect, useState } from "react";

interface TopZone {
  score: number;
  superficie_km2: number;
  centroide: { lat: number; lon: number };
  niveau_confiance: string;
  raison_principale: string;
  vegetation: string;
  eau: string;
}

interface TopZonesResponse {
  zones: TopZone[];
  avertissement: string;
  erreur?: string;
}

const NIVEAU_STYLE: Record<string, { label: string; couleur: string }> = {
  bonne: { label: "Bonne", couleur: "#2E7D6B" },
  moyenne: { label: "Moyenne", couleur: "#C99A3D" },
  faible: { label: "Faible", couleur: "#C97A2B" },
  indisponible: { label: "Indisponible", couleur: "#9C948A" },
};

function Pastille({ niveau }: { niveau: string }) {
  const info = NIVEAU_STYLE[niveau] ?? NIVEAU_STYLE.indisponible;
  return (
    <span className="inline-flex items-center gap-1.5 font-body text-xs text-stone-800">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: info.couleur }} />
      {info.label}
    </span>
  );
}

export function AgricultureDashboard({ onExplorerZone }: { onExplorerZone: (lat: number, lon: number) => void }) {
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

  return (
    <section className="border-b border-sand-200 bg-signal/5 px-5 py-5">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-base font-semibold text-signal">
          Meilleures zones pour l'agriculture à Djibouti
        </h2>
        <p className="mt-1 font-body text-sm text-stone-800">
          Zones où la végétation et l'eau disponible sont les plus favorables, d'après l'observation
          satellitaire (Sentinel-2, CHIRPS, ERA5-Land).
        </p>

        {statut === "chargement" && (
          <p className="mt-4 font-body text-sm text-stone-800">Analyse du territoire en cours…</p>
        )}

        {statut === "erreur" && (
          <p className="mt-4 font-body text-sm text-potentiel-defavorable">
            Synthèse indisponible pour le moment — les zones pilotes restent consultables plus bas sur la page.
          </p>
        )}

        {statut === "pret" && data && data.zones.length === 0 && (
          <p className="mt-4 font-body text-sm text-potentiel-insuffisant">
            Aucune zone à potentiel élevé détectée pour l'instant sur l'ensemble du territoire.
          </p>
        )}

        {statut === "pret" && data && data.zones.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.zones.slice(0, 6).map((zone, i) => (
              <button
                key={i}
                onClick={() => onExplorerZone(zone.centroide.lat, zone.centroide.lon)}
                className="rounded border border-sand-200 bg-sand-50 p-4 text-left transition hover:border-signal/50 hover:shadow-sm"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm font-semibold text-stone-900">Zone #{i + 1}</span>
                  <span className="font-mono text-lg font-bold text-potentiel-eleve">{zone.score}</span>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-stone-800">Végétation</span>
                    <Pastille niveau={zone.vegetation} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-stone-800">Eau disponible</span>
                    <Pastille niveau={zone.eau} />
                  </div>
                </div>
                <p className="telemetry mt-2">
                  {zone.superficie_km2} KM² · {zone.centroide.lat.toFixed(3)}, {zone.centroide.lon.toFixed(3)}
                </p>
              </button>
            ))}
          </div>
        )}

        {data && (
          <p className="mt-4 font-body text-xs italic text-stone-800">{data.avertissement}</p>
        )}
      </div>
    </section>
  );
}
