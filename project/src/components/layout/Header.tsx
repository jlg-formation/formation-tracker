import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const navLinks = [
  { to: "/carte", label: "Carte" },
  { to: "/formations", label: "Formations" },
  { to: "/mails", label: "Mails" },
  { to: "/geocache", label: "Geocache" },
  { to: "/parametres", label: "⚙️ Paramètres" }
];

function NavItem({
  to,
  label,
  end,
  onClick
}: {
  to: string;
  label: string;
  end?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `px-4 py-2 rounded-md transition-all duration-200 no-underline ${
          isActive
            ? "bg-indigo-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-white/10"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-orsys-dark border-b border-[#16213e]">
      <div className="flex justify-between items-center px-4 md:px-8 py-4">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <span className="text-2xl">📊</span>
          <span className="text-lg md:text-xl font-semibold text-white">
            ORSYS Training Tracker
          </span>
        </Link>

        {/* Navigation desktop */}
        <nav className="hidden md:flex gap-2">
          {navLinks.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}
        </nav>

        {/* Bouton hamburger mobile */}
        <button
          className="btn md:hidden p-2 text-gray-400 hover:text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
          aria-expanded={isMenuOpen}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation mobile */}
      {isMenuOpen && (
        <nav className="md:hidden flex flex-col gap-1 px-4 pb-4">
          {navLinks.map((link) => (
            <NavItem
              key={link.to}
              {...link}
              onClick={() => setIsMenuOpen(false)}
            />
          ))}
        </nav>
      )}
    </header>
  );
}
