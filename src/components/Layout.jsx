import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, Wifi, WifiOff } from "lucide-react";

import AppSidebar from "./AppSidebar";
import InstallAppPrompt from "./InstallAppPrompt";
import MobileDock from "./MobileDock";
import { useIsMobile } from "@/hooks/use-mobile";

const ROUTE_TITLES = [
  ["/dashboard", "Inicio"],
  ["/cubicador", "Cubicador IA"],
  ["/vender", "Nueva venta"],
  ["/ventas", "Ventas"],
  ["/inventario", "Inventario"],
  ["/caja", "Caja"],
  ["/cotizaciones", "Cotizaciones"],
  ["/clientes", "Clientes"],
  ["/compras", "Compras"],
  ["/proveedores", "Proveedores"],
  ["/gastos", "Gastos"],
  ["/reportes", "Reportes"],
  ["/usuarios", "Usuarios"],
  ["/bitacora", "Bitácora"],
  ["/configuracion", "Configuración"],
];

export default function Layout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  const pageTitle = useMemo(
    () => ROUTE_TITLES.find(([path]) => location.pathname === path || location.pathname.startsWith(`${path}/`))?.[1] || "Maderas M&M",
    [location.pathname]
  );

  useEffect(() => {
    if (!isMobile) setMenuMovilAbierto(false);
  }, [isMobile]);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!isMobile || !menuMovilAbierto) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflowAnterior; };
  }, [isMobile, menuMovilAbierto]);

  const contenidoPagina = (
    <div key={location.pathname} className="system-page-enter">
      <Outlet />
    </div>
  );

  return (
    <div className="system-shell min-h-screen bg-background text-foreground transition-colors duration-300">
      <InstallAppPrompt />

      {!isMobile && (
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="system-main min-w-0 flex-1 overflow-auto">{contenidoPagina}</main>
        </div>
      )}

      {isMobile && (
        <>
          <header className="mobile-topbar">
            <button type="button" onClick={() => setMenuMovilAbierto(true)} className="mobile-menu-button" aria-label="Abrir menú">
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="mobile-page-title">{pageTitle}</p>
              <p className="mobile-brand-caption">Maderas M&M</p>
            </div>

            <div className={`mobile-network ${online ? "mobile-network-online" : "mobile-network-offline"}`} title={online ? "Con conexión" : "Sin conexión"}>
              {online ? <Wifi /> : <WifiOff />}
              <span>{online ? "En línea" : "Offline"}</span>
            </div>
          </header>

          <AppSidebar mobile open={menuMovilAbierto} onClose={() => setMenuMovilAbierto(false)} />

          <main className="system-main system-main-mobile min-w-0">{contenidoPagina}</main>

          <MobileDock onMenu={() => setMenuMovilAbierto(true)} />
        </>
      )}
    </div>
  );
}
