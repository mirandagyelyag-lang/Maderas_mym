import React, { useEffect, useState } from "react";
import {
  useNavigate,
  useLocation,
} from "react-router-dom";

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  DollarSign,
  Users,
  FileText,
  LogOut,
  User,
  Settings,
} from "lucide-react";

const CONFIG_KEY = "configuracion_empresa";

const configuracionInicial = {
  nombre: "Maderas M&M",
  logo: "/logo.png",
};

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [configuracion, setConfiguracion] =
    useState(configuracionInicial);

  useEffect(() => {
    const cargarConfiguracion = () => {
      try {
        const guardada = JSON.parse(
          localStorage.getItem(CONFIG_KEY) ||
            "{}"
        );

        setConfiguracion({
          ...configuracionInicial,
          ...guardada,
        });
      } catch (error) {
        console.error(
          "Error cargando configuración:",
          error
        );

        setConfiguracion(
          configuracionInicial
        );
      }
    };

    cargarConfiguracion();

    window.addEventListener(
      "configuracion-empresa-actualizada",
      cargarConfiguracion
    );

    window.addEventListener(
      "storage",
      cargarConfiguracion
    );

    return () => {
      window.removeEventListener(
        "configuracion-empresa-actualizada",
        cargarConfiguracion
      );

      window.removeEventListener(
        "storage",
        cargarConfiguracion
      );
    };
  }, []);

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      name: "Inventario",
      icon: Package,
      path: "/inventario",
    },
    {
      name: "Vender",
      icon: ShoppingCart,
      path: "/vender",
    },
    {
      name: "Ventas",
      icon: Receipt,
      path: "/ventas",
    },
    {
      name: "Gastos",
      icon: DollarSign,
      path: "/gastos",
    },
    {
      name: "Clientes",
      icon: Users,
      path: "/clientes",
    },
    {
      name: "Cotizaciones",
      icon: FileText,
      path: "/cotizaciones",
    },
  ];

  const estaActivo = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(
      `${path}/`
    );

  return (
    <aside className="w-72 h-screen sticky top-0 bg-[hsl(20,8%,12%)] border-r border-[hsl(30,8%,22%)] rounded-r-[8px] text-white flex flex-col p-2 flex-shrink-0">
      <div className="mb-2 p-2 border-b border-[hsl(30,8%,22%)] flex justify-center flex-shrink-0">
        <img
          src={
            configuracion.logo ||
            "/logo.png"
          }
          alt={
            configuracion.nombre ||
            "Logo"
          }
          className="w-56 h-56 rounded-2xl object-cover"
          onError={(event) => {
            event.currentTarget.src =
              "/logo.png";
          }}
        />
      </div>

      <nav className="flex-1 flex flex-col justify-evenly py-2">
        {menuItems.map((item) => {
          const isActive =
            estaActivo(item.path);

          return (
            <button
              key={item.name}
              type="button"
              onClick={() =>
                navigate(item.path)
              }
              className={`flex items-center gap-3 w-full p-2 rounded-[8px] transition-all duration-200 ${
                isActive
                  ? "bg-[#C3A579] text-zinc-900 font-bold shadow-md"
                  : "text-zinc-400 hover:bg-[hsl(30,8%,22%)] hover:text-white"
              }`}
            >
              <item.icon className="w-7 h-8" />

              <span className="font-medium text-sm">
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="pt-2 border-t border-[hsl(30,8%,22%)] space-y-1 flex-shrink-0">
        <button
          type="button"
          onClick={() =>
            navigate("/configuracion")
          }
          className={`flex items-center gap-2 w-full p-2 rounded-[8px] transition-colors text-sm ${
            estaActivo("/configuracion")
              ? "bg-[#C3A579] text-zinc-900 font-bold"
              : "text-zinc-400 hover:bg-[hsl(30,8%,22%)] hover:text-white"
          }`}
        >
          <Settings className="w-5 h-5" />

          <span className="font-medium">
            Configuración
          </span>
        </button>

        <div className="flex items-center gap-2 p-2 rounded-[8px] bg-[hsl(30,8%,22%)/30]">
          <div className="w-8 h-8 rounded-full bg-[hsl(30,8%,22%)] flex items-center justify-center">
            <User className="w-4 h-4 text-zinc-400" />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium">
              Administrador
            </span>

            <span className="text-[10px] text-zinc-400 truncate">
              {configuracion.nombre ||
                "Maderas M&M"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            console.log(
              "Cerrar sesión"
            )
          }
          className="flex items-center gap-2 w-full p-2 text-zinc-400 hover:text-red-400 transition-colors text-sm"
        >
          <LogOut className="w-5 h-4" />

          <span className="font-medium">
            Cerrar sesión
          </span>
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
