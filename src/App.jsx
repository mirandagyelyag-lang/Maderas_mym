import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { lazy, Suspense } from "react";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

const Home = lazy(() => import("@/pages/Home"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Inventario = lazy(() => import("@/pages/Inventario"));
const Vender = lazy(() => import("@/pages/Vender"));
const Ventas = lazy(() => import("@/pages/Ventas"));
const Caja = lazy(() => import("@/pages/Caja"));
const Reportes = lazy(() => import("@/pages/Reportes"));
const Compras = lazy(() => import("@/pages/Compras"));
const Proveedores = lazy(() => import("@/pages/Proveedores"));
const Gastos = lazy(() => import("@/pages/Gastos"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const Cotizaciones = lazy(() => import("@/pages/Cotizaciones"));
const CotizacionDetalle = lazy(() => import("@/pages/CotizacionDetalle"));
const Configuracion = lazy(() => import("@/pages/Configuracion"));
const Usuarios = lazy(() => import("@/pages/Usuarios"));
const Bitacora = lazy(() => import("@/pages/Bitacora"));
const Cubicador = lazy(() => import("@/pages/Cubicador"));

import { PERMISSIONS } from "@/lib/permissions";

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-background text-foreground"><div className="text-center"><div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /><p className="text-sm text-muted-foreground">Cargando Maderas M&M…</p></div></div>}>
    <Routes>
      <Route path="/inicio" element={<Home />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route
            element={
              <ProtectedRoute
                requiredPermission={PERMISSIONS.CUBICADOR}
              />
            }
          >
            <Route path="/cubicador" element={<Cubicador />} />
          </Route>

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
    </Suspense>
  );
}
