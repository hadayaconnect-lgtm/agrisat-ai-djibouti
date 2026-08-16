export function Footer() {
  return (
    <footer className="border-t border-sand-200 bg-sand-50 px-5 py-4">
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-signal">
        Sources satellitaires
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        <span className="telemetry">Copernicus Sentinel-2 SR Harmonized (ESA/Copernicus)</span>
        <span className="telemetry">USGS SRTM GL1 (NASA/USGS)</span>
        <span className="telemetry">NASA POWER — réanalyse MERRA-2</span>
        <span className="telemetry">Traitement via Google Earth Engine</span>
      </div>
      <p className="mt-3 max-w-3xl font-body text-xs italic text-stone-800">
        Les résultats constituent une analyse préliminaire basée sur des données satellitaires et
        des modèles d'analyse. Une vérification agronomique, hydrologique et pédologique sur le
        terrain reste nécessaire avant toute mise en culture.
      </p>
    </footer>
  );
}
