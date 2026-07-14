import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup, 
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter 
} from "@/components/ui/sidebar";
import { LayoutDashboard, Package, ShoppingCart, DollarSign, Users, FileText, LogOut } from "lucide-react";

const AppSidebar = () => {
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Inventario', icon: Package, path: '/inventario' },
    { name: 'Ventas', icon: ShoppingCart, path: '/ventas' },
    { name: 'Gastos', icon: DollarSign, path: '/gastos' },
    { name: 'Clientes', icon: Users, path: '/clientes' },
    { name: 'Cotizaciones', icon: FileText, path: '/cotizaciones' },
  ];

  return (
    <Sidebar className="bg-zinc-950 border-r border-zinc-800 text-white w-64">
      <SidebarHeader className="p-8 pb-4 flex justify-center items-center border-b border-zinc-800">
        <div className="w-48 h-48 rounded-2xl overflow-hidden flex items-center justify-center">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild>
                    <button 
                      onClick={() => navigate(item.path)}
                      className="flex items-center gap-3 p-3 w-full rounded-lg transition-all text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-zinc-800 mt-auto">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center font-bold text-sm">M</div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Miranda</span>
            <span className="text-xs text-zinc-500">Administrador</span>
          </div>
        </div>
        <button className="w-full flex items-center gap-2 text-zinc-400 hover:text-red-400 transition-colors px-2 py-2 text-sm">
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;