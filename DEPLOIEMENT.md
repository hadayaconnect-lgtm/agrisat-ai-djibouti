# AgriSat AI Djibouti — Déploiement de la couche nationale (Vercel)

## Ce qui a changé

Deux fonctions Python ont été ajoutées dans `api/` :

- `api/national-score-tiles.py` — génère la couche de couleur continue sur
  tout le territoire (appelée une fois au chargement de la carte)
- `api/zone-indicators.py` — appelée à chaque clic sur la carte, retourne
  les indicateurs détaillés du point cliqué

Le frontend (`app/page.tsx`) appelle automatiquement ces deux fonctions.
Les 3 zones pilotes (Damerjog, Dikhil, Ali Sabieh) restent affichées comme
avant, en plus de la nouvelle couche continue.

## Variables d'environnement à configurer sur Vercel

Dans le tableau de bord Vercel du projet → Settings → Environment Variables,
ajoute ces 3 variables (ne les mets JAMAIS dans le code ni dans un fichier
commité sur GitHub) :

| Nom | Valeur |
|---|---|
| `GEE_PROJECT_ID` | `agrisat-ai-djibouti` |
| `GEE_SERVICE_ACCOUNT_EMAIL` | `agrisat-ee-runner@agrisat-ai-djibouti.iam.gserviceaccount.com` |
| `GEE_SERVICE_ACCOUNT_KEY_JSON` | Le contenu ENTIER du fichier `.json` de la clé de service (ouvre-le avec Notepad, copie tout, colle ici) |

Coche les 3 environnements (Production, Preview, Development) pour chaque
variable.

## ⚠️ Limite importante à connaître

`zone-indicators.py` fait 5 années de calcul Sentinel-2 + CHIRPS + ERA5-Land
en série pour chaque clic. Ça peut dépasser 10 secondes.

- **Plan Vercel gratuit (Hobby)** : limite stricte de 10 secondes — la
  fonction pourrait être coupée avant la fin sur un point difficile
  (zone très nuageuse par exemple)
- **Plan Vercel Pro** : jusqu'à 60 secondes, largement suffisant

Si tu restes sur le plan gratuit et que ça timeout trop souvent, dis-le-moi :
on peut optimiser en réduisant à 3 ans d'historique au lieu de 5, ou en
parallélisant les appels Earth Engine.

## Déployer

Une fois les variables configurées :

```bash
cd ~/Desktop/agrisat-web
git init
git add .
git commit -m "AgriSat AI Djibouti - couche nationale"
```

Puis pousse vers GitHub et connecte le repo à Vercel (ou utilise `vercel deploy`
si tu as la CLI Vercel installée). Vercel détecte automatiquement Next.js pour
le frontend et les fichiers `api/*.py` comme fonctions Python séparées.

## Ce qui n'est pas encore fait

- **Top 10 des zones prioritaires** (regroupement automatique de cellules
  voisines à score élevé) — pas encore implémenté, prochaine étape
- Les 3 zones pilotes restent en dur dans `data/zones/*.json` — la couche
  nationale est indépendante et ne les recalcule pas
