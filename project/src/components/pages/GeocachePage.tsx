import { useEffect, useMemo, useState } from "react";
import type { CoordonneesGPS, GeocacheEntry } from "../../types";
import {
  getAllGeocacheEntries,
  reapplyGeocacheToAllFormations,
  updateGeocacheEntryGps
} from "../../stores/geocacheStore";

import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix pour les icônes Leaflet avec bundler
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

const DEFAULT_CENTER: [number, number] = [46.603354, 1.888334];
const DEFAULT_ZOOM = 6;

function MapClickPicker({
  enabled,
  onPick
}: {
  enabled: boolean;
  onPick: (gps: CoordonneesGPS) => void;
}) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return;
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

function formatGps(gps: CoordonneesGPS | null): string {
  if (!gps) return "—";
  return `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
}

export function GeocachePage() {
  const [entries, setEntries] = useState<GeocacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [candidateGps, setCandidateGps] = useState<CoordonneesGPS | null>(null);
  const [saving, setSaving] = useState(false);

  const [reapplying, setReapplying] = useState(false);

  const editingEntry = useMemo(() => {
    if (!editingAddress) return null;
    return entries.find((e) => e.adresse === editingAddress) ?? null;
  }, [editingAddress, entries]);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await getAllGeocacheEntries();
      // Tri simple : plus récent en premier
      all.sort((a, b) => (a.cachedAt < b.cachedAt ? 1 : -1));
      setEntries(all);
    } catch (e) {
      console.error(e);
      setError("Impossible de charger le cache de géocodage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!editingEntry) {
      setCandidateGps(null);
      return;
    }

    // Afficher un pin existant si déjà présent
    setCandidateGps(editingEntry.gps);
  }, [editingEntry]);

  const handleEdit = (adresse: string) => {
    setEditingAddress(adresse);
  };

  const handleValidate = async () => {
    if (!editingEntry) return;
    if (!candidateGps) return;

    try {
      setSaving(true);
      await updateGeocacheEntryGps(editingEntry.adresse, candidateGps);
      await refresh();
      setEditingAddress(null);
      setCandidateGps(null);
    } catch (e) {
      console.error(e);
      setError("Impossible d'enregistrer les nouvelles coordonnées GPS.");
    } finally {
      setSaving(false);
    }
  };

  const handleReapply = async () => {
    try {
      setReapplying(true);
      setError(null);
      await reapplyGeocacheToAllFormations();
    } catch (e) {
      console.error(e);
      setError(
        "Impossible de réappliquer les données du cache à toutes les formations."
      );
    } finally {
      setReapplying(false);
    }
  };

  const mapCenter: [number, number] = useMemo(() => {
    if (candidateGps) return [candidateGps.lat, candidateGps.lng];
    if (editingEntry?.gps) return [editingEntry.gps.lat, editingEntry.gps.lng];
    return DEFAULT_CENTER;
  }, [candidateGps, editingEntry?.gps]);

  const mapZoom = editingEntry?.gps ? 12 : DEFAULT_ZOOM;

  return (
    <div className="text-left">
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Geocache</h1>
          <p className="text-gray-400 text-sm">
            Cache de géocodage (adresses → coordonnées GPS)
          </p>
        </div>

        <button
          onClick={handleReapply}
          disabled={reapplying}
          className="btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:text-gray-300 text-white rounded-md transition-colors text-sm font-medium"
        >
          {reapplying
            ? "Réapplication…"
            : "Réappliquer le cache à toutes les formations"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-600 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Chargement…</div>
      ) : entries.length === 0 ? (
        <div className="text-gray-400 text-sm">
          Aucune entrée dans le cache.
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            <div className="hidden md:block px-4 py-3 text-xs uppercase tracking-wide text-gray-400 border-b border-gray-700">
              Payload (adresse)
            </div>
            <div className="hidden md:block px-4 py-3 text-xs uppercase tracking-wide text-gray-400 border-b border-gray-700">
              Coordonnées GPS
            </div>
            <div className="hidden md:block px-4 py-3 text-xs uppercase tracking-wide text-gray-400 border-b border-gray-700">
              Action
            </div>

            {entries.map((entry) => {
              const isEditing = entry.adresse === editingAddress;
              return (
                <div key={entry.adresse} className="contents">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <div className="text-sm text-white wrap-break-word">
                      {entry.adresse}
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-700">
                    <div className="text-sm text-gray-200">
                      {formatGps(entry.gps)}
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-700">
                    {!isEditing ? (
                      <button
                        onClick={() => handleEdit(entry.adresse)}
                        className="btn px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm"
                      >
                        Éditer
                      </button>
                    ) : (
                      <span className="text-sm text-amber-300">
                        Édition en cours…
                      </span>
                    )}
                  </div>

                  {isEditing && (
                    <div className="md:col-span-3 px-4 py-4 border-b border-gray-700 bg-gray-900/20">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                        <div className="text-sm text-gray-300">
                          Cliquez sur la carte pour repositionner le pin.
                        </div>
                        <button
                          onClick={handleValidate}
                          disabled={!candidateGps || saving}
                          className="btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:text-gray-300 text-white rounded-md transition-colors text-sm font-medium"
                        >
                          {saving
                            ? "Validation…"
                            : "Valider les nouvelles coordonnées GPS"}
                        </button>
                      </div>

                      <div className="rounded-lg overflow-hidden border border-gray-700 bg-gray-900/20 h-72">
                        <MapContainer
                          center={mapCenter}
                          zoom={mapZoom}
                          style={{ height: "100%", width: "100%" }}
                          scrollWheelZoom
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />

                          <MapClickPicker
                            enabled={true}
                            onPick={setCandidateGps}
                          />

                          {candidateGps && (
                            <Marker
                              position={[candidateGps.lat, candidateGps.lng]}
                            >
                              <Popup>Coordonnées GPS</Popup>
                            </Marker>
                          )}
                        </MapContainer>
                      </div>

                      <div className="text-xs text-gray-400 mt-3">
                        Coordonnées sélectionnées : {formatGps(candidateGps)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
