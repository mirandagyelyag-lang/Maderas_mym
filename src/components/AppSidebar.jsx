import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { useLocation, useNavigate } from "react-router-dom";

import {
  ChartNoAxesCombined,
  Bell,
  ClipboardList,
  DollarSign,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  User,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import {
  normalizeStoredUsers,
  PERMISSIONS,
  ROLE_LABELS,
  USERS_KEY,
} from "@/lib/permissions";

const CONFIG_KEY = "configuracion_empresa";

const LOGOS_POR_TEMA = {
  "oscuro-mm": "/logo.png",
  "claro-minimal": "/logo-blanco.png",
  "madera-pastel": "/logo-arena.png",
  "rosa-pastel": "/logo-rosa.png",
  "celeste-pastel": "/logo-celeste.png",
  "lavanda-pastel": "/logo-violeta.png",
  "verde-salvia": "/logo-verde.png",
  "arena-calida": "/logo-arena.png",
  grafito: "/logo.png",
};

const configuracionInicial = {
  nombre: "Maderas M&M",
  logo: "/logo.png",
};

const PENDING_ALERT_SESSION_KEY =
  "mm_pending_accounts_alerted";

function playPendingAccountSound() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.12,
      audioContext.currentTime + 0.025
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.65
    );

    gain.connect(audioContext.destination);

    [659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        frequency,
        audioContext.currentTime
      );
      oscillator.connect(gain);
      oscillator.start(audioContext.currentTime + index * 0.12);
      oscillator.stop(audioContext.currentTime + 0.55);
    });

    window.setTimeout(() => {
      audioContext.close().catch(() => {});
    }, 900);
  } catch (error) {
    console.warn(
      "El navegador no permitió reproducir la alerta:",
      error
    );
  }
}

