import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Metrics from "./pages/Metrics";
import NotFound from "./pages/NotFound";
import Probe from "./pages/Probe";
import RepReadout from "./pages/RepReadout";
import Report from "./pages/Report";
import { StoreProvider } from "./store";

// The shareable single-file preview uses hash URLs; the deployed site uses real paths.
const Router = __HASH_ROUTER__ ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <StoreProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="rep" element={<RepReadout />} />
            <Route path="probe" element={<Probe />} />
            <Route path="report" element={<Report />} />
            <Route path="report/:section" element={<Report />} />
            <Route path="metrics" element={<Metrics />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
    </StoreProvider>
  );
}
