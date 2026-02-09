import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function Layout() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-auto">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
