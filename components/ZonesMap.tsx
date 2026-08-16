"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import type { ZoneData } from "@/lib/types";
import { centroideZone, CATEGORIE_COULEUR } from "@/lib/zones";
import { NationalScoreLayer } from "./NationalScoreLayer";
import "leaflet/dist/leaflet.css";

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 11, { duration: 0.8 });
    }
  }, [position, map]);
  return null;
}

function ClicCarte({ onClickPoint }: { onClickPoint: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClickPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function ZonesMap({
  zones,
  zoneSelectionnee,
  onSelectZone,
  flyToPosition,
  nationalTileUrl,
  onClickCarte,
}: {
  zones: ZoneData[];
  zoneSelectionnee: string | null;
  onSelectZone: (id: string) => void;
  flyToPosition: [number, number] | null;
  nationalTileUrl?: string | null;
  onClickCarte?: (lat: number, lon: number) => void;
}) {
  const centreDjibouti: [number, number] = [11.6, 42.7];

  return (
    <MapContainer
      center={centreDjibouti}
      zoom={9}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
      />
      {nationalTileUrl && <NationalScoreLayer tileUrlTemplate={nationalTileUrl} />}
      {onClickCarte && <ClicCarte onClickPoint={onClickCarte} />}
      <FlyTo position={flyToPosition} />
      {zones.map((zone) => {
        const [lat, lon] = centroideZone(zone.coordonnees_polygone);
        const categorie = zone.score_potentiel.categorie;
        const couleur = categorie ? CATEGORIE_COULEUR[categorie] : "#9C948A";
        const estSelectionnee = zoneSelectionnee === zone.zone_id;

        return (
          <CircleMarker
            key={zone.zone_id}
            center={[lat, lon]}
            radius={estSelectionnee ? 14 : 10}
            pathOptions={{
              fillColor: couleur,
              fillOpacity: 0.85,
              color: "#F6F1E7",
              weight: 2,
            }}
            eventHandlers={{ click: () => onSelectZone(zone.zone_id) }}
          >
            <Popup>
              <div className="font-body">
                <p className="font-display font-semibold">{zone.nom}</p>
                <p className="font-mono text-sm">
                  {zone.score_potentiel.score !== null ? `${zone.score_potentiel.score}/100` : "N/D"}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

