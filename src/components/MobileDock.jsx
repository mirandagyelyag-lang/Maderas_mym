import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ScanLine, ShoppingCart, Menu } from "lucide-react";

import { useAuth } from "@/lib/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";

const ITEMS = [
  { label: "Inicio", path: "/dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD },
  { label: "Cubicar", path: "/cubicador", icon: ScanLine, permission: PERMISSIONS.CUBICADOR, featured: true },
  { label: "Vender", path: "/vender", icon: ShoppingCart, permission: PERMISSIONS.VENDER },
  { label: "Stock", path: "/inventario", icon: Package, permission: PERMISSIONS.INVENTARIO },
];

export default function MobileDock({ onMenu }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuth();

  const visibleItems = ITEMS.filter((item) => can(item.permission));

  return (
    <nav className="mobile-dock" aria-label="Navegación rápida">
      <div className="mobile-dock-inner">
        {visibleItems.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`mobile-dock-item ${active ? "mobile-dock-item-active" : ""} ${item.featured ? "mobile-dock-item-featured" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-dock-icon"><Icon /></span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <button type="button" onClick={onMenu} className="mobile-dock-item">
          <span className="mobile-dock-icon"><Menu /></span>
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
}
