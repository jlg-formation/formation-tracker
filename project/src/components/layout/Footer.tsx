export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="flex flex-wrap justify-center items-center gap-2 px-4 md:px-8 py-3 md:py-4 bg-orsys-dark border-t border-[#16213e] text-gray-400 text-xs md:text-sm">
      <span>© {currentYear} ORSYS Training Tracker</span>
      <span className="hidden sm:inline text-gray-600">|</span>
      <span>v1.0.0</span>
    </footer>
  );
}
