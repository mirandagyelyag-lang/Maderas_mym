import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  Truck,
  ClipboardList,
  X,
} from "lucide-react";

const CONFIG_KEY = "configuracion_empresa";

const configuracionInicial = {
  nombre: "Maderas M&M",
  logo: "/logo.png",
};

export default function AppSidebar({
  mobile = false,
  open = false,
  onClose,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [configuracion, setConfiguracion] =
    useState(configuracionInicial);

  useEffect(() => {
    const cargarConfiguracion = () => {
      try {
        const guardada = JSON.parse(
          localStorage.getItem(CONFIG_KEY) || "{}"
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

        setConfiguracion(configuracionInicial);
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

  useEffect(() => {
    if (mobile) onClose?.();
  }, [location.pathname, mobile]);

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { name: "Inventario", icon: Package, path: "/inventario" },
    { name: "Vender", icon: ShoppingCart, path: "/vender" },
    { name: "Ventas", icon: Receipt, path: "/ventas" },
    { name: "Compras", icon: ClipboardList, path: "/compras" },
    { name: "Proveedores", icon: Truck, path: "/proveedores" },
    { name: "Gastos", icon: DollarSign, path: "/gastos" },
    { name: "Clientes", icon: Users, path: "/clientes" },
    { name: "Cotizaciones", icon: FileText, path: "/cotizaciones" },
  ];

  const estaActivo = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(`${path}/`);

  const navegar = (path) => {
    navigate(path);
    if (mobile) onClose?.();
  };

  const contenido = (
    <aside
      className={`app-sidebar ${
        mobile
          ? "app-sidebar-mobile"
          : "app-sidebar-desktop"
      } ${
        mobile && open
          ? "app-sidebar-mobile-open"
          : ""
      }`}
    >
      <div className="sidebar-top">
        <div className="sidebar-brand-row">
          <img
            src={configuracion.logo || "/logo.png"}
            alt={configuracion.nombre || "Logo"}
            className={
              mobile
                ? "sidebar-logo-mobile"
                : "sidebar-logo-desktop"
            }
            onError={(event) => {
              event.currentTarget.src = "/logo.png";
            }}
          />

          {mobile && (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {configuracion.nombre || "Maderas M&M"}
                </p>

                <p className="text-xs text-zinc-500">
                  Menú principal
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mobile-close-button"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        <div className="sidebar-account">
          <div className="sidebar-account-avatar">
            <User className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Administrador
            </p>

            <p className="text-xs text-zinc-500 truncate">
              {configuracion.nombre || "Maderas M&M"}
            </p>
          </div>
        </div>
      </div>

      <nav className="sidebar-scroll flex-1 overflow-y-auto">
        <div className="sidebar-menu">
          {menuItems.map((item) => {
            const isActive = estaActivo(item.path);

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => navegar(item.path)}
                className={`sidebar-link ${
                  isActive ? "sidebar-link-active" : ""
                }`}
              >
                <item.icon className="w-6 h-6 shrink-0" />

                <span className="font-medium text-sm">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          title="Configuración"
          aria-label="Configuración"
          onClick={() => navegar("/configuracion")}
          className={`sidebar-footer-button ${
            estaActivo("/configuracion")
              ? "sidebar-footer-button-active"
              : ""
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>

        <button
          type="button"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          onClick={() => console.log("Cerrar sesión")}
          className="sidebar-footer-button sidebar-footer-logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );

  if (!mobile) return contenido;

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={onClose}
        className={`mobile-sidebar-overlay ${
          open ? "mobile-sidebar-overlay-open" : ""
        }`}
      />

      {contenido}
    </>
  );
}