import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Ventas from "./pages/Ventas";
import Gastos from "./pages/Gastos";
import Clientes from "./pages/Clientes";
import Cotizaciones from "./pages/Cotizaciones";
import CotizacionDetalle from "./pages/CotizacionDetalle";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cotizaciones" element={<Cotizaciones />} />
          <Route
            path="/cotizaciones/:id"
            element={<CotizacionDetalle />}
          />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}