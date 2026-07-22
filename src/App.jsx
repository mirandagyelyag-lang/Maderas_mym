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
import CotizacionDetalle from "@/pages/CotizacionDetalle";
import Configuracion from "@/pages/Configuracion";
import Usuarios from "@/pages/Usuarios";
import Bitacora from "@/pages/Bitacora";

import { PERMISSIONS } from "@/lib/permissions";

export default function App() {
  return (
    <Routes>
      <Route path="/inicio" element={<Home />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.DASHBOARD}
              />
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.INVENTARIO}
              />
            }
          >
            <Route path="/inventario" element={<Inventario />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.VENDER}
              />
            }
          >
            <Route path="/vender" element={<Vender />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.VENTAS}
              />
            }
          >
            <Route path="/ventas" element={<Ventas />} />
          </Route>

          <Route
            element={
              <ProtectedRoute requiredPermission={PERMISSIONS.CAJA} />
            }
          >
            <Route path="/caja" element={<Caja />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.REPORTES}
              />
            }
          >
            <Route path="/reportes" element={<Reportes />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.COMPRAS}
              />
            }
          >
            <Route path="/compras" element={<Compras />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.PROVEEDORES}
              />
            }
          >
            <Route path="/proveedores" element={<Proveedores />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.GASTOS}
              />
            }
          >
            <Route path="/gastos" element={<Gastos />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.CLIENTES}
              />
            }
          >
            <Route path="/clientes" element={<Clientes />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.COTIZACIONES}
              />
            }
          >
            <Route path="/cotizaciones" element={<Cotizaciones />} />
            <Route
              path="/cotizaciones/:id"
              element={<CotizacionDetalle />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.CONFIGURACION}
              />
            }
          >
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.USUARIOS}
              />
            }
          >
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.BITACORA}
              />
            }
          >
            <Route path="/bitacora" element={<Bitacora />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}