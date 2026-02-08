import { ExtractionPanel } from "../extraction";

export function DashboardPage() {
  return (
    <div className="text-left">
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-6">Tableau de bord des formations ORSYS</p>

      {/* Panneau d'extraction des emails */}
      <div className="mb-6">
        <ExtractionPanel />
      </div>

      {/* Espace réservé pour les statistiques */}
      <div className="p-8 bg-indigo-600/10 border border-dashed border-indigo-600 rounded-lg text-gray-400 text-center">
        Les statistiques et graphiques seront ajoutés dans les prochaines
        étapes.
      </div>
    </div>
  );
}
