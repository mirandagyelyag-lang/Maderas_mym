import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Home from "@/pages/Home";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Dashboard from "@/pages/Dashboard";
import Inventario from "@/pages/Inventario";
import Vender from "@/pages/Vender";
import Ventas from "@/pages/Ventas";
import Caja from "@/pages/Caja";
import Reportes from "@/pages/Reportes";
import Compras from "@/pages/Compras";
import Proveedores from "@/pages/Proveedores";
import Gastos from "@/pages/Gastos";
import Clientes from "@/pages/Clientes";
import Cotizaciones from "@/pages/Cotizaciones";
import Configuracion from "@/pages/Configuracion";

export default function App() {
  return (
    <Routes>
      <Route
        path="/inicio"
        element={<Home />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/inventario"
            element={<Inventario />}
          />

          <Route
            path="/vender"
            element={<Vender />}
          />

          <Route
            path="/ventas"
            element={<Ventas />}
          />

          <Route
            path="/caja"
            element={<Caja />}
          />

          <Route
            path="/reportes"
            element={<Reportes />}
          />

          <Route
            path="/compras"
            element={<Compras />}
          />

          <Route
            path="/proveedores"
            element={<Proveedores />}
          />

          <Route
            path="/gastos"
            element={<Gastos />}
          />

          <Route
            path="/clientes"
            element={<Clientes />}
          />

          <Route
            path="/cotizaciones"
            element={<Cotizaciones />}
          />

          <Route
            path="/configuracion"
            element={<Configuracion />}
          />
        </Route>
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/inicio"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/inicio"
            replace
          />
        }
      />
    </Routes>
  );
}