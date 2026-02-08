import { NavLink } from "react-router-dom";

export function Header() {
  return (
    <header className="flex justify-between items-center px-8 py-4 bg-[#1a1a2e] border-b border-[#16213e]">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📊</span>
        <span className="text-xl font-semibold text-white">
          ORSYS Training Tracker
        </span>
      </div>
      <nav className="flex gap-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md transition-all duration-200 no-underline ${
              isActive
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`
          }
          end
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/carte"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md transition-all duration-200 no-underline ${
              isActive
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`
          }
        >
          Carte
        </NavLink>
        <NavLink
          to="/formations"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md transition-all duration-200 no-underline ${
              isActive
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`
          }
        >
          Formations
        </NavLink>
        <NavLink
          to="/parametres"
          className={({ isActive }) =>
            `px-4 py-2 rounded-md transition-all duration-200 no-underline ${
              isActive
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`
          }
        >
          ⚙️ Paramètres
        </NavLink>
      </nav>
    </header>
  );
}
