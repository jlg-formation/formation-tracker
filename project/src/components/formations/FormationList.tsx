/**
 * Composant FormationList - Liste des formations avec filtres et pagination
 */

import { useState, useMemo, useCallback } from "react";
import type { Formation, FormationFilters } from "../../types";
import {
  StatutFormation,
  TypeSession,
  NiveauPersonnalisation
} from "../../types";
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
 * Modal de détail d'une formation
 */
interface FormationModalProps {
  formation: Formation;
  onClose: () => void;
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

function FormationModal({ formation, onClose }: FormationModalProps) {
  const isAnnulee = formation.statut === StatutFormation.ANNULEE;
  const isIntra = formation.typeSession === TypeSession.INTRA;

  const handleCopyPassword = useCallback(() => {
    if (formation.motDePasseDocadmin) {
      navigator.clipboard.writeText(formation.motDePasseDocadmin);
    }
  }, [formation.motDePasseDocadmin]);

  // Fermer le modal avec Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isAnnulee && <span className="text-red-400">❌</span>}
              <span
                className={`font-mono text-sm ${
                  isAnnulee ? "text-gray-500" : "text-blue-400"
                }`}
              >
                {formation.codeEtendu}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isIntra
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-green-500/20 text-green-300"
                }`}
              >
                {isIntra ? "Intra" : "Inter"}
              </span>
              {isAnnulee && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                  Annulée
                </span>
              )}
            </div>
            <h2
              id="modal-title"
              className={`text-lg font-semibold ${
                isAnnulee ? "text-gray-400 line-through" : "text-white"
              }`}
            >
              {formation.titre}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn text-gray-400 hover:text-white p-1 text-xl"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Contenu */}
        <div className="p-4 space-y-4">
          {/* Informations principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dates */}
            <div className="flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <div className="text-sm text-gray-400">Dates</div>
                <div className="text-white">
                  {formatDate(formation.dateDebut)} →{" "}
                  {formatDate(formation.dateFin)}
                </div>
                <div className="text-sm text-gray-400">
                  ({formation.nombreJours} jour
                  {formation.nombreJours > 1 ? "s" : ""})
                </div>
              </div>
            </div>

            {/* Lieu */}
            <div className="flex items-start gap-3">
              <span className="text-2xl">📍</span>
              <div>
                <div className="text-sm text-gray-400">Lieu</div>
                <div className="text-white">
                  {formation.lieu?.nom || "Non précisé"}
                </div>
                {formation.lieu?.adresse && (
                  <div className="text-sm text-gray-400">
                    {formation.lieu.adresse}
                  </div>
                )}
              </div>
            </div>

            {/* Type */}
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏢</span>
              <div>
                <div className="text-sm text-gray-400">Type</div>
                <div className="text-white">
                  {isIntra ? "Intra-entreprise" : "Inter-entreprise"}
                </div>
              </div>
            </div>

            {/* Niveau */}
            <div className="flex items-start gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-sm text-gray-400">Niveau</div>
                <div className="text-white">
                  {formation.niveauPersonnalisation ===
                  NiveauPersonnalisation.SPECIFIQUE
                    ? "Spécifique"
                    : formation.niveauPersonnalisation ===
                        NiveauPersonnalisation.ULTRA_SPECIFIQUE
                      ? "Ultra-spécifique"
                      : "Standard"}
                </div>
              </div>
            </div>

            {/* Client (intra) */}
            {isIntra && formation.client && (
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏭</span>
                <div>
                  <div className="text-sm text-gray-400">Client</div>
                  <div className="text-white">{formation.client}</div>
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="flex items-start gap-3">
              <span className="text-2xl">👥</span>
              <div>
                <div className="text-sm text-gray-400">Participants</div>
                <div className="text-white">
                  {formation.nombreParticipants ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Liste des participants */}
          {formation.participants && formation.participants.length > 0 && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3">Participants</h3>
              <ul className="space-y-1.5">
                {formation.participants.map((p, idx) => (
                  <li key={idx} className="text-sm text-gray-300">
                    • {p.nom}
                    {p.email && (
                      <span className="text-gray-500"> - {p.email}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mot de passe DocAdmin */}
          {formation.motDePasseDocadmin && (
            <div className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-400">
                  🔑 Mot de passe DocAdmin :{" "}
                </span>
                <code className="font-mono text-blue-400">
                  {formation.motDePasseDocadmin}
                </code>
              </div>
              <button
                onClick={handleCopyPassword}
                className="btn text-gray-400 hover:text-white px-2 py-1"
                title="Copier"
              >
                📋
              </button>
            </div>
          )}

          {/* Facturation */}
          {formation.facturation && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">Facturation</h3>
              <div className="text-sm text-gray-300">
                <div>Entité : {formation.facturation.entite}</div>
                {formation.facturation.referenceIntra && (
                  <div>
                    Référence intra : {formation.facturation.referenceIntra}
                  </div>
                )}
                {formation.facturation.referenceCommande && (
                  <div>
                    Référence commande :{" "}
                    {formation.facturation.referenceCommande}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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
  const [selectedFormation, setSelectedFormation] = useState<Formation | null>(
    null
  );

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
                onClick={setSelectedFormation}
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

      {/* Modal détail */}
      {selectedFormation && (
        <FormationModal
          formation={selectedFormation}
          onClose={() => setSelectedFormation(null)}
        />
      )}
    </div>
  );
}
