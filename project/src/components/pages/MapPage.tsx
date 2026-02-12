import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useFormations } from "../../hooks/useFormations";
import { MapView } from "../map";
import {
  geocodeAddress,
  preloadKnownLocations,
  clearFailedGeocacheEntries
} from "../../services/geocoding";
import { updateFormation } from "../../stores/formationsStore";
import { StatutFormation } from "../../types";
import {
  type PeriodeCarte,
  filterFormationsByPeriode
} from "../../utils/temporal";

/** Status du géocodage */
type GeocodingStatus = "idle" | "running" | "completed" | "cancelled" | "error";

export function MapPage() {
  const { formations, loading, error, refresh } = useFormations();
  const navigate = useNavigate();

  const [periode, setPeriode] = useState<PeriodeCarte>("passees");

  const [mapDisplayMode, setMapDisplayMode] = useState<
    "cluster" | "unclustered" | "jitter"
  >("cluster");

  // État du géocodage
  const [geocodingStatus, setGeocodingStatus] =
    useState<GeocodingStatus>("idle");
  const [geocodingProgress, setGeocodingProgress] = useState({
    current: 0,
    total: 0
  });
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [geocodingStats, setGeocodingStats] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  // Ref pour l'interruption du géocodage
  const geocodingCancelledRef = useRef(false);

  // Calcul des formations sans GPS
  const formationsWithoutGPS = useMemo(() => {
    return formations.filter(
      (f) =>
        f.statut !== StatutFormation.ANNULEE &&
        (!f.lieu?.gps?.lat || !f.lieu?.gps?.lng)
    );
  }, [formations]);

  const formationsWithGPS = useMemo(() => {
    return formations.filter((f) => f.lieu?.gps?.lat && f.lieu?.gps?.lng);
  }, [formations]);

  const formationsForMap = useMemo(() => {
    return filterFormationsByPeriode(formations, periode);
  }, [formations, periode]);

  /**
   * Géocode toutes les formations sans coordonnées GPS
   */
  const handleGeocodeFormations = async () => {
    if (formationsWithoutGPS.length === 0) return;

    geocodingCancelledRef.current = false;
    setGeocodingStatus("running");
    setGeocodingError(null);
    setGeocodingStats(null);
    setGeocodingProgress({ current: 0, total: formationsWithoutGPS.length });

    // Supprimer les entrées en échec du cache pour permettre un nouveau géocodage
    await clearFailedGeocacheEntries();

    // Précharger les adresses ORSYS connues d'abord
    await preloadKnownLocations();

    let success = 0;
    let failed = 0;

    for (let i = 0; i < formationsWithoutGPS.length; i++) {
      // Vérifier si l'utilisateur a demandé l'interruption
      if (geocodingCancelledRef.current) {
        console.log(
          `Géocodage interrompu à ${i}/${formationsWithoutGPS.length}`
        );
        break;
      }

      const formation = formationsWithoutGPS[i];
      setGeocodingProgress({
        current: i + 1,
        total: formationsWithoutGPS.length
      });

      try {
        if (formation.statut === StatutFormation.ANNULEE) {
          failed++;
          continue;
        }

        // Construire l'adresse à géocoder
        const address = formation.lieu?.adresse || formation.lieu?.nom || "";
        if (!address.trim()) {
          failed++;
          continue;
        }

        // Appeler le service de géocodage
        const gps = await geocodeAddress(address);

        if (gps) {
          // Mettre à jour la formation avec les coordonnées GPS
          await updateFormation(formation.id, {
            lieu: {
              ...formation.lieu,
              gps
            }
          });
          success++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`Erreur géocodage formation ${formation.id}:`, err);
        failed++;
      }
    }

    setGeocodingStats({ success, failed });
    setGeocodingStatus(
      geocodingCancelledRef.current ? "cancelled" : "completed"
    );

    // Rafraîchir la liste des formations
    await refresh();
  };

  /**
   * Interrompt le géocodage en cours
   */
  const handleCancelGeocoding = () => {
    geocodingCancelledRef.current = true;
  };

  return (
    <div className="text-left">
      {/* En-tête */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Carte</h1>
          <p className="text-gray-400 text-sm">
            Visualisation géographique des formations
          </p>
        </div>

        {/* Bouton de géocodage */}
        {!loading && formations.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Stats rapides */}
            <div className="text-sm text-gray-400">
              <span className="text-green-400 font-medium">
                {formationsWithGPS.length}
              </span>{" "}
              géolocalisées
              {formationsWithoutGPS.length > 0 && (
                <span className="ml-2">
                  •{" "}
                  <span className="text-orange-400 font-medium">
                    {formationsWithoutGPS.length}
                  </span>{" "}
                  sans GPS
                </span>
              )}
            </div>

            {/* Bouton géocoder */}
            {formationsWithoutGPS.length > 0 &&
              geocodingStatus !== "running" && (
                <button
                  onClick={handleGeocodeFormations}
                  className="btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <span>🌍</span>
                  Géocoder {formationsWithoutGPS.length} formation
                  {formationsWithoutGPS.length > 1 ? "s" : ""}
                </button>
              )}

            {/* Barre de progression */}
            {geocodingStatus === "running" && (
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{
                      width: `${(geocodingProgress.current / geocodingProgress.total) * 100}%`
                    }}
                  />
                </div>
                <span className="text-sm text-gray-400">
                  {geocodingProgress.current}/{geocodingProgress.total}
                </span>
                <span className="animate-spin text-indigo-400">⏳</span>
                <button
                  onClick={handleCancelGeocoding}
                  className="btn px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm font-medium"
                  title="Arrêter le géocodage"
                >
                  Arrêter
                </button>
              </div>
            )}

            {/* Résultat */}
            {(geocodingStatus === "completed" ||
              geocodingStatus === "cancelled") &&
              geocodingStats && (
                <div className="text-sm">
                  {geocodingStatus === "cancelled" && (
                    <span className="text-yellow-400 mr-2">⏹️ Interrompu</span>
                  )}
                  <span className="text-green-400">
                    ✅ {geocodingStats.success} géocodées
                  </span>
                  {geocodingStats.failed > 0 && (
                    <span className="ml-2 text-orange-400">
                      ⚠️ {geocodingStats.failed} échecs
                    </span>
                  )}
                </div>
              )}
          </div>
        )}
      </div>

      {/* Filtres (spec Carte) */}
      {!loading && !error && formations.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm text-gray-300 flex items-center gap-2">
            <span className="text-gray-400">Période</span>
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value as PeriodeCarte)}
              className="bg-[#16213e] border border-[#16213e] text-gray-200 rounded-md px-3 py-2 text-sm"
            >
              <option value="passees">Passées</option>
              <option value="futures">Futures</option>
              <option value="les-deux">Les deux</option>
            </select>
          </label>

          <label className="text-sm text-gray-300 flex items-center gap-2">
            <span className="text-gray-400">Mode</span>
            <select
              value={mapDisplayMode}
              onChange={(e) =>
                setMapDisplayMode(
                  e.target.value as "cluster" | "unclustered" | "jitter"
                )
              }
              className="bg-[#16213e] border border-[#16213e] text-gray-200 rounded-md px-3 py-2 text-sm"
            >
              <option value="cluster">Clusterisé</option>
              <option value="unclustered">Non clusterisé</option>
              <option value="jitter">Non clusterisé avec jittering</option>
            </select>
          </label>
        </div>
      )}

      {/* Erreur de géocodage */}
      {geocodingError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-600 rounded-lg text-red-400 text-sm">
          {geocodingError}
        </div>
      )}

      {/* État de chargement */}
      {loading && (
        <div className="h-[60vh] flex items-center justify-center bg-[#16213e] rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p className="text-gray-400">Chargement des formations...</p>
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && !loading && (
        <div className="h-[60vh] flex items-center justify-center bg-[#16213e] rounded-lg">
          <div className="text-center text-red-400">
            <svg
              className="w-12 h-12 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="font-medium mb-1">Erreur de chargement</p>
            <p className="text-sm text-red-300">{error.message}</p>
          </div>
        </div>
      )}

      {/* Carte */}
      {!loading && !error && (
        <div className="h-[60vh] md:h-[65vh] lg:h-[70vh]">
          <MapView
            formations={formationsForMap}
            displayMode={mapDisplayMode}
            onFormationSelect={(formation) =>
              navigate(`/formations/${formation.id}`)
            }
            height="100%"
            className="rounded-lg overflow-hidden border border-[#16213e]"
          />
        </div>
      )}
    </div>
  );
}
