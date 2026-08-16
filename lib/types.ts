// Types alignés exactement sur le schéma produit par schema.py (pipeline Python).
// Le frontend ne fait AUCUN calcul satellite -- il lit uniquement les résultats
// déjà produits par le pipeline (extract_satellite_data.py, fetch_climate_power.py,
// merge_zone_data.py, scoring.py).

export type Statut = "reelle" | "calculee" | "indisponible";

export interface ChampDonnee {
  valeur: number | null;
  unite: string | null;
  source: string;
  date_observation: string | null;
  resolution_spatiale: string | null;
  methode: string;
  statut: Statut;
  nombre_observations: number | null;
}

export interface PeriodeVegetation {
  ndvi: ChampDonnee;
  ndmi: ChampDonnee;
}

export interface Topographie {
  elevation_m: ChampDonnee;
  pente_deg: ChampDonnee;
}

export interface Climat {
  precipitation: ChampDonnee;
  temperature: ChampDonnee;
  precipitation_annuelle: Record<string, number>;
  temperature_annuelle: Record<string, number>;
}

export type CategoriePotentiel =
  | "potentiel_eleve"
  | "potentiel_modere"
  | "potentiel_faible"
  | "conditions_defavorables";

export type NiveauConfiance = "eleve" | "moyen" | "faible" | "indetermine";

export interface ScorePotentiel {
  score: number | null;
  categorie?: CategoriePotentiel;
  niveau_confiance: NiveauConfiance;
  libelle: string;
  detail_indicateurs: Record<string, number | null>;
  indicateurs_manquants: string[];
  poids_utilises: Record<string, number>;
  avertissement: string;
}

export interface AnalyseQualitative {
  points_favorables: string[];
  points_vigilance: string[];
  a_verifier_terrain: string[];
  recommandation: string;
}

export type NiveauEau = "eleve" | "modere" | "faible" | "indetermine";

export interface PotentielEauSouterraine {
  niveau: NiveauEau;
  niveau_confiance: string;
  indicateurs_utilises: string[];
  indicateurs_manquants: string[];
  avertissement: string;
}

export interface ZoneData {
  zone_id: string;
  nom: string;
  description: string;
  coordonnees_polygone: [number, number][]; // [lon, lat]
  date_extraction: string;
  niveau_confiance_global: NiveauConfiance;
  historique_vegetation: Record<string, PeriodeVegetation>;
  topographie: Topographie;
  avertissement: string;
  climat: Climat;
  score_potentiel: ScorePotentiel;
  analyse_qualitative: AnalyseQualitative;
  potentiel_eau_souterraine?: PotentielEauSouterraine;
}
