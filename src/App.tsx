import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Metrics from "./pages/Metrics";
import Lab from "./pages/Lab";
import NotFound from "./pages/NotFound";
import Probe from "./pages/Probe";
import RepReadout from "./pages/RepReadout";
import Report from "./pages/Report";
import { StoreProvider } from "./store";

// The shareable single-file preview keeps its route in memory; the deployed
// site uses real paths so every report section has its own URL.
const Router = __PREVIEW__ ? MemoryRouter : BrowserRouter;

export default function App() {
  return (
    <StoreProvider>
      <Router {...(__PREVIEW__ ? { initialEntries: ["/lab"] } : {})}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="rep" element={<RepReadout />} />
            <Route path="probe" element={<Probe />} />
            <Route path="report" element={<Report />} />
            <Route path="report/:section" element={<Report />} />
            <Route path="metrics" element={<Metrics />} />
            <Route path="lab" element={<Lab />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
    </StoreProvider>
  );
}
