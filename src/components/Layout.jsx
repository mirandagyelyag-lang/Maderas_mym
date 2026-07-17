import React, {
  useEffect,
  useState,
} from "react";

import {
  Outlet,
  useLocation,
} from "react-router-dom";
import { Menu } from "lucide-react";

import AppSidebar from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  aplicarTema,
  obtenerTemaGuardado,
} from "@/lib/themes";

export default function Layout() {
  const isMobile = useIsMobile();
  const location = useLocation();

  const [
    menuMovilAbierto,
    setMenuMovilAbierto,
  ] = useState(false);

  useEffect(() => {
    aplicarTema(obtenerTemaGuardado());
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMenuMovilAbierto(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !menuMovilAbierto) {
      return;
    }

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [isMobile, menuMovilAbierto]);

  const contenidoPagina = (
    <div
      key={location.pathname}
      className="system-page-enter"
    >
      <Outlet />
    </div>
  );

  return (
    <div className="system-shell min-h-screen bg-background text-foreground transition-colors duration-300">
      {!isMobile && (
        <div className="flex min-h-screen">
          <AppSidebar />

          <main className="system-main min-w-0 flex-1 overflow-auto">
            {contenidoPagina}
          </main>
        </div>
      )}

      {isMobile && (
        <>
          <header className="mobile-topbar">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              className="mobile-menu-button"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                Maderas M&M
              </p>

              <p className="text-[11px] text-muted-foreground">
                Panel de administración
              </p>
            </div>
          </header>

          <AppSidebar
            mobile
            open={menuMovilAbierto}
            onClose={() => setMenuMovilAbierto(false)}
          />

          <main className="system-main min-w-0 pt-[68px]">
            {contenidoPagina}
          </main>
        </>
      )}
    </div>
  );
}
