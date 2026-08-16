"""
Vercel Function (Python) — /api/zone-indicators?lat=..&lon=..

Appelée quand l'utilisateur clique n'importe où sur la carte nationale.
Interroge Earth Engine pour ce point précis (buffer ~250 m autour du clic,
cohérent avec la résolution d'analyse de 500 m utilisée pour la couche
nationale) et retourne un objet au même format que les fichiers
data/zones/*.json des 3 zones pilotes, pour réutiliser ZonePanel.tsx
sans adaptation côté frontend.

Aucune donnée n'est inventée : si Earth Engine ne renvoie rien pour un
indicateur (nuages persistants, zone hors couverture), le champ correspondant
est marqué "indisponible", jamais interpolé.
"""

import json
import os
import statistics
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import ee

BUFFER_M = 250
SCALE_M = 30

NDVI_MIN, NDVI_MAX = 0.0, 0.35
PLUIE_MIN, PLUIE_MAX = 0.0, 2.5
TEMP_OPT_MIN, TEMP_OPT_MAX = 18.0, 32.0
TEMP_PENALITE_MAX = 45.0
PENTE_OPT_MAX = 2.0
PENTE_LIMITE = 20.0
POIDS_NOMINAUX = {"vegetation": 0.30, "eau": 0.30, "temperature": 0.15, "topographie": 0.15, "stabilite": 0.10}


def initialiser_earth_engine():
    import base64
    project_id = os.environ["GEE_PROJECT_ID"]
    service_account_email = os.environ["GEE_SERVICE_ACCOUNT_EMAIL"]
    key_b64 = os.environ["GEE_SERVICE_ACCOUNT_KEY_B64"]
    key_json = base64.b64decode(key_b64).decode("utf-8")
    credentials = ee.ServiceAccountCredentials(service_account_email, key_data=key_json)
    ee.Initialize(credentials, project=project_id)


def champ_indisponible(source, methode):
    return {
        "valeur": None, "unite": None, "source": source, "date_observation": None,
        "resolution_spatiale": None, "methode": methode, "statut": "indisponible",
        "nombre_observations": None,
    }


def ndvi_ndmi_pour_annee(point_geom, annee):
    col = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(point_geom)
        .filterDate(f"{annee}-01-01", f"{annee}-12-31" if annee < 2026 else "2026-08-15")
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
    )
    nb_images = col.size().getInfo()
    if nb_images == 0:
        return None, None, 0

    def masquer_et_indices(img):
        masque = img.select("MSK_CLDPRB").lt(40)
        img = img.updateMask(masque)
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ndmi = img.normalizedDifference(["B8", "B11"]).rename("NDMI")
        return img.addBands([ndvi, ndmi])

    composite = col.map(masquer_et_indices).median()
    stats = composite.select(["NDVI", "NDMI"]).reduceRegion(
        reducer=ee.Reducer.mean(), geometry=point_geom, scale=10, maxPixels=1e9, bestEffort=True
    ).getInfo()
    return stats.get("NDVI"), stats.get("NDMI"), nb_images


def calculer_indicateurs(lat, lon):
    point = ee.Geometry.Point([lon, lat]).buffer(BUFFER_M)

    historique = {}
    for annee in [2022, 2023, 2024, 2025, 2026]:
        ndvi, ndmi, nb_obs = ndvi_ndmi_pour_annee(point, annee)
        periode = f"{annee}-01-01/{annee}-12-31" if annee < 2026 else "2026-01-01/2026-08-15"
        if ndvi is None:
            historique[str(annee)] = {
                "ndvi": champ_indisponible("Copernicus Sentinel-2 SR Harmonized", "Aucune image exploitable"),
                "ndmi": champ_indisponible("Copernicus Sentinel-2 SR Harmonized", "Aucune image exploitable"),
            }
        else:
            base = {
                "unite": "indice sans dimension (-1 à 1)",
                "source": "Copernicus Sentinel-2 SR Harmonized (ESA/Copernicus, via Google Earth Engine)",
                "date_observation": periode,
                "resolution_spatiale": "10 m",
                "statut": "calculee",
                "nombre_observations": nb_obs,
            }
            historique[str(annee)] = {
                "ndvi": {**base, "valeur": round(ndvi, 4) if ndvi is not None else None,
                         "methode": "Composite médian, masquage nuageux, NDVI = (B8-B4)/(B8+B4)"},
                "ndmi": {**base, "valeur": round(ndmi, 4) if ndmi is not None else None,
                         "methode": "NDMI = (B8-B11)/(B8+B11)"},
            }

    dem = ee.Image("USGS/SRTMGL1_003")
    pente_img = ee.Terrain.slope(dem)
    topo_stats = ee.Image.cat([dem.rename("elevation"), pente_img.rename("pente")]).reduceRegion(
        reducer=ee.Reducer.mean(), geometry=point, scale=SCALE_M, maxPixels=1e9, bestEffort=True
    ).getInfo()

    chirps = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterDate("2022-01-01", "2025-12-31")
        .filterBounds(point)
        .mean()
    )
    pluie_valeur = chirps.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=point, scale=5500, maxPixels=1e9, bestEffort=True
    ).getInfo().get("precipitation")

    era5 = (
        ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR")
        .filterDate("2022-01-01", "2025-12-31")
        .filterBounds(point)
        .select("temperature_2m")
        .mean()
    )
    temp_kelvin = era5.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=point, scale=11000, maxPixels=1e9, bestEffort=True
    ).getInfo().get("temperature_2m")
    temp_valeur = round(temp_kelvin - 273.15, 2) if temp_kelvin is not None else None

    return historique, topo_stats, pluie_valeur, temp_valeur


def normaliser(v, mini, maxi):
    if v is None:
        return None
    return max(0.0, min(1.0, (v - mini) / (maxi - mini)))


def score_temperature(t):
    if t is None:
        return None
    if TEMP_OPT_MIN <= t <= TEMP_OPT_MAX:
        return 1.0
    if t < TEMP_OPT_MIN:
        return max(0.0, 1.0 - (TEMP_OPT_MIN - t) / 10.0)
    return max(0.0, 1.0 - (t - TEMP_OPT_MAX) / (TEMP_PENALITE_MAX - TEMP_OPT_MAX))


def score_pente(p):
    if p is None:
        return None
    if p <= PENTE_OPT_MAX:
        return 1.0
    if p >= PENTE_LIMITE:
        return 0.0
    return 1.0 - (p - PENTE_OPT_MAX) / (PENTE_LIMITE - PENTE_OPT_MAX)


def score_stabilite(historique):
    valides = [h["ndvi"]["valeur"] for h in historique.values() if h["ndvi"]["statut"] != "indisponible"]
    obs = sum(h["ndvi"].get("nombre_observations") or 0 for h in historique.values() if h["ndvi"]["statut"] != "indisponible")
    if len(valides) < 2:
        return None
    moyenne = statistics.mean(valides)
    if moyenne == 0:
        return 0.0
    cv = statistics.pstdev(valides) / moyenne
    return round(0.7 * max(0.0, 1.0 - min(cv, 1.0)) + 0.3 * min(1.0, obs / 300.0), 4)


def potentiel_eau_souterraine(historique, pente, pluie):
    """
    Indicateur INDIRECT uniquement -- ne détecte jamais une nappe.
    Combine : dépression topographique relative (pente faible favorise
    l'infiltration/rétention), végétation persistante (indice indirect
    de sub-surface humide), et pluviométrie. Chaque composante manquante
    est exclue, jamais remplacée.
    """
    ndvi_valides = [h["ndvi"]["valeur"] for h in historique.values() if h["ndvi"]["statut"] != "indisponible"]
    composantes = {}

    if pente is not None:
        # Pente faible -> meilleure rétention/infiltration (indice indirect, pas une mesure d'eau)
        composantes["topographie"] = max(0.0, min(1.0, 1.0 - pente / 15.0))
    if ndvi_valides:
        composantes["vegetation_persistante"] = max(0.0, min(1.0, statistics.mean(ndvi_valides) / 0.2))
    if pluie is not None:
        composantes["pluviometrie"] = max(0.0, min(1.0, pluie / 2.0))

    if not composantes:
        return {
            "niveau": "indetermine", "niveau_confiance": "faible",
            "indicateurs_utilises": [], "indicateurs_manquants": ["topographie", "vegetation_persistante", "pluviometrie", "sentinel1_radar", "geologie", "grace"],
            "avertissement": "Données insuffisantes pour estimer un potentiel de présence d'eau souterraine.",
        }

    score_moyen = sum(composantes.values()) / len(composantes)
    if score_moyen >= 0.6:
        niveau = "eleve"
    elif score_moyen >= 0.35:
        niveau = "modere"
    else:
        niveau = "faible"

    confiance = "moyen" if len(composantes) >= 2 else "faible"  # jamais "élevé" -- indicateurs indirects seulement

    return {
        "niveau": niveau,
        "niveau_confiance": confiance,
        "indicateurs_utilises": list(composantes.keys()),
        "indicateurs_manquants": ["sentinel1_radar", "geologie", "grace"],
        "avertissement": (
            "Potentiel de présence d'eau souterraine -- PAS une détection. "
            "Basé uniquement sur des indices indirects (topographie, végétation, pluie). "
            "Une étude hydrogéologique de terrain reste indispensable avant tout forage."
        ),
    }


def calculer_score(historique, pente, pluie, temp):
    annees = sorted(historique.keys(), reverse=True)
    ndvi_recent = next(
        (historique[a]["ndvi"]["valeur"] for a in annees if historique[a]["ndvi"]["statut"] != "indisponible"),
        None,
    )
    bruts = {
        "vegetation": normaliser(ndvi_recent, NDVI_MIN, NDVI_MAX),
        "eau": normaliser(pluie, PLUIE_MIN, PLUIE_MAX),
        "temperature": score_temperature(temp),
        "topographie": score_pente(pente),
        "stabilite": score_stabilite(historique),
    }
    dispo = {k: v for k, v in bruts.items() if v is not None}
    manquants = [k for k in bruts if bruts[k] is None]
    if not dispo:
        return {"score": None, "niveau_confiance": "indetermine", "libelle": "Potentiel satellitaire estimé",
                "detail_indicateurs": bruts, "indicateurs_manquants": manquants, "poids_utilises": {},
                "avertissement": "Données insuffisantes pour cette zone."}

    poids = {k: POIDS_NOMINAUX[k] for k in dispo}
    somme = sum(poids.values())
    poids_norm = {k: v / somme for k, v in poids.items()}
    score_final = round(sum(dispo[k] * poids_norm[k] for k in dispo) * 100)

    if score_final >= 65:
        cat = "potentiel_eleve"
    elif score_final >= 45:
        cat = "potentiel_modere"
    elif score_final >= 25:
        cat = "potentiel_faible"
    else:
        cat = "conditions_defavorables"

    confiance = "eleve" if len(dispo) == 5 else ("moyen" if len(dispo) >= 3 else "faible")

    return {
        "score": score_final, "categorie": cat, "niveau_confiance": confiance,
        "libelle": "Potentiel satellitaire estimé",
        "detail_indicateurs": {k: round(v, 4) for k, v in bruts.items() if v is not None},
        "indicateurs_manquants": manquants, "poids_utilises": {k: round(v, 4) for k, v in poids_norm.items()},
        "avertissement": "Ce score est un Potentiel satellitaire estimé, PAS un terrain cultivable confirmé.",
    }


def handler_get(lat, lon):
    initialiser_earth_engine()
    historique, topo_stats, pluie_valeur, temp_valeur = calculer_indicateurs(lat, lon)

    pente_valeur = topo_stats.get("pente")
    elevation_valeur = topo_stats.get("elevation")

    score = calculer_score(historique, pente_valeur, pluie_valeur, temp_valeur)
    eau_souterraine = potentiel_eau_souterraine(historique, pente_valeur, pluie_valeur)

    return {
        "zone_id": f"pt_{lat:.4f}_{lon:.4f}",
        "nom": f"Point ({lat:.4f}, {lon:.4f})",
        "description": "Zone sélectionnée sur la carte nationale",
        "coordonnees_polygone": [],
        "date_extraction": None,
        "niveau_confiance_global": score["niveau_confiance"],
        "historique_vegetation": historique,
        "topographie": {
            "elevation_m": {
                "valeur": round(elevation_valeur, 1) if elevation_valeur is not None else None,
                "unite": "mètres", "source": "USGS SRTM GL1 (NASA/USGS, via Google Earth Engine)",
                "date_observation": "2000", "resolution_spatiale": "30 m",
                "methode": "Moyenne spatiale sur un buffer de 250 m",
                "statut": "reelle" if elevation_valeur is not None else "indisponible",
                "nombre_observations": None,
            },
            "pente_deg": {
                "valeur": round(pente_valeur, 2) if pente_valeur is not None else None,
                "unite": "degrés", "source": "USGS SRTM GL1 (dérivé), via Google Earth Engine",
                "date_observation": "2000", "resolution_spatiale": "30 m",
                "methode": "ee.Terrain.slope(), moyenne sur un buffer de 250 m",
                "statut": "calculee" if pente_valeur is not None else "indisponible",
                "nombre_observations": None,
            },
        },
        "avertissement": "Analyse préliminaire basée sur l'observation satellitaire. Vérification terrain nécessaire.",
        "climat": {
            "precipitation": {
                "valeur": round(pluie_valeur, 2) if pluie_valeur is not None else None,
                "unite": "mm/jour", "source": "CHIRPS Daily (UCSB-CHG, via Google Earth Engine)",
                "date_observation": "2022-01/2025-12", "resolution_spatiale": "~5.5 km",
                "methode": "Moyenne journalière 2022-2025",
                "statut": "reelle" if pluie_valeur is not None else "indisponible",
                "nombre_observations": None,
            },
            "temperature": {
                "valeur": temp_valeur,
                "unite": "°C", "source": "ERA5-Land Monthly Aggregated (ECMWF, via Google Earth Engine)",
                "date_observation": "2022-01/2025-12", "resolution_spatiale": "~11 km",
                "methode": "Moyenne mensuelle 2022-2025, conversion Kelvin -> Celsius",
                "statut": "reelle" if temp_valeur is not None else "indisponible",
                "nombre_observations": None,
            },
            "precipitation_annuelle": {}, "temperature_annuelle": {},
        },
        "score_potentiel": score,
        "potentiel_eau_souterraine": eau_souterraine,
        "analyse_qualitative": {
            "points_favorables": [], "points_vigilance": [], "a_verifier_terrain": [],
            "recommandation": (
                "Zone intéressante pour une étude complémentaire."
                if score["score"] is not None and score["score"] >= 45
                else "Potentiel limité d'après les indicateurs disponibles. Vérification terrain recommandée avant toute décision."
            ),
        },
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            lat = float(query["lat"][0])
            lon = float(query["lon"][0])
            resultat = handler_get(lat, lon)
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(resultat).encode("utf-8"))
        except KeyError:
            self.send_response(400)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"erreur": "Paramètres lat et lon requis"}).encode("utf-8"))
        except Exception as e:  # noqa: BLE001
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"erreur": str(e)}).encode("utf-8"))
        return
