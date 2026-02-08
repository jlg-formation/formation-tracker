import { NavLink } from "react-router-dom";

export function Header() {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">📊</span>
        <span className="header-title">ORSYS Training Tracker</span>
      </div>
      <nav className="header-nav">
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
          end
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/carte"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Carte
        </NavLink>
        <NavLink
          to="/formations"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Formations
        </NavLink>
        <NavLink
          to="/parametres"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          ⚙️ Paramètres
        </NavLink>
      </nav>
    </header>
  );
}