export default function AppSidebar({
  mobile = false,
  open = false,
  onClose,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, can } = useAuth();
  const pendingSignatureRef = useRef("");

  const [configuracion, setConfiguracion] = useState(
    configuracionInicial
  );

  const logoPersonal =
    user?.logoMode === "manual" && user?.logoVariant
      ? user.logoVariant
      : LOGOS_POR_TEMA[user?.themeId] || configuracion.logo || "/logo.png";

  const [pendingUsers, setPendingUsers] = useState([]);

  useEffect(() => {
    const loadPendingUsers = () => {
      try {
        const users = normalizeStoredUsers(
          JSON.parse(
            localStorage.getItem(USERS_KEY) || "[]"
          )
        );

        setPendingUsers(
          users.filter(
            (account) =>
              account.status === "pending"
          )
        );
      } catch (error) {
        console.error(
          "No se pudieron revisar las solicitudes de acceso:",
          error
        );

        setPendingUsers([]);
      }
    };

    loadPendingUsers();

    window.addEventListener("storage", loadPendingUsers);
    window.addEventListener(
      "usuarios-actualizados",
      loadPendingUsers
    );

    return () => {
      window.removeEventListener("storage", loadPendingUsers);
      window.removeEventListener(
        "usuarios-actualizados",
        loadPendingUsers
      );
    };
  }, []);

  useEffect(() => {
    if (
      !can(PERMISSIONS.USUARIOS) ||
      pendingUsers.length === 0
    ) {
      pendingSignatureRef.current = "";
      return;
    }

    const signature = pendingUsers
      .map((account) => String(account.id))
      .sort()
      .join("|");

    if (pendingSignatureRef.current === signature) return;

    pendingSignatureRef.current = signature;

    const previousSignature = sessionStorage.getItem(
      PENDING_ALERT_SESSION_KEY
    );

    if (previousSignature !== signature) {
      playPendingAccountSound();
      sessionStorage.setItem(
        PENDING_ALERT_SESSION_KEY,
        signature
      );
    }
  }, [pendingUsers, can]);

  useEffect(() => {
    const cargar = () => {
      try {
        setConfiguracion({
          ...configuracionInicial,
          ...JSON.parse(
            localStorage.getItem(CONFIG_KEY) || "{}"
          ),
        });
      } catch {
        setConfiguracion(configuracionInicial);
      }
    };

    cargar();
    window.addEventListener(
      "configuracion-empresa-actualizada",
      cargar
    );
    window.addEventListener("storage", cargar);

    return () => {
      window.removeEventListener(
        "configuracion-empresa-actualizada",
        cargar
      );
      window.removeEventListener("storage", cargar);
    };
  }, []);

  useEffect(() => {
    if (mobile) onClose?.();
  }, [location.pathname, mobile]);

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      permission: PERMISSIONS.DASHBOARD,
    },
    {
      name: "Inventario",
      icon: Package,
      path: "/inventario",
      permission: PERMISSIONS.INVENTARIO,
    },
    {
      name: "Vender",
      icon: ShoppingCart,
      path: "/vender",
      permission: PERMISSIONS.VENDER,
    },
    {
      name: "Ventas",
      icon: Receipt,
      path: "/ventas",
      permission: PERMISSIONS.VENTAS,
    },
    {
      name: "Caja",
      icon: WalletCards,
      path: "/caja",
      permission: PERMISSIONS.CAJA,
    },
    {
      name: "Reportes",
      icon: ChartNoAxesCombined,
      path: "/reportes",
      permission: PERMISSIONS.REPORTES,
    },
    {
      name: "Compras",
      icon: ClipboardList,
      path: "/compras",
      permission: PERMISSIONS.COMPRAS,
    },
    {
      name: "Proveedores",
      icon: Truck,
      path: "/proveedores",
      permission: PERMISSIONS.PROVEEDORES,
    },
    {
      name: "Gastos",
      icon: DollarSign,
      path: "/gastos",
      permission: PERMISSIONS.GASTOS,
    },
    {
      name: "Clientes",
      icon: Users,
      path: "/clientes",
      permission: PERMISSIONS.CLIENTES,
    },
    {
      name: "Cotizaciones",
      icon: FileText,
      path: "/cotizaciones",
      permission: PERMISSIONS.COTIZACIONES,
    },
    {
      name: "Usuarios",
      icon: UserCog,
      path: "/usuarios",
      permission: PERMISSIONS.USUARIOS,
    },
    {
      name: "Bitácora",
      icon: History,
      path: "/bitacora",
      permission: PERMISSIONS.BITACORA,
    },
  ].filter((item) => can(item.permission));

  const estaActivo = (path) =>
    location.pathname === path ||
    location.pathname.startsWith(`${path}/`);

  const navegar = (path) => {
    navigate(path);
    if (mobile) onClose?.();
  };

  const cerrarSesion = () => {
    logout();
    navigate("/inicio", { replace: true });
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
            src={logoPersonal}
            alt={configuracion.nombre || "Logo"}
            className={
              mobile
                ? "sidebar-logo-mobile"
                : "sidebar-logo-desktop"
            }
            onError={(event) => {
              event.currentTarget.src = configuracion.logo || "/logo.png";
            }}
          />

          {mobile && (
            <>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {configuracion.nombre || "Maderas M&M"}
                </p>
                <p className="text-xs text-muted-foreground">
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
            <p className="text-sm font-semibold truncate">
              {user?.name || "Usuario"}
            </p>
            <p className="text-xs opacity-65 truncate">
              {ROLE_LABELS[user?.role] || "Sin rol"}
            </p>
          </div>
        </div>

        {can(PERMISSIONS.USUARIOS) &&
          pendingUsers.length > 0 && (
            <button
              type="button"
              onClick={() => navegar("/usuarios")}
              className="mt-3 w-full rounded-xl border border-primary/25 bg-primary/10 px-3 py-3 text-left transition hover:bg-primary/15"
            >
              <div className="flex items-start gap-3">
                <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bell className="h-4 w-4" />

                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
                </span>

                <span className="min-w-0">
                  <strong className="block text-xs font-semibold text-foreground">
                    Nueva solicitud de acceso
                  </strong>

                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                    {pendingUsers.length === 1
                      ? "Una cuenta espera tu aprobación."
                      : `${pendingUsers.length} cuentas esperan tu aprobación.`}
                  </span>
                </span>
              </div>
            </button>
          )}
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

                {item.permission === PERMISSIONS.USUARIOS &&
                  pendingUsers.length > 0 && (
                    <span className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                      {pendingUsers.length > 99
                        ? "99+"
                        : pendingUsers.length}
                    </span>
                  )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        {can(PERMISSIONS.CONFIGURACION) && (
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
        )}

        <button
          type="button"
          title="Salir del sistema"
          aria-label="Salir del sistema"
          onClick={cerrarSesion}
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