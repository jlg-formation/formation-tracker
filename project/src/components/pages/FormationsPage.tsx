import { FormationList } from "../formations";

export function FormationsPage() {
  return (
    <div className="text-left">
      <h1 className="text-2xl font-bold text-white mb-2">Formations</h1>
      <p className="text-gray-400 mb-6">Liste complète des formations</p>
      <FormationList />
    </div>
  );
}
