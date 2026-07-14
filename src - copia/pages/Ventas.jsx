import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { Loader2, ShoppingCart } from "lucide-react";

const pagoColors = {
  Efectivo: "bg-emerald-500/10 text-emerald-500",
  Transferencia: "bg-blue-500/10 text-blue-500",
  Tarjeta: "bg-violet-500/10 text-violet-500",
  "Cuenta Corriente": "bg-amber-500/10 text-amber-500",
};

export default function Ventas() {
  const { user } = useAuth();
  const [ventas, setVentas] = useState(null);

  useEffect(() => {
    const ventasGuardadas = JSON.parse(localStorage.getItem("ventas") || "[]");
    setVentas(ventasGuardadas);
  }, []);

  if (!ventas) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const hoy = new Date().toDateString();
  const ventasHoy = ventas.filter((v) => new Date(v.fecha).toDateString() === hoy);
  const totalHoy = ventasHoy.reduce((s, v) => s + (v.total || 0), 0);
  const totalMes = ventas
    .filter((v) => { const d = new Date(v.fecha); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); })
    .reduce((s, v) => s + (v.total || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ventas</h1>
        <p className="text-muted-foreground">Historial de transacciones registradas</p>
      </div>

      {/* Tarjetas de resumen igual al Dashboard */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6 bg-card border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Ventas hoy</p>
          <p className="text-3xl font-bold mt-1 text-primary">{fmtMoney(totalHoy)}</p>
          <p className="text-xs text-muted-foreground mt-2">{ventasHoy.length} transacciones</p>
        </Card>
        <Card className="p-6 bg-card border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Total del mes</p>
          <p className="text-3xl font-bold mt-1">{fmtMoney(totalMes)}</p>
          <p className="text-xs text-muted-foreground mt-2">{ventas.length} ventas totales</p>
        </Card>
      </div>

      {/* Tabla con estilo limpio */}
      <Card className="overflow-hidden border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="p-4 text-left font-medium">Fecha</th>
                <th className="p-4 text-left font-medium">Producto</th>
                <th className="p-4 text-right font-medium">Cant.</th>
                <th className="p-4 text-right font-medium">Total</th>
                <th className="p-4 text-left font-medium">Pago</th>
                <th className="p-4 text-left font-medium">Trabajador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ventas.length > 0 ? (
                ventas.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-4 text-[#C3A579] font-medium">{fmtDateTime(v.fecha)}</td>
                    <td className="p-4 font-medium">{v.nombre_producto}</td>
                    <td className="p-4 text-right">{v.cantidad}</td>
                    <td className="p-4 text-right font-bold">{fmtMoney(v.total)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${pagoColors[v.metodo_pago] || "bg-secondary"}`}>
                        {v.metodo_pago}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
  {v.cliente || "Cliente no registrado"}
</td>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">No hay ventas registradas</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}