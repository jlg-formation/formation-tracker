import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout";
import {
  DashboardPage,
  MapPage,
  FormationsPage,
  SettingsPage
} from "./components/pages";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="carte" element={<MapPage />} />
          <Route path="formations" element={<FormationsPage />} />
          <Route path="parametres" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
