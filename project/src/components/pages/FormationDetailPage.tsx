import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CoordonneesGPS, EmailRaw, Formation } from "../../types";
import {
  NiveauPersonnalisation,
  StatutFormation,
  TypeSession
} from "../../types";
import { getFormation, updateFormation } from "../../stores/formationsStore";
import { db } from "../../stores/db";

import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix pour les icônes Leaflet avec bundler (page détail)
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

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return isoDate;
  }
}

function formatDateTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return isoDate;
  }
}

export function FormationDetailPage() {
  const { formationId } = useParams<{ formationId: string }>();
  const [formation, setFormation] = useState<Formation | null>(null);
  const [emails, setEmails] = useState<EmailRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gpsCorrectionMode, setGpsCorrectionMode] = useState(false);
  const [candidateGps, setCandidateGps] = useState<CoordonneesGPS | null>(null);
  const [savingGps, setSavingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!formationId) {
        setError("Identifiant de formation manquant.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const f = await getFormation(formationId);
        if (!f) {
          if (!cancelled) {
            setFormation(null);
            setEmails([]);
            setError("Formation introuvable.");
            setLoading(false);
          }
          return;
        }

        const rawEmails = await db.emails.bulkGet(f.emailIds);
        const existingEmails = rawEmails.filter((e): e is EmailRaw =>
          Boolean(e)
        );

        existingEmails.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (!cancelled) {
          setFormation(f);
          setEmails(existingEmails);
          setGpsCorrectionMode(false);
          setCandidateGps(null);
          setGpsError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Erreur inconnue lors du chargement."
          );
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [formationId]);

  const badges = useMemo(() => {
    if (!formation) return null;

    const isAnnulee = formation.statut === StatutFormation.ANNULEE;
    const isIntra = formation.typeSession === TypeSession.INTRA;

    return {
      isAnnulee,
      isIntra,
      typeLabel: isIntra ? "Intra" : "Inter",
      typeClass: isIntra
        ? "bg-purple-500/20 text-purple-300"
        : "bg-green-500/20 text-green-300",
      statutLabel: isAnnulee ? "Annulée" : "Confirmée",
      statutClass: isAnnulee
        ? "bg-red-500/20 text-red-300"
        : "bg-green-500/20 text-green-300"
    };
  }, [formation]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-400">
          <Link to="/formations" className="hover:text-white transition-colors">
            ← Retour aux formations
          </Link>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 animate-pulse h-44" />
        <div className="bg-gray-800 rounded-lg p-6 animate-pulse h-72" />
      </div>
    );
  }

  if (error || !formation) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-400">
          <Link to="/formations" className="hover:text-white transition-colors">
            ← Retour aux formations
          </Link>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          <p className="font-semibold">Impossible d'afficher la formation</p>
          <p className="text-sm">{error ?? "Formation introuvable."}</p>
        </div>
      </div>
    );
  }

  const currentGps = formation.lieu?.gps ?? null;
  const mapCenter: L.LatLngExpression = currentGps
    ? [currentGps.lat, currentGps.lng]
    : [46.603354, 1.888334];
  const mapZoom = currentGps ? 14 : 6;

  const handleValidateGps = async () => {
    if (!candidateGps) return;

    try {
      setSavingGps(true);
      setGpsError(null);

      const updated = await updateFormation(formation.id, {
        lieu: {
          ...(formation.lieu ?? { nom: "", adresse: "" }),
          gps: candidateGps
        }
      });

      if (!updated) {
        setGpsError("Impossible de mettre à jour la formation (introuvable). ");
        return;
      }

      setFormation(updated);
      setGpsCorrectionMode(false);
      setCandidateGps(null);
    } catch (err) {
      setGpsError(
        err instanceof Error
          ? err.message
          : "Erreur inconnue lors de la mise à jour GPS."
      );
    } finally {
      setSavingGps(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-400">
        <Link to="/formations" className="hover:text-white transition-colors">
          ← Retour aux formations
        </Link>
      </div>

      {/* En-tête */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {badges?.isAnnulee && (
                <span className="text-red-400" title="Formation annulée">
                  ❌
                </span>
              )}
              <span
                className={`font-mono text-sm font-semibold ${
                  badges?.isAnnulee
                    ? "text-gray-500 line-through"
                    : "text-blue-400"
                }`}
              >
                {formation.codeEtendu}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${badges?.typeClass}`}
              >
                {badges?.typeLabel}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${badges?.statutClass}`}
              >
                {badges?.statutLabel}
              </span>
            </div>

            <h1
              className={`text-xl md:text-2xl font-bold ${
                badges?.isAnnulee ? "text-gray-400 line-through" : "text-white"
              }`}
            >
              {formation.titre}
            </h1>

            <div className="text-sm text-gray-400 mt-2">
              📅 {formatDate(formation.dateDebut)} →{" "}
              {formatDate(formation.dateFin)}
              <span className="text-gray-500">
                {" "}
                ({formation.nombreJours} jour
                {formation.nombreJours > 1 ? "s" : ""})
              </span>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            <div>
              <span className="text-gray-500">Emails sources :</span>{" "}
              <span className="text-white font-semibold">
                {formation.emailIds.length}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Mise à jour :</span>{" "}
              {formatDateTime(formation.updatedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Détails */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Détails</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Lieu</div>
            <div className="text-white font-medium">
              {formation.lieu?.nom || "Non précisé"}
            </div>
            {formation.lieu?.adresse && (
              <div className="text-sm text-gray-400 mt-1">
                {formation.lieu.adresse}
              </div>
            )}
            {formation.lieu?.gps && (
              <div className="text-xs text-gray-500 mt-2">
                GPS : {formation.lieu.gps.lat.toFixed(5)},{" "}
                {formation.lieu.gps.lng.toFixed(5)}
              </div>
            )}
          </div>

          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Type / Niveau</div>
            <div className="text-white">
              {formation.typeSession === TypeSession.INTRA
                ? "Intra-entreprise"
                : "Inter-entreprise"}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Niveau :{" "}
              {formation.niveauPersonnalisation ===
              NiveauPersonnalisation.SPECIFIQUE
                ? "Spécifique"
                : formation.niveauPersonnalisation ===
                    NiveauPersonnalisation.ULTRA_SPECIFIQUE
                  ? "Ultra-spécifique"
                  : "Standard"}
            </div>
            {formation.client && (
              <div className="text-sm text-purple-300 mt-2">
                🏢 {formation.client}
              </div>
            )}
          </div>

          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Participants</div>
            <div className="text-white font-semibold">
              {formation.nombreParticipants ?? 0}
            </div>
            {formation.participants?.length > 0 && (
              <div className="text-sm text-gray-400 mt-2 space-y-1">
                {formation.participants.slice(0, 6).map((p, idx) => (
                  <div key={`${p.email}-${idx}`} className="truncate">
                    • {p.nom}
                    {p.email ? (
                      <span className="text-gray-500"> — {p.email}</span>
                    ) : null}
                  </div>
                ))}
                {formation.participants.length > 6 && (
                  <div className="text-xs text-gray-500">
                    + {formation.participants.length - 6} autre(s)
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Accès</div>
            <div className="text-sm text-gray-300">
              <div>
                <span className="text-gray-500">DocAdmin (formateur) :</span>{" "}
                {formation.motDePasseDocadmin ? (
                  <code className="font-mono text-blue-300">
                    {formation.motDePasseDocadmin}
                  </code>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </div>
              <div className="mt-1">
                <span className="text-gray-500">DocAdmin (participants) :</span>{" "}
                {formation.motDePasseParticipants ? (
                  <code className="font-mono text-blue-300">
                    {formation.motDePasseParticipants}
                  </code>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {formation.facturation && (
          <div className="mt-4 bg-gray-700/30 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Facturation</div>
            <div className="text-sm text-gray-300 space-y-1">
              <div>
                <span className="text-gray-500">Entité :</span>{" "}
                {formation.facturation.entite}
              </div>
              {formation.facturation.referenceIntra && (
                <div>
                  <span className="text-gray-500">Référence intra :</span>{" "}
                  {formation.facturation.referenceIntra}
                </div>
              )}
              {formation.facturation.referenceCommande && (
                <div>
                  <span className="text-gray-500">Référence commande :</span>{" "}
                  {formation.facturation.referenceCommande}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Correction GPS */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">Carte</h2>
          <div className="flex items-center gap-2">
            {gpsCorrectionMode ? (
              <>
                <button
                  type="button"
                  className="btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-md transition-colors text-sm font-medium"
                  disabled={!candidateGps || savingGps}
                  onClick={handleValidateGps}
                  title={
                    !candidateGps
                      ? "Cliquez sur la carte pour choisir la nouvelle position"
                      : "Enregistrer la nouvelle position"
                  }
                >
                  {savingGps
                    ? "Validation…"
                    : candidateGps
                      ? "✓ Valider la position"
                      : "Cliquez sur la carte…"}
                </button>
                <button
                  type="button"
                  className="btn px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm"
                  onClick={() => {
                    setGpsCorrectionMode(false);
                    setCandidateGps(null);
                    setGpsError(null);
                  }}
                  title="Annuler la correction"
                >
                  Annuler
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors text-sm font-medium"
                onClick={() => {
                  setGpsCorrectionMode(true);
                  setCandidateGps(null);
                  setGpsError(null);
                }}
                title="Choisir une nouvelle position sur la carte"
              >
                ✏️ Corriger la position
              </button>
            )}
          </div>
        </div>

        {gpsCorrectionMode && (
          <div className="text-sm text-amber-300/80 mb-3 flex items-center gap-2">
            <span>📍</span>
            <span>
              Cliquez sur la carte pour choisir la nouvelle position, puis
              validez.
            </span>
          </div>
        )}

        {gpsError && (
          <div className="mb-3 bg-red-900/20 border border-red-500/40 rounded-lg p-3 text-sm text-red-300">
            {gpsError}
          </div>
        )}

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
              enabled={gpsCorrectionMode}
              onPick={setCandidateGps}
            />

            {currentGps && (
              <Marker position={[currentGps.lat, currentGps.lng]}>
                <Popup>Position actuelle</Popup>
              </Marker>
            )}

            {candidateGps && (
              <Marker position={[candidateGps.lat, candidateGps.lng]}>
                <Popup>Nouvelle position</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {candidateGps && (
          <div className="text-xs text-gray-400 mt-3">
            Nouvelle position sélectionnée : {candidateGps.lat.toFixed(5)},{" "}
            {candidateGps.lng.toFixed(5)}
          </div>
        )}
      </div>

      {/* Emails bruts */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">
            Emails bruts ({emails.length})
          </h2>
          <div className="text-xs text-gray-500">
            Debug — utile en cas d'extraction incorrecte
          </div>
        </div>

        {emails.length === 0 ? (
          <div className="text-sm text-gray-400">
            Aucun email brut retrouvé pour cette formation.
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((email) => (
              <details
                key={email.id}
                className="bg-gray-900/30 rounded-lg border border-gray-700"
              >
                <summary className="cursor-pointer select-none px-4 py-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {email.subject || "(Sans sujet)"}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {email.from} • {formatDateTime(email.date)} • id:{" "}
                        {email.id}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Cliquer pour afficher
                    </div>
                  </div>
                </summary>
                <div className="px-4 pb-4">
                  <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/30 p-3 rounded border border-gray-700 overflow-x-auto">
                    {email.body}
                  </pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
