import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout";
import {
  DashboardPage,
  MapPage,
  FormationsPage,
  SettingsPage
} from "./components/pages";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
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
