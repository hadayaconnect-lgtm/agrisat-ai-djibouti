import type { ZoneData, CategoriePotentiel } from "./types";

import damerjog from "@/data/zones/damerjog.json";
import dikhil from "@/data/zones/dikhil.json";
import aliSabieh from "@/data/zones/ali_sabieh.json";

// Les fichiers JSON sont produits par merge_zone_data.py + scoring.py (pipeline Python).
// Le frontend les importe tels quels -- aucune donnée n'est recalculée ni inventée ici.
export const ZONES: ZoneData[] = [
  damerjog as unknown as ZoneData,
  dikhil as unknown as ZoneData,
  aliSabieh as unknown as ZoneData,
];

export function getZoneById(id: string): ZoneData | undefined {
  return ZONES.find((z) => z.zone_id === id);
}

export const CATEGORIE_LABEL: Record<CategoriePotentiel, string> = {
  potentiel_eleve: "Potentiel élevé",
  potentiel_modere: "Potentiel modéré",
  potentiel_faible: "Potentiel faible",
  conditions_defavorables: "Conditions défavorables",
};

export const CATEGORIE_COULEUR: Record<CategoriePotentiel, string> = {
  potentiel_eleve: "#2E7D6B",
  potentiel_modere: "#C99A3D",
  potentiel_faible: "#C97A2B",
  conditions_defavorables: "#A33B2B",
};

export const CATEGORIE_EMOJI: Record<CategoriePotentiel, string> = {
  potentiel_eleve: "🟢",
  potentiel_modere: "🟡",
  potentiel_faible: "🟠",
  conditions_defavorables: "🔴",
};

export function centroideZone(coords: [number, number][]): [number, number] {
  const lats = coords.map((c) => c[1]);
  const lons = coords.map((c) => c[0]);
  const lat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const lon = lons.reduce((a, b) => a + b, 0) / lons.length;
  return [lat, lon];
}

export function ndviRecentEtHistorique(zone: ZoneData) {
  const annees = Object.keys(zone.historique_vegetation).sort();
  const points = annees.map((annee) => {
    const champ = zone.historique_vegetation[annee].ndvi;
    return {
      annee,
      valeur: champ.statut === "indisponible" ? null : champ.valeur,
      statut: champ.statut,
    };
  });
  const dernierDisponible = [...points].reverse().find((p) => p.valeur !== null);
  return { points, ndviRecent: dernierDisponible?.valeur ?? null };
}

// Statistiques synthétiques de la page d'accueil -- UNIQUEMENT calculées à partir
// des zones réellement chargées, jamais de chiffres en dur.
export function statistiquesGlobales() {
  const zonesAnalysees = ZONES.length;
  const potentielEleve = ZONES.filter(
    (z) => z.score_potentiel.categorie === "potentiel_eleve"
  ).length;
  const potentielModere = ZONES.filter(
    (z) => z.score_potentiel.categorie === "potentiel_modere"
  ).length;
  const datesExtraction = ZONES.map((z) => new Date(z.date_extraction).getTime());
  const derniereMiseAJour = new Date(Math.max(...datesExtraction));

  // Superficie approximative de chaque zone (rectangle lon/lat -> km², approximation
  // sphérique simple, suffisante pour un ordre de grandeur affiché au dashboard)
  const superficieTotaleKm2 = ZONES.reduce((total, zone) => {
    const lons = zone.coordonnees_polygone.map((c) => c[0]);
    const lats = zone.coordonnees_polygone.map((c) => c[1]);
    const largeurDeg = Math.max(...lons) - Math.min(...lons);
    const hauteurDeg = Math.max(...lats) - Math.min(...lats);
    const kmParDegLat = 111.32;
    const kmParDegLon = 111.32 * Math.cos((Math.min(...lats) * Math.PI) / 180);
    return total + largeurDeg * kmParDegLon * (hauteurDeg * kmParDegLat);
  }, 0);

  return {
    zonesAnalysees,
    potentielEleve,
    potentielModere,
    superficieTotaleKm2: Math.round(superficieTotaleKm2 * 10) / 10,
    derniereMiseAJour,
  };
}
