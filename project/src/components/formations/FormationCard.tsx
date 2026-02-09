/**
 * Composant FormationCard - Affiche une formation sous forme de carte
 */

import type { Formation } from "../../types";
import { StatutFormation, TypeSession } from "../../types";

interface FormationCardProps {
  /** Formation à afficher */
  formation: Formation;
  /** Callback au clic sur la carte */
  onClick?: (formation: Formation) => void;
}

/**
 * Formate une date ISO en format français court
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
  } catch {
    return isoDate;
  }
}

/**
 * Formate la plage de dates
 */
function formatDateRange(dateDebut: string, dateFin: string): string {
  const debut = formatDate(dateDebut);
  const fin = formatDate(dateFin);
  if (debut === fin) {
    return debut;
  }
  return `${debut} → ${fin}`;
}

/**
 * Affiche une carte de formation cliquable
 */
export function FormationCard({ formation, onClick }: FormationCardProps) {
  const isAnnulee = formation.statut === StatutFormation.ANNULEE;
  const isIntra = formation.typeSession === TypeSession.INTRA;

  return (
    <div
      className={`bg-gray-800 rounded-lg p-4 shadow-md border transition-colors cursor-pointer hover:bg-gray-750 ${
        isAnnulee
          ? "border-red-500/30 bg-red-950/10"
          : "border-gray-700 hover:border-gray-600"
      }`}
      onClick={() => onClick?.(formation)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick?.(formation);
        }
      }}
    >
      {/* En-tête: Code et Type */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isAnnulee && (
            <span className="text-red-400" title="Formation annulée">
              ❌
            </span>
          )}
          <span
            className={`font-mono text-sm font-semibold ${
              isAnnulee ? "text-gray-500 line-through" : "text-blue-400"
            }`}
          >
            {formation.codeEtendu}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            isIntra
              ? "bg-purple-500/20 text-purple-300"
              : "bg-green-500/20 text-green-300"
          }`}
        >
          {isIntra ? "Intra" : "Inter"}
        </span>
      </div>

      {/* Titre */}
      <h3
        className={`font-medium mb-3 line-clamp-2 ${
          isAnnulee ? "text-gray-500 line-through" : "text-white"
        }`}
      >
        {formation.titre}
      </h3>

      {/* Infos: Dates, Lieu, Participants */}
      <div className="space-y-1.5 text-sm text-gray-400">
        {/* Dates */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">📅</span>
          <span>
            {formatDateRange(formation.dateDebut, formation.dateFin)}
            {formation.nombreJours > 0 && (
              <span className="text-gray-500 ml-1">
                ({formation.nombreJours} j)
              </span>
            )}
          </span>
        </div>

        {/* Lieu */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500">📍</span>
          <span className="truncate" title={formation.lieu?.nom}>
            {formation.lieu?.nom || "Non précisé"}
          </span>
        </div>

        {/* Participants */}
        {(formation.nombreParticipants ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">👥</span>
            <span>{formation.nombreParticipants} participant(s)</span>
          </div>
        )}

        {/* Client (intra) */}
        {isIntra && formation.client && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">🏢</span>
            <span className="truncate" title={formation.client}>
              {formation.client}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
