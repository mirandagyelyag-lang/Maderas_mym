import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-zinc-950">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}