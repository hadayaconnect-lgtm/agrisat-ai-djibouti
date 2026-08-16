"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ZONES, getZoneById, centroideZone } from "@/lib/zones";
import type { ZoneData } from "@/lib/types";
import { Header } from "@/components/Header";
import { AgricultureDashboard } from "@/components/AgricultureDashboard";
import { ZonePanel } from "@/components/ZonePanel";
import { MapLegend } from "@/components/MapLegend";
import { RankingStrip } from "@/components/RankingStrip";
import { TopZonesPanel } from "@/components/TopZonesPanel";
import { Footer } from "@/components/Footer";
import { useNationalScoreTiles } from "@/components/NationalScoreLayer";

const ZonesMap = dynamic(
  () => import("@/components/ZonesMap").then((m) => m.ZonesMap),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center font-body text-sm text-stone-800">Chargement de la carte…</div> }
);

export default function Home() {
  const [zoneSelectionneeId, setZoneSelectionneeId] = useState<string | null>(ZONES[0]?.zone_id ?? null);
  const [zoneDynamique, setZoneDynamique] = useState<ZoneData | null>(null);
  const [chargementPoint, setChargementPoint] = useState(false);
  const [erreurPoint, setErreurPoint] = useState<string | null>(null);

  const { data: tuilesNationales, statut: statutTuiles } = useNationalScoreTiles();

  const zonePilote = zoneSelectionneeId ? getZoneById(zoneSelectionneeId) : undefined;
  const zoneAffichee = zoneDynamique ?? zonePilote;

  const flyToPosition = zoneAffichee
    ? zoneAffichee.coordonnees_polygone.length > 0
      ? centroideZone(zoneAffichee.coordonnees_polygone)
      : null
    : null;

  async function handleClicCarte(lat: number, lon: number) {
    setZoneSelectionneeId(null);
    setChargementPoint(true);
    setErreurPoint(null);
    try {
      const res = await fetch(`/api/zone-indicators?lat=${lat}&lon=${lon}`);
      const json = await res.json();
      if (json.erreur) {
        setErreurPoint(json.erreur);
        setZoneDynamique(null);
      } else {
        setZoneDynamique(json as ZoneData);
      }
    } catch {
      setErreurPoint("Impossible de contacter le service d'analyse.");
      setZoneDynamique(null);
    } finally {
      setChargementPoint(false);
    }
  }

  function handleSelectZonePilote(id: string) {
    setZoneDynamique(null);
    setZoneSelectionneeId(id);
  }

  return (
    <div className="flex h-screen flex-col overflow-y-auto lg:overflow-hidden">
      <Header />
      <AgricultureDashboard onExplorerZone={handleClicCarte} />

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative h-[45vh] shrink-0 lg:h-auto lg:flex-1">
          <ZonesMap
            zones={ZONES}
            zoneSelectionnee={zoneSelectionneeId}
            onSelectZone={handleSelectZonePilote}
            flyToPosition={flyToPosition}
            nationalTileUrl={tuilesNationales?.tile_url_template ?? null}
            onClickCarte={handleClicCarte}
          />
          <MapLegend />
          {statutTuiles === "chargement" && (
            <div className="telemetry absolute right-4 top-4 z-[1000] rounded bg-sand-50/95 px-3 py-1.5">
              Chargement de la couche nationale…
            </div>
          )}
          {statutTuiles === "erreur" && (
            <div className="absolute right-4 top-4 z-[1000] rounded bg-potentiel-defavorable/10 px-3 py-1.5 font-body text-xs text-potentiel-defavorable">
              Couche nationale indisponible — les 3 zones pilotes restent affichées.
            </div>
          )}
        </div>

        <div className="w-full overflow-y-auto border-t border-sand-200 lg:w-[420px] lg:border-l lg:border-t-0">
          {chargementPoint ? (
            <div className="flex h-full items-center justify-center p-8 text-center font-body text-sm text-stone-800">
              Analyse du point en cours (Sentinel-2, CHIRPS, ERA5-Land)…
            </div>
          ) : erreurPoint ? (
            <div className="flex h-full items-center justify-center p-8 text-center font-body text-sm text-potentiel-defavorable">
              {erreurPoint}
            </div>
          ) : zoneAffichee ? (
            <ZonePanel zone={zoneAffichee} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center font-body text-sm text-stone-800">
              Cliquez n'importe où sur la carte pour analyser un point, ou sélectionnez une zone pilote ci-dessous.
            </div>
          )}
        </div>
      </div>

      <RankingStrip
        zones={ZONES}
        zoneSelectionnee={zoneSelectionneeId}
        onSelectZone={handleSelectZonePilote}
      />

      <TopZonesPanel onSelectPoint={handleClicCarte} />

      <Footer />
    </div>
  );
}
