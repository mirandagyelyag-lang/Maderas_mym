import { Outlet, Link } from "react-router-dom";
import { Users, FileText } from "lucide-react";

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <aside className="w-64 border-r border-zinc-800 p-4 flex flex-col gap-2">
        <h2 className="text-xl font-bold mb-6 px-2">Gestión</h2>
        <Link to="/clientes" className="p-2 rounded flex items-center gap-2 hover:bg-zinc-900">
          <Users className="w-5 h-5" /> Clientes
        </Link>
      </aside>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}