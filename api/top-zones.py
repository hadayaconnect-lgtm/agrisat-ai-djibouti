"""
Vercel Function (Python) — /api/top-zones

Détecte automatiquement les secteurs à potentiel élevé sur tout le
territoire en regroupant les pixels voisins dont le score dépasse le
seuil "potentiel élevé" (>=65), puis retourne les 10 meilleurs
regroupements avec localisation, superficie approximative, score moyen,
confiance et la raison principale du classement.

Réutilise exactement la même construction d'image que
national-score-tiles.py (dupliquée ici intentionnellement -- chaque
fonction Vercel est empaquetée indépendamment, partager un module a
causé des soucis de configuration par le passé sur ce projet).
"""

import json
import os
from http.server import BaseHTTPRequestHandler

import ee

NDVI_MIN, NDVI_MAX = 0.0, 0.35
PLUIE_MIN, PLUIE_MAX = 0.0, 2.5
TEMP_OPT_MIN, TEMP_OPT_MAX = 18.0, 32.0
TEMP_PENALITE_MAX = 45.0
PENTE_OPT_MAX = 2.0
PENTE_LIMITE = 20.0
POIDS = {"vegetation": 0.30, "eau": 0.30, "temperature": 0.15, "topographie": 0.15, "stabilite": 0.10}
SEUIL_POTENTIEL_ELEVE = 65
SUPERFICIE_MIN_KM2 = 0.5  # filtre les clusters de bruit (quelques pixels isolés)

RAISONS = {
    "vegetation": "Végétation particulièrement favorable (NDVI élevé et stable)",
    "eau": "Pluviométrie relativement plus favorable que les secteurs voisins",
    "temperature": "Conditions de température optimales",
    "topographie": "Pente très favorable, facilite l'exploitation",
}


def initialiser_earth_engine():
    import base64
    project_id = os.environ["GEE_PROJECT_ID"]
    service_account_email = os.environ["GEE_SERVICE_ACCOUNT_EMAIL"]
    key_b64 = os.environ["GEE_SERVICE_ACCOUNT_KEY_B64"]
    key_json = base64.b64decode(key_b64).decode("utf-8")
    credentials = ee.ServiceAccountCredentials(service_account_email, key_data=key_json)
    ee.Initialize(credentials, project=project_id)


def limite_djibouti():
    pays = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    return pays.filter(ee.Filter.eq("country_na", "Djibouti")).geometry()


def construire_images_score(boundary):
    s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(boundary)

    def composite_annee(annee):
        col = (
            s2.filterDate(f"{annee}-01-01", f"{annee}-12-31")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
            .map(lambda img: img.updateMask(img.select("MSK_CLDPRB").lt(40)))
        )
        return col.median().normalizedDifference(["B8", "B4"]).rename("NDVI")

    annees = [2022, 2023, 2024, 2025, 2026]
    composites = [composite_annee(a) for a in annees]
    pile_ndvi = ee.ImageCollection.fromImages(composites)
    ndvi_recent = composites[-1]
    ndvi_stddev = pile_ndvi.reduce(ee.Reducer.stdDev())
    ndvi_moyenne = pile_ndvi.reduce(ee.Reducer.mean())
    cv = ndvi_stddev.divide(ndvi_moyenne.max(0.01)).min(1.0)
    score_stabilite = ee.Image(1.0).subtract(cv)
    score_vegetation = ndvi_recent.subtract(NDVI_MIN).divide(NDVI_MAX - NDVI_MIN).clamp(0, 1)

    chirps = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterDate("2022-01-01", "2025-12-31").filterBounds(boundary).mean()
    )
    score_eau = chirps.subtract(PLUIE_MIN).divide(PLUIE_MAX - PLUIE_MIN).clamp(0, 1)

    era5 = (
        ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR")
        .filterDate("2022-01-01", "2025-12-31").filterBounds(boundary)
        .select("temperature_2m").mean().subtract(273.15)
    )
    dans_optimum = era5.gte(TEMP_OPT_MIN).And(era5.lte(TEMP_OPT_MAX))
    ecart_chaud = era5.subtract(TEMP_OPT_MAX).divide(TEMP_PENALITE_MAX - TEMP_OPT_MAX)
    score_temp_chaud = ee.Image(1.0).subtract(ecart_chaud).clamp(0, 1)
    score_temperature = dans_optimum.multiply(1.0).add(dans_optimum.Not().multiply(score_temp_chaud))

    dem = ee.Image("USGS/SRTMGL1_003")
    pente = ee.Terrain.slope(dem)
    score_topo = ee.Image(1.0).subtract(
        pente.subtract(PENTE_OPT_MAX).divide(PENTE_LIMITE - PENTE_OPT_MAX)
    ).clamp(0, 1)

    score = (
        score_vegetation.multiply(POIDS["vegetation"])
        .add(score_eau.multiply(POIDS["eau"]))
        .add(score_temperature.multiply(POIDS["temperature"]))
        .add(score_topo.multiply(POIDS["topographie"]))
        .add(score_stabilite.multiply(POIDS["stabilite"]))
        .multiply(100)
        .rename("score")
    )
    masque_donnees = ndvi_recent.mask()

    composantes = ee.Image.cat([
        score.updateMask(masque_donnees),
        score_vegetation.rename("c_vegetation"),
        score_eau.rename("c_eau"),
        score_temperature.rename("c_temperature"),
        score_topo.rename("c_topographie"),
    ]).clip(boundary)

    return composantes, masque_donnees


def detecter_top_zones():
    boundary = limite_djibouti()
    composantes, masque = construire_images_score(boundary)
    score = composantes.select("score")

    masque_eleve = score.gte(SEUIL_POTENTIEL_ELEVE)
    clusters = masque_eleve.selfMask().connectedComponents(
        connectedness=ee.Kernel.plus(1), maxSize=4096
    )

    vecteurs = clusters.select("labels").reduceToVectors(
        geometry=boundary, scale=100, geometryType="polygon",
        eightConnected=True, maxPixels=1e10, bestEffort=True,
    )

    stats = composantes.reduceRegions(
        collection=vecteurs, reducer=ee.Reducer.mean().combine(ee.Reducer.count(), sharedInputs=True),
        scale=100,
    )

    resultats = stats.getInfo()
    return resultats["features"]


def traiter_resultats(features):
    zones = []
    for f in features:
        props = f.get("properties", {})
        score_moyen = props.get("score_mean")
        nb_pixels = props.get("score_count", 0)
        if score_moyen is None or nb_pixels == 0:
            continue

        superficie_km2 = round(nb_pixels * (100 * 100) / 1_000_000, 2)  # pixels de 100m
        if superficie_km2 < SUPERFICIE_MIN_KM2:
            continue

        composantes = {
            "vegetation": props.get("c_vegetation_mean"),
            "eau": props.get("c_eau_mean"),
            "temperature": props.get("c_temperature_mean"),
            "topographie": props.get("c_topographie_mean"),
        }
        cle_dominante = max(
            (k for k in composantes if composantes[k] is not None),
            key=lambda k: composantes[k],
            default=None,
        )
        raison = RAISONS.get(cle_dominante, "Combinaison favorable de plusieurs indicateurs")

        def niveau_qualitatif(v):
            if v is None:
                return "indisponible"
            if v >= 0.6:
                return "bonne"
            if v >= 0.35:
                return "moyenne"
            return "faible"

        geom = f.get("geometry", {})
        coords = geom.get("coordinates", [[]])
        try:
            premier_anneau = coords[0]
            lons = [c[0] for c in premier_anneau]
            lats = [c[1] for c in premier_anneau]
            centroide = [sum(lats) / len(lats), sum(lons) / len(lons)]
        except (IndexError, TypeError, ZeroDivisionError):
            continue

        confiance = "eleve" if nb_pixels >= 20 else ("moyen" if nb_pixels >= 5 else "faible")

        zones.append({
            "score": round(score_moyen),
            "superficie_km2": superficie_km2,
            "centroide": {"lat": round(centroide[0], 4), "lon": round(centroide[1], 4)},
            "niveau_confiance": confiance,
            "raison_principale": raison,
            "nb_pixels": int(nb_pixels),
            "vegetation": niveau_qualitatif(composantes["vegetation"]),
            "eau": niveau_qualitatif(composantes["eau"]),
        })

    zones.sort(key=lambda z: (z["score"], z["superficie_km2"]), reverse=True)
    return zones[:10]


def handler_get():
    initialiser_earth_engine()
    features = detecter_top_zones()
    top10 = traiter_resultats(features)
    return {
        "zones": top10,
        "methode": (
            "Regroupement des pixels contigus dont le score dépasse 65/100, "
            "résolution d'analyse 100 m, filtré aux clusters >= 0.5 km²."
        ),
        "avertissement": "Classement automatique basé sur l'observation satellitaire. Vérification terrain requise.",
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            resultat = handler_get()
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "s-maxage=3600, stale-while-revalidate")
            self.end_headers()
            self.wfile.write(json.dumps(resultat).encode("utf-8"))
        except Exception as e:  # noqa: BLE001
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"erreur": str(e)}).encode("utf-8"))
        return
