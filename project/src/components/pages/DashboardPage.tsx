import { ExtractionPanel } from "../extraction";
import { Dashboard } from "../dashboard";

export function DashboardPage() {
  return (
    <div className="text-left">
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-6">Tableau de bord des formations ORSYS</p>

      {/* Panneau d'extraction des emails */}
      <div className="mb-6">
        <ExtractionPanel />
      </div>

      {/* Dashboard avec statistiques */}
      <Dashboard />
    </div>
  );
}
