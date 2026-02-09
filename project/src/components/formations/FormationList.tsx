/**
 * Composant FormationList - Liste des formations avec filtres et pagination
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { FormationFilters } from "../../types";
import { useFormations } from "../../hooks/useFormations";
import { FormationCard } from "./FormationCard";
import { Filters } from "./Filters";

const ITEMS_PER_PAGE = 20;

/**
 * Composant de pagination
 */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange
}: PaginationProps) {
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  // Générer les numéros de pages à afficher
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      // Afficher toutes les pages si peu nombreuses
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Toujours afficher la première page
      pages.push(1);

      // Calculer la plage centrale
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

      // Ajuster si près des bords
      if (currentPage <= 3) {
        endPage = Math.min(maxVisiblePages, totalPages - 1);
      } else if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - maxVisiblePages + 1);
      }

      // Ajouter ellipse avant si nécessaire
      if (startPage > 2) {
        pages.push("...");
      }

      // Ajouter les pages centrales
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Ajouter ellipse après si nécessaire
      if (endPage < totalPages - 1) {
        pages.push("...");
      }

      // Toujours afficher la dernière page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) {
    return (
      <div className="text-sm text-gray-400">
        {totalItems > 0
          ? `${totalItems} formation${totalItems > 1 ? "s" : ""}`
          : "Aucune formation"}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="text-sm text-gray-400">
        Affichage {startItem}-{endItem} sur {totalItems}
      </div>

      <div className="flex items-center gap-1">
        {/* Bouton précédent */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn px-3 py-1.5 rounded bg-gray-700 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
        >
          ◀
        </button>

        {/* Numéros de pages */}
        {getPageNumbers().map((page, index) =>
          typeof page === "string" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
              {page}
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`btn px-3 py-1.5 rounded transition-colors ${
                currentPage === page
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {page}
            </button>
          )
        )}

        {/* Bouton suivant */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn px-3 py-1.5 rounded bg-gray-700 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
        >
          ▶
        </button>
      </div>
    </div>
  );
}

/**
 * Composant principal de la liste des formations
 */
export function FormationList() {
  const [filters, setFilters] = useState<FormationFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const { formations, loading, error } = useFormations();

  // Filtrer les formations côté client
  const filteredFormations = useMemo(() => {
    return formations.filter((f) => {
      // Recherche textuelle
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchTitle = f.titre?.toLowerCase().includes(search);
        const matchCode = f.codeEtendu?.toLowerCase().includes(search);
        const matchLieu = f.lieu?.nom?.toLowerCase().includes(search);
        if (!matchTitle && !matchCode && !matchLieu) {
          return false;
        }
      }

      // Filtre par année
      if (filters.annee) {
        const year = new Date(f.dateDebut).getFullYear();
        if (year !== filters.annee) {
          return false;
        }
      }

      // Filtre par type
      if (filters.typeSession && f.typeSession !== filters.typeSession) {
        return false;
      }

      // Filtre par statut
      if (filters.statut && f.statut !== filters.statut) {
        return false;
      }

      return true;
    });
  }, [formations, filters]);

  // Trier par date décroissante
  const sortedFormations = useMemo(() => {
    return [...filteredFormations].sort(
      (a, b) =>
        new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime()
    );
  }, [filteredFormations]);

  // Pagination
  const totalPages = Math.ceil(sortedFormations.length / ITEMS_PER_PAGE);
  const paginatedFormations = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedFormations.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedFormations, currentPage]);

  // Années disponibles
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    formations.forEach((f) => {
      if (f.dateDebut) {
        years.add(new Date(f.dateDebut).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [formations]);

  // Reset page quand les filtres changent
  const handleFiltersChange = useCallback((newFilters: FormationFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-lg p-4 h-20 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-800 rounded-lg p-4 h-40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
        <p className="font-semibold">Erreur de chargement</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <Filters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        availableYears={availableYears}
      />

      {/* Nombre de résultats */}
      <div className="text-sm text-gray-400">
        {sortedFormations.length} formation
        {sortedFormations.length !== 1 ? "s" : ""} trouvée
        {sortedFormations.length !== 1 ? "s" : ""}
        {filters.search ||
        filters.annee ||
        filters.typeSession ||
        filters.statut
          ? " (filtrées)"
          : ""}
      </div>

      {/* Liste */}
      {sortedFormations.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          {formations.length === 0
            ? "Aucune formation en base de données. Lancez une extraction depuis les paramètres."
            : "Aucune formation ne correspond aux filtres sélectionnés."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedFormations.map((formation) => (
              <FormationCard
                key={formation.id}
                formation={formation}
                onClick={() => navigate(`/formations/${formation.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedFormations.length}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
