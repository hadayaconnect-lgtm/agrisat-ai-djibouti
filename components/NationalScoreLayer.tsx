"use client";

import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";

interface TilesResponse {
  tile_url_template: string;
  legende: Record<string, { label: string; couleur: string }>;
  avertissement: string;
  erreur?: string;
}

export function useNationalScoreTiles() {
  const [data, setData] = useState<TilesResponse | null>(null);
  const [statut, setStatut] = useState<"chargement" | "pret" | "erreur">("chargement");

  useEffect(() => {
    fetch("/api/national-score-tiles")
      .then((r) => r.json())
      .then((json: TilesResponse) => {
        if (json.erreur) {
          setStatut("erreur");
        } else {
          setData(json);
          setStatut("pret");
        }
      })
      .catch(() => setStatut("erreur"));
  }, []);

  return { data, statut };
}

export function NationalScoreLayer({ tileUrlTemplate }: { tileUrlTemplate: string }) {
  return <TileLayer url={tileUrlTemplate} opacity={0.7} attribution="AgriSat AI Djibouti — Google Earth Engine" />;
}
