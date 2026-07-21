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
import Ventas from "@/pages/Ventas";
import Gastos from "@/pages/Gastos";
import Clientes from "@/pages/Clientes";
import Cotizaciones from "@/pages/Cotizaciones";

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
            path="/ventas"
            element={<Ventas />}
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