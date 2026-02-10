/**
 * Composant MapView - Carte interactive Leaflet
 * Affiche les formations sur une carte de France avec marqueurs et popups
 */

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { Formation } from "../../types";
import { StatutFormation, TypeSession } from "../../types";
import { getFormationTemporalStatus } from "../../utils/temporal";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Fix pour les icônes Leaflet avec bundler
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Configuration des icônes par défaut
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

/** Props du composant MapView */
interface MapViewProps {
  /** Liste des formations à afficher */
  formations: Formation[];
  /** Callback quand une formation est sélectionnée */
  onFormationSelect?: (formation: Formation) => void;
  /** Hauteur de la carte (défaut: 100%) */
  height?: string;
  /** Classe CSS additionnelle */
  className?: string;
}

/** Centre par défaut : France métropolitaine */
const DEFAULT_CENTER: L.LatLngExpression = [46.603354, 1.888334];
const DEFAULT_ZOOM = 6;

type ClusterLike = {
  getAllChildMarkers: () => Array<{ formationCount?: number }>;
};

function createClusterCustomIcon(cluster: ClusterLike) {
  const totalFormations = cluster.getAllChildMarkers().reduce((sum, marker) => {
    return sum + (marker.formationCount ?? 1);
  }, 0);

  return L.divIcon({
    html: `
      <div class="orsys-marker-cluster-badge">
        <span class="orsys-marker-cluster-count">${totalFormations}</span>
      </div>
    `,
    className: "orsys-marker-cluster-icon",
    iconSize: L.point(40, 40, true)
  });
}

/** Icône personnalisée pour les formations inter */
function createPinDivIcon(variant: "passee" | "future") {
  return L.divIcon({
    className: `orsys-pin-icon orsys-pin-icon--${variant}`,
    iconSize: [28, 44],
    iconAnchor: [14, 44],
    popupAnchor: [0, -38],
    html: `
      <svg class="orsys-pin" width="28" height="44" viewBox="0 0 24 36" aria-hidden="true">
        <path fill="currentColor" d="M12 36s9-10.2 9-19.1C21 8 16.9 4 12 4S3 8 3 16.9C3 25.8 12 36 12 36zm0-15.6a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"/>
      </svg>
    `
  });
}

const pastPinIcon = createPinDivIcon("passee");
const futurePinIcon = createPinDivIcon("future");

/** Composant pour ajuster la vue de la carte aux marqueurs */
function FitBounds({ formations }: { formations: Formation[] }) {
  const map = useMap();
  const prevBoundsRef = useRef<string>("");

  useEffect(() => {
    const validFormations = formations.filter(
      (f) => f.lieu?.gps?.lat && f.lieu?.gps?.lng
    );

    if (validFormations.length === 0) return;

    // Créer une clé unique pour les bounds actuelles
    const boundsKey = validFormations
      .map((f) => `${f.lieu.gps!.lat},${f.lieu.gps!.lng}`)
      .join("|");

    // Ne pas refaire le fit si les bounds n'ont pas changé
    if (boundsKey === prevBoundsRef.current) return;
    prevBoundsRef.current = boundsKey;

    const bounds = L.latLngBounds(
      validFormations.map((f) => [f.lieu.gps!.lat, f.lieu.gps!.lng])
    );

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 12
    });
  }, [formations, map]);

  return null;
}

/** Formater une date pour l'affichage */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/** Formater le statut pour l'affichage */
function getStatutBadge(statut: string): { text: string; className: string } {
  if (statut === StatutFormation.ANNULEE) {
    return {
      text: "Annulée",
      className: "bg-red-500/20 text-red-400 border-red-500/30"
    };
  }
  return {
    text: "Confirmée",
    className: "bg-green-500/20 text-green-400 border-green-500/30"
  };
}

/** Formater le type de session */
function getTypeBadge(type: string): { text: string; className: string } {
  if (type === TypeSession.INTRA) {
    return {
      text: "Intra",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30"
    };
  }
  return {
    text: "Inter",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30"
  };
}

/**
 * Composant principal MapView
 */
export function MapView({
  formations,
  onFormationSelect,
  height = "100%",
  className = ""
}: MapViewProps) {
  // Filtrer les formations avec des coordonnées GPS valides
  const formationsWithGPS = useMemo(() => {
    return formations.filter(
      (f) =>
        f.lieu?.gps?.lat !== undefined &&
        f.lieu?.gps?.lng !== undefined &&
        !isNaN(f.lieu.gps.lat) &&
        !isNaN(f.lieu.gps.lng)
    );
  }, [formations]);

  // Compter les lieux uniques (info seulement, le clustering gère la lisibilité)
  const uniqueLocationCount = useMemo(() => {
    const keys = new Set<string>();
    for (const f of formationsWithGPS) {
      const lat = f.lieu!.gps!.lat;
      const lng = f.lieu!.gps!.lng;
      keys.add(`${lat.toFixed(4)},${lng.toFixed(4)}`);
    }
    return keys.size;
  }, [formationsWithGPS]);

  const handleMarkerClick = (formation: Formation) => {
    if (onFormationSelect) {
      onFormationSelect(formation);
    }
  };

  // Message si aucune formation avec GPS
  if (formations.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-[#16213e] rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-lg font-medium">Aucune formation à afficher</p>
          <p className="text-sm mt-1">
            Extrayez les emails pour voir les formations sur la carte
          </p>
        </div>
      </div>
    );
  }

  if (formationsWithGPS.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-[#16213e] rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-lg font-medium">Aucune coordonnée GPS</p>
          <p className="text-sm mt-1">
            Les formations n'ont pas encore été géocodées
          </p>
          <p className="text-xs mt-2 text-gray-500">
            {formations.length} formation(s) sans localisation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Badge avec le nombre de formations */}
      <div className="absolute top-4 right-4 z-1000 bg-orsys-dark/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[#16213e]">
        <span className="text-sm text-gray-300">
          <span className="font-semibold text-white">
            {formationsWithGPS.length}
          </span>{" "}
          formation{formationsWithGPS.length > 1 ? "s" : ""} sur{" "}
          {uniqueLocationCount} lieu
          {uniqueLocationCount > 1 ? "x" : ""}
        </span>
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full rounded-lg"
        style={{ background: "#1a1a2e" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds formations={formationsWithGPS} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          zoomToBoundsOnClick
        >
          {formationsWithGPS.map((formation) => {
            const temporalStatus = getFormationTemporalStatus(formation);
            const markerVariant =
              temporalStatus === "future" ? "future" : "passee";

            const statutBadge = getStatutBadge(formation.statut);
            const typeBadge = getTypeBadge(formation.typeSession);

            return (
              <Marker
                key={formation.id}
                position={[formation.lieu!.gps!.lat, formation.lieu!.gps!.lng]}
                icon={markerVariant === "future" ? futurePinIcon : pastPinIcon}
                eventHandlers={{
                  click: () => handleMarkerClick(formation)
                }}
              >
                <Popup
                  className="formation-popup"
                  maxWidth={350}
                  minWidth={280}
                >
                  <div className="p-1">
                    {/* Lieu */}
                    <div className="font-semibold text-gray-900 text-base mb-2">
                      📍 {formation.lieu?.nom || formation.lieu?.adresse}
                    </div>

                    <div
                      className="p-2 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleMarkerClick(formation)}
                    >
                      <div className="font-medium text-gray-800 text-sm leading-tight">
                        {formation.titre}
                      </div>

                      <div className="text-xs text-gray-500 mt-0.5">
                        {formation.codeEtendu}
                        {formation.codeFormation &&
                          ` (${formation.codeFormation})`}
                      </div>

                      <div className="text-xs text-gray-600 mt-1">
                        📅 {formatDate(formation.dateDebut)}
                        {formation.dateDebut !== formation.dateFin && (
                          <> → {formatDate(formation.dateFin)}</>
                        )}
                        <span className="ml-1 text-gray-400">
                          ({formation.nombreJours}j)
                        </span>
                      </div>

                      <div className="flex gap-1.5 mt-1.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded border ${typeBadge.className}`}
                        >
                          {typeBadge.text}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded border ${statutBadge.className}`}
                        >
                          {statutBadge.text}
                        </span>
                      </div>

                      {formation.client && (
                        <div className="text-xs text-purple-600 mt-1">
                          🏢 {formation.client}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Légende */}
      <div className="absolute bottom-4 left-4 z-1000 bg-orsys-dark/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-[#16213e]">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Passées</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Futures</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapView;
