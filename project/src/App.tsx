import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout";
import {
  DashboardPage,
  FormationDetailPage,
  MapPage,
  FormationsPage,
  MailsBrutsPage,
  MailDetailPage,
  SettingsPage,
  GeocachePage
} from "./components/pages";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="site-id/*" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="carte" element={<MapPage />} />
          <Route path="formations" element={<FormationsPage />} />
          <Route path="mails" element={<MailsBrutsPage />} />
          <Route path="mails/:emailId" element={<MailDetailPage />} />
          <Route
            path="formations/:formationId"
            element={<FormationDetailPage />}
          />
          <Route path="geocache" element={<GeocachePage />} />
          <Route path="parametres" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
