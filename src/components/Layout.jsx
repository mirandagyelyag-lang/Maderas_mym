import React, {
  useEffect,
  useState,
} from "react";

import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

import AppSidebar from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Layout() {
  const isMobile = useIsMobile();

  const [
    menuMovilAbierto,
    setMenuMovilAbierto,
  ] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMenuMovilAbierto(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (
      !isMobile ||
      !menuMovilAbierto
    ) {
      return;
    }

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        overflowAnterior;
    };
  }, [
    isMobile,
    menuMovilAbierto,
  ]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {!isMobile && (
        <div className="flex min-h-screen">
          <AppSidebar />

          <main className="min-w-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      )}

      {isMobile && (
        <>
          <header className="mobile-topbar">
            <button
              type="button"
              onClick={() =>
                setMenuMovilAbierto(
                  true
                )
              }
              className="mobile-menu-button"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                Maderas M&M
              </p>

              <p className="text-[11px] text-zinc-500">
                Panel de administración
              </p>
            </div>
          </header>

          <AppSidebar
            mobile
            open={menuMovilAbierto}
            onClose={() =>
              setMenuMovilAbierto(
                false
              )
            }
          />

          <main className="min-w-0 pt-[68px]">
            <Outlet />
          </main>
        </>
      )}
    </div>
  );
}
