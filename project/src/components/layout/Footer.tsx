export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <span>© {currentYear} ORSYS Training Tracker</span>
      <span className="footer-separator">|</span>
      <span>v1.0.0</span>
    </footer>
  );
}
