import React from "react";
import { Card } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import { fmtMoney } from "@/lib/format";
import { TrendingUp, Wallet, Banknote, Package, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const CHART_COLORS = ["hsl(36,38%,62%)", "hsl(142,60%,45%)", "hsl(0,72%,51%)", "hsl(197,52%,55%)", "hsl(280,55%,65%)"];

export default function Dashboard({ ventas = [], gastos = [], productos = [] }) {
  const now = new Date();
  const mesActual = now.getMonth();
  const anoActual = now.getFullYear();

  // Cálculos de lógica (Mantienen la estructura original)
  const ventasMes = ventas.filter((v) => {
    const d = new Date(v.fecha);
    return d.getMonth() === mesActual && d.getFullYear() === anoActual;
  });
  
  const gastosMes = gastos.filter((g) => {
    const d = new Date(g.fecha);
    return d.getMonth() === mesActual && d.getFullYear() === anoActual;
  });

  const ingresosMes = ventasMes.reduce((s, v) => s + (v.total || 0), 0);
  const costoVentasMes = ventasMes.reduce((s, v) => s + (v.costo_unitario || 0) * (v.cantidad || 0), 0);
  const gananciaBruta = ingresosMes - costoVentasMes;
  const gastosTotales = gastosMes.reduce((s, g) => s + (g.monto || 0), 0);
  const gananciaNeta = gananciaBruta - gastosTotales;

  // Preparación de datos para la gráfica de 7 días
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  
  const chartData = dias.map((d) => {
    const vd = ventas.filter((v) => { const f = new Date(v.fecha); return f.toDateString() === d.toDateString(); });
    const gd = gastos.filter((g) => { const f = new Date(g.fecha); return f.toDateString() === d.toDateString(); });
    return {
      dia: d.toLocaleDateString("es-CL", { weekday: "short" }),
      ingresos: vd.reduce((s, v) => s + (v.total || 0), 0),
      gastos: gd.reduce((s, g) => s + (g.monto || 0), 0),
    };
  });

  const gastosPorCat = ["Insumos", "Combustible", "Sueldos", "Mantenimiento", "Otros"].map((cat, i) => ({
    name: cat,
    value: gastosMes.filter((g) => g.categoria === cat).reduce((s, g) => s + (g.monto || 0), 0),
    color: CHART_COLORS[i],
  })).filter((d) => d.value > 0);

  const stockCritico = productos.filter((p) => p.stock_actual <= p.stock_minimo && p.activo !== false);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold font-heading">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen de {now.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard icon={TrendingUp} label="Ingresos del mes" value={fmtMoney(ingresosMes)} accent="primary" />
        <StatCard icon={Banknote} label="Ganancia bruta" value={fmtMoney(gananciaBruta)} accent="green" />
        <StatCard icon={Wallet} label="Gastos del mes" value={fmtMoney(gastosTotales)} accent="red" />
        <StatCard icon={Banknote} label="Ganancia neta" value={fmtMoney(gananciaNeta)} accent={gananciaNeta >= 0 ? "green" : "red"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 bg-card border-border">
          <h3 className="font-semibold mb-4">Ingresos vs Gastos (7 días)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(30,8%,22%)" />
              <XAxis dataKey="dia" stroke="hsl(36,10%,55%)" fontSize={12} />
              <YAxis stroke="hsl(36,10%,55%)" fontSize={12} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip contentStyle={{ background: "hsl(20,8%,12%)", border: "1px solid hsl(30,8%,22%)", borderRadius: "8px" }} formatter={(v) => fmtMoney(v)} />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="hsl(36,38%,62%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 bg-card border-border">
          <h3 className="font-semibold mb-4">Gastos por categoría</h3>
          {gastosPorCat.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={gastosPorCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                  {gastosPorCat.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(20,8%,12%)", border: "1px solid hsl(30,8%,22%)", borderRadius: "8px" }} formatter={(v) => fmtMoney(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sin gastos este mes</div>
          )}
        </Card>
      </div>

      <Card className="p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="font-semibold">Stock crítico</h3>
          <span className="ml-auto text-sm text-muted-foreground">{stockCritico.length} producto(s)</span>
        </div>
        {stockCritico.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">Todo el inventario está en niveles saludables ✓</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stockCritico.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.categoria}</p>
                </div>
                <div className="text-right">
                  <p className="text-destructive font-bold text-sm">{p.stock_actual} {p.unidad_medida?.toLowerCase()}</p>
                  <p className="text-xs text-muted-foreground">mín: {p.stock_minimo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}