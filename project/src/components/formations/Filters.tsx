/**
 * Composant Filters - Filtres de recherche pour les formations
 */

import { useState, useCallback } from "react";
import type { FormationFilters } from "../../types";
import { StatutFormation, TypeSession } from "../../types";

interface FiltersProps {
  /** Filtres actuels */
  filters: FormationFilters;
  /** Callback quand les filtres changent */
  onFiltersChange: (filters: FormationFilters) => void;
  /** Liste des années disponibles */
  availableYears?: number[];
}

/**
 * Composant de filtrage des formations
 */
export function Filters({
  filters,
  onFiltersChange,
  availableYears = []
}: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Générer la liste des années (2014 à aujourd'hui)
  const currentYear = new Date().getFullYear();
  const years =
    availableYears.length > 0
      ? availableYears.sort((a, b) => b - a)
      : Array.from(
          { length: currentYear - 2014 + 1 },
          (_, i) => currentYear - i
        );

  const handleSearchChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        search: value || undefined
      });
    },
    [filters, onFiltersChange]
  );

  const handleYearChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        annee: value ? parseInt(value, 10) : undefined
      });
    },
    [filters, onFiltersChange]
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        typeSession: (value as TypeSession) || undefined
      });
    },
    [filters, onFiltersChange]
  );

  const handleStatutChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        statut: (value as StatutFormation) || undefined
      });
    },
    [filters, onFiltersChange]
  );

  const handleReset = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.search ||
    filters.annee ||
    filters.typeSession ||
    filters.statut ||
    filters.codeFormation ||
    filters.lieu;

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-md border border-gray-700">
      {/* Barre de recherche principale */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Champ de recherche */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            🔍
          </span>
          <input
            type="text"
            placeholder="Rechercher par titre, code, lieu..."
            value={filters.search || ""}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Bouton pour développer les filtres sur mobile */}
        <button
          className="btn md:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-600"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Filtres</span>
          <span
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            ▼
          </span>
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-xs rounded-full px-1.5">
              !
            </span>
          )}
        </button>

        {/* Filtres desktop (toujours visibles) */}
        <div className="hidden md:flex gap-2">
          {/* Année */}
          <select
            value={filters.annee || ""}
            onChange={(e) => handleYearChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Année</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {/* Type */}
          <select
            value={filters.typeSession || ""}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Type</option>
            <option value={TypeSession.INTER}>Inter</option>
            <option value={TypeSession.INTRA}>Intra</option>
          </select>

          {/* Statut */}
          <select
            value={filters.statut || ""}
            onChange={(e) => handleStatutChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Statut</option>
            <option value={StatutFormation.CONFIRMEE}>Confirmée</option>
            <option value={StatutFormation.ANNULEE}>Annulée</option>
          </select>

          {/* Bouton réinitialiser */}
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="btn px-3 py-2.5 text-gray-400 hover:text-white transition-colors"
              title="Réinitialiser les filtres"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filtres mobile (expanded) */}
      {isExpanded && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-700 space-y-3">
          {/* Année */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Année</label>
            <select
              value={filters.annee || ""}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Toutes les années</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type</label>
            <select
              value={filters.typeSession || ""}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Tous les types</option>
              <option value={TypeSession.INTER}>Inter-entreprise</option>
              <option value={TypeSession.INTRA}>Intra-entreprise</option>
            </select>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Statut</label>
            <select
              value={filters.statut || ""}
              onChange={(e) => handleStatutChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value={StatutFormation.CONFIRMEE}>Confirmée</option>
              <option value={StatutFormation.ANNULEE}>Annulée</option>
            </select>
          </div>

          {/* Bouton réinitialiser */}
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="btn w-full py-2.5 text-gray-400 hover:text-white bg-gray-700 rounded-lg transition-colors"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}
