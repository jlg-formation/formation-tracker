export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="flex justify-center items-center gap-2 px-8 py-4 bg-[#1a1a2e] border-t border-[#16213e] text-gray-400 text-sm">
      <span>© {currentYear} ORSYS Training Tracker</span>
      <span className="text-gray-600">|</span>
      <span>v1.0.0</span>
    </footer>
  );
}
