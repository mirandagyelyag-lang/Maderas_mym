import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, DollarSign, Users, FileText, LogOut, User } from "lucide-react";

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Inventario', icon: Package, path: '/inventario' },
    { name: 'Ventas', icon: ShoppingCart, path: '/ventas' },
    { name: 'Gastos', icon: DollarSign, path: '/gastos' },
    { name: 'Clientes', icon: Users, path: '/clientes' },
    { name: 'Cotizaciones', icon: FileText, path: '/cotizaciones' },
  ];

  return (
    // 'h-screen' y 'flex-col' mantienen el sidebar fijo y el layout vertical
    <aside className="w-72 h-screen sticky top-0 bg-[hsl(20,8%,12%)] border-r border-[hsl(30,8%,22%)] rounded-r-[8px] text-white flex flex-col p-2 flex-shrink-0">
      
      {/* LOGO: Mantenido en grande, sin scroll */}
      <div className="mb-2 p-2 border-b border-[hsl(30,8%,22%)] flex justify-center flex-shrink-0">
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="w-56 h-56 rounded-2xl object-cover" 
          onError={(e) => { 
            e.target.style.display = 'none'; 
          }}
        />
      </div>

      {/* NAVEGACIÓN: 'justify-evenly' distribuye las categorías en el espacio sobrante. NO tiene scroll. */}
      <nav className="flex-1 flex flex-col justify-evenly py-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button 
              key={item.name}
              onClick={() => navigate(item.path)}
              // Padding reducido a p-2 y texto a text-sm para que quepa todo sin scroll
              className={`flex items-center gap-3 w-full p-2 rounded-[8px] transition-all duration-200 ${
                isActive 
                  ? 'bg-[#C3A579] text-zinc-900 font-bold shadow-md' 
                  : 'text-zinc-400 hover:bg-[hsl(30,8%,22%)] hover:text-white'
              }`}
            >
              <item.icon className="w-7 h-8" />
              <span className="font-medium text-sm">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* FOOTER: Siempre fijo al final */}
      <div className="pt-2 border-t border-[hsl(30,8%,22%)] space-y-1 flex-shrink-0">
        <div className="flex items-center gap-2 p-2 rounded-[8px] bg-[hsl(30,8%,22%)/30]">
          <div className="w-8 h-8 rounded-full bg-[hsl(30,8%,22%)] flex items-center justify-center">
            <User className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium">Administrador</span>
            <span className="text-[10px] text-zinc-400">Maderas M&M</span>
          </div>
        </div>
        <button 
          onClick={() => console.log("Cerrar sesión")}
          className="flex items-center gap-2 w-full p-2 text-zinc-400 hover:text-red-400 transition-colors text-sm"
        >
          <LogOut className="w-5 h-4" />
          <span className="font-medium">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;