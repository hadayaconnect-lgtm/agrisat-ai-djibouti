"""
Vercel Function (Python) — /api/national-score-tiles

Construit une image de score continue sur tout le territoire de Djibouti
et retourne une URL de tuiles XYZ générée par Earth Engine, que le frontend
utilise directement comme calque Leaflet (TileLayer). Les pixels sont
rendus par les serveurs Earth Engine, jamais par notre fonction --
cette fonction ne fait que demander l'URL, elle ne sert aucune image.

Aucun secret n'est jamais renvoyé au frontend : seule l'URL de tuiles
(qui ne contient pas la clé de service) est retournée.

Méthodologie identique à scoring.py (pipeline pilote), traduite en algèbre
d'image Earth Engine pour être appliquée pixel par pixel :
- végétation (30%) : NDVI composite récent (2026), normalisé [0, 0.35]
- eau (30%) : CHIRPS pluviométrie moyenne 2022-2025, normalisée [0, 2.5] mm/j
- température (15%) : ERA5-Land, optimum [18, 32]°C
- topographie (15%) : pente SRTM, optimum <=2°, limite 20°
- stabilité (10%) : inverse de l'écart-type NDVI inter-annuel 2022-2026

Résolution d'analyse : 500 m. Note de transparence : la végétation/topographie
sont réellement plus fines (10-30 m), mais la pluviométrie CHIRPS (~5,5 km) et
la température ERA5-Land (~11 km) sont beaucoup plus grossières -- le rendu à
500 m ne doit pas laisser croire à une précision uniforme sur tous les
indicateurs combinés.
"""

import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import ee

RESOLUTION_M = 500

NDVI_MIN, NDVI_MAX = 0.0, 0.35
PLUIE_MIN, PLUIE_MAX = 0.0, 2.5
TEMP_OPT_MIN, TEMP_OPT_MAX = 18.0, 32.0
TEMP_PENALITE_MAX = 45.0
PENTE_OPT_MAX = 2.0
PENTE_LIMITE = 20.0

POIDS = {"vegetation": 0.30, "eau": 0.30, "temperature": 0.15, "topographie": 0.15, "stabilite": 0.10}

CATEGORIE_COULEURS = {
    0: "9C948A",  # données insuffisantes
    1: "A33B2B",  # conditions défavorables
    2: "C97A2B",  # potentiel faible
    3: "C99A3D",  # potentiel modéré
    4: "2E7D6B",  # potentiel élevé
}


def initialiser_earth_engine():
    import base64
    project_id = os.environ["GEE_PROJECT_ID"]
    service_account_email = os.environ["GEE_SERVICE_ACCOUNT_EMAIL"]
    key_b64 = os.environ["GEE_SERVICE_ACCOUNT_KEY_B64"]  # clé encodée en base64 -- évite toute
    key_json = base64.b64decode(key_b64).decode("utf-8")  # corruption de \n au copier-coller
    credentials = ee.ServiceAccountCredentials(service_account_email, key_data=key_json)
    ee.Initialize(credentials, project=project_id)


def limite_djibouti():
    pays = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    return pays.filter(ee.Filter.eq("country_na", "Djibouti")).geometry()


def construire_image_score(boundary):
    s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(boundary)

    def composite_annee(annee):
        col = (
            s2.filterDate(f"{annee}-01-01", f"{annee}-12-31")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
            .map(lambda img: img.updateMask(img.select("MSK_CLDPRB").lt(40)))
        )
        img = col.median()
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        return ndvi

    annees = [2022, 2023, 2024, 2025, 2026]
    composites = [composite_annee(a) for a in annees]
    pile_ndvi = ee.ImageCollection.fromImages(composites)

    ndvi_recent = composites[-1]  # 2026
    ndvi_stddev = pile_ndvi.reduce(ee.Reducer.stdDev())
    ndvi_moyenne = pile_ndvi.reduce(ee.Reducer.mean())
    # Coefficient de variation -> score de stabilité (borné, évite division par ~0)
    cv = ndvi_stddev.divide(ndvi_moyenne.max(0.01)).min(1.0)
    score_stabilite = ee.Image(1.0).subtract(cv)

    score_vegetation = ndvi_recent.subtract(NDVI_MIN).divide(NDVI_MAX - NDVI_MIN).clamp(0, 1)

    chirps = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterDate("2022-01-01", "2025-12-31")
        .filterBounds(boundary)
        .mean()
        .rename("pluie_mm_jour")
    )
    score_eau = chirps.subtract(PLUIE_MIN).divide(PLUIE_MAX - PLUIE_MIN).clamp(0, 1)

    era5 = (
        ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR")
        .filterDate("2022-01-01", "2025-12-31")
        .filterBounds(boundary)
        .select("temperature_2m")
        .mean()
        .subtract(273.15)  # Kelvin -> Celsius
        .rename("temp_c")
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
    score = score.updateMask(masque_donnees)

    classes = (
        ee.Image(0)
        .where(score.gte(0), 1)
        .where(score.gte(25), 2)
        .where(score.gte(45), 3)
        .where(score.gte(65), 4)
        .updateMask(masque_donnees)
        .rename("classe")
    )

    return score.clip(boundary), classes.clip(boundary)


def handler_get():
    initialiser_earth_engine()
    boundary = limite_djibouti()
    _score_img, classes_img = construire_image_score(boundary)

    vis_params = {
        "min": 0,
        "max": 4,
        "palette": [CATEGORIE_COULEURS[i] for i in range(5)],
    }
    map_id_dict = classes_img.getMapId(vis_params)
    tile_url_template = map_id_dict["tile_fetcher"].url_format

    return {
        "tile_url_template": tile_url_template,
        "resolution_m": RESOLUTION_M,
        "legende": {
            "0": {"label": "Données insuffisantes", "couleur": "#9C948A"},
            "1": {"label": "Conditions défavorables", "couleur": "#A33B2B"},
            "2": {"label": "Potentiel faible", "couleur": "#C97A2B"},
            "3": {"label": "Potentiel modéré", "couleur": "#C99A3D"},
            "4": {"label": "Potentiel élevé", "couleur": "#2E7D6B"},
        },
        "sources": [
            "Copernicus Sentinel-2 SR Harmonized (végétation, 10 m)",
            "USGS SRTM GL1 (topographie, 30 m)",
            "UCSB-CHG CHIRPS Daily (pluviométrie, ~5.5 km)",
            "ECMWF ERA5-Land Monthly (température, ~11 km)",
        ],
        "avertissement": (
            "La résolution affichée (500 m) ne reflète pas une précision uniforme : "
            "la pluviométrie et la température ont une résolution native beaucoup plus "
            "grossière (5-11 km) que la végétation et la topographie."
        ),
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
        except Exception as e:  # noqa: BLE001 -- on veut renvoyer l'erreur au frontend pour debug
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"erreur": str(e)}).encode("utf-8"))
        return
