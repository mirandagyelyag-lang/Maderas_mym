import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import { fmtMoney } from "@/lib/format";

import {
  TrendingUp,
  Wallet,
  Banknote,
  Package,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  ShoppingCart,
  Clock3,
  Trophy,
  Crown,
  BellRing,
  UserRound,
  Sparkles,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(36,38%,62%)",
  "hsl(142,60%,45%)",
  "hsl(0,72%,51%)",
  "hsl(197,52%,55%)",
  "hsl(280,55%,65%)",
];

const PERIODOS = [
  { id: "7d", nombre: "7 días", dias: 7 },
  { id: "14d", nombre: "2 semanas", dias: 14 },
  { id: "30d", nombre: "1 mes", dias: 30 },
];

// Función helper para parsear fechas de forma segura evitando desajustes de zona horaria
const parsearFechaLocal = (dateString) => {
  if (!dateString) return new Date();
  // Si viene solo fecha YYYY-MM-DD sin hora, añadimos la hora para que se parsee en local
  if (dateString.length === 10) {
    return new Date(`${dateString}T00:00:00`);
  }
  return new Date(dateString);
};

export default function Dashboard({
  productos = [],
  ventas = [],
  gastos = [],
  cotizaciones = [],
}) {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("7d");
  const [menuPeriodosAbierto, setMenuPeriodosAbierto] = useState(false);

  const configuracionEmpresa = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("configuracion_empresa") || "{}"
      );
    } catch {
      return {};
    }
  }, []);

  const now = useMemo(() => new Date(), []);
  const mesActual = now.getMonth();
  const anoActual = now.getFullYear();

  const periodoActual = useMemo(() => {
    return PERIODOS.find((p) => p.id === periodoSeleccionado) || PERIODOS[0];
  }, [periodoSeleccionado]);

  // Filtrado de Ventas y Gastos del mes actual (Memorizados)
  const { ventasMes, gastosMes } = useMemo(() => {
    return {
      ventasMes: ventas.filter((venta) => {
        const fecha = parsearFechaLocal(venta.fecha);
        return fecha.getMonth() === mesActual && fecha.getFullYear() === anoActual;
      }),
      gastosMes: gastos.filter((gasto) => {
        const fecha = parsearFechaLocal(gasto.fecha);
        return fecha.getMonth() === mesActual && fecha.getFullYear() === anoActual;
      }),
    };
  }, [ventas, gastos, mesActual, anoActual]);

  // Cálculos financieros del mes (Memorizados)
  const metricasMes = useMemo(() => {
    const ingresos = ventasMes.reduce(
      (total, venta) => total + Number(venta.total || 0),
      0
    );

    const costoVentas = ventasMes.reduce(
      (total, venta) =>
        total + Number(venta.costo_unitario || 0) * Number(venta.cantidad || 0),
      0
    );

    const gastosTotales = gastosMes.reduce(
      (total, gasto) => total + Number(gasto.monto || 0),
      0
    );

    const gananciaBruta = ingresos - costoVentas;
    const gananciaNeta = gananciaBruta - gastosTotales;

    return { ingresos, gananciaBruta, gastosTotales, gananciaNeta };
  }, [ventasMes, gastosMes]);

  // Generación de rangos de días para el gráfico (Memorizado)
  const chartData = useMemo(() => {
    const dias = [];
    for (let i = periodoActual.dias - 1; i >= 0; i--) {
      const fecha = new Date();
      fecha.setHours(0, 0, 0, 0);
      fecha.setDate(fecha.getDate() - i);
      dias.push(fecha);
    }

    return dias.map((dia) => {
      const ventasDia = ventas.filter((venta) => {
        const fechaVenta = parsearFechaLocal(venta.fecha);
        return fechaVenta.toDateString() === dia.toDateString();
      });

      const gastosDia = gastos.filter((gasto) => {
        const fechaGasto = parsearFechaLocal(gasto.fecha);
        return fechaGasto.toDateString() === dia.toDateString();
      });

      return {
        dia:
          periodoActual.dias === 7
            ? dia.toLocaleDateString("es-CL", { weekday: "short" })
            : dia.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }),
        fechaCompleta: dia.toLocaleDateString("es-CL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        ingresos: ventasDia.reduce((total, v) => total + Number(v.total || 0), 0),
        gastos: gastosDia.reduce((total, g) => total + Number(g.monto || 0), 0),
      };
    });
  }, [ventas, gastos, periodoActual]);

  // Distribución de gastos por categoría (Memorizado)
  const gastosPorCat = useMemo(() => {
    const categorias = ["Insumos", "Combustible", "Sueldos", "Mantenimiento", "Otros"];
    return categorias
      .map((categoria, index) => ({
        name: categoria,
        value: gastosMes
          .filter((gasto) => gasto.categoria === categoria)
          .reduce((total, gasto) => total + Number(gasto.monto || 0), 0),
        color: CHART_COLORS[index],
      }))
      .filter((cat) => cat.value > 0);
  }, [gastosMes]);

  // Listado de Stock Crítico (Memorizado)
  const stockCritico = useMemo(() => {
    return productos
      .filter(
        (prod) =>
          Number(prod.stock_actual) <= Number(prod.stock_minimo) &&
          prod.activo !== false
      )
      .sort((a, b) => {
        const stockA = Number(a.stock_actual || 0);
        const stockB = Number(b.stock_actual || 0);

        if (stockA !== stockB) return stockA - stockB;

        const urgenciaA = Number(a.stock_minimo || 0) - stockA;
        const urgenciaB = Number(b.stock_minimo || 0) - stockB;
        return urgenciaB - urgenciaA;
      });
  }, [productos]);

  const hayMovimientos = useMemo(() => {
    return chartData.some((dia) => dia.ingresos > 0 || dia.gastos > 0);
  }, [chartData]);

  // Lista consolidada de actividad reciente (Memorizada)
  const actividadReciente = useMemo(() => {
    return [
      ...ventas.map((venta) => ({
        id: `venta-${venta.id}`,
        tipo: "venta",
        fecha: venta.fecha,
        titulo: "Venta realizada",
        detalle: venta.nombre_producto || "Producto sin nombre",
        monto: Number(venta.total || 0),
        cliente: venta.cliente || "Cliente no registrado",
      })),
      ...cotizaciones.map((cotizacion) => ({
        id: `cotizacion-${cotizacion.id}`,
        tipo: cotizacion.convertida_en_venta ? "conversion" : "cotizacion",
        fecha:
          cotizacion.fecha_conversion ||
          cotizacion.fecha_actualizacion ||
          cotizacion.fecha,
        titulo: cotizacion.convertida_en_venta
          ? "Cotización convertida"
          : "Cotización guardada",
        detalle: `Cotización N° ${String(cotizacion.numero || 0).padStart(4, "0")}`,
        monto: Number(cotizacion.total || 0),
        cliente: cotizacion.nombre_cliente || "Sin cliente",
      })),
    ]
      .filter((act) => act.fecha)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 6);
  }, [ventas, cotizaciones]);

  const productoEstrella = useMemo(() => {
    const agrupados = {};

    ventasMes.forEach((venta) => {
      const nombre =
        venta.nombre_producto ||
        "Producto sin nombre";

      if (!agrupados[nombre]) {
        agrupados[nombre] = {
          nombre,
          cantidad: 0,
          total: 0,
        };
      }

      agrupados[nombre].cantidad +=
        Number(venta.cantidad || 0);

      agrupados[nombre].total +=
        Number(venta.total || 0);
    });

    return (
      Object.values(agrupados).sort(
        (a, b) =>
          b.cantidad - a.cantidad
      )[0] || null
    );
  }, [ventasMes]);

  const mejorCliente = useMemo(() => {
    const agrupados = {};

    ventasMes.forEach((venta) => {
      const nombre =
        venta.cliente?.trim() ||
        "Cliente no registrado";

      if (!agrupados[nombre]) {
        agrupados[nombre] = {
          nombre,
          total: 0,
          compras: 0,
        };
      }

      agrupados[nombre].total +=
        Number(venta.total || 0);

      agrupados[nombre].compras += 1;
    });

    return (
      Object.values(agrupados).sort(
        (a, b) =>
          b.total - a.total
      )[0] || null
    );
  }, [ventasMes]);

  const cotizacionesPendientes = useMemo(
    () =>
      cotizaciones.filter(
        (cotizacion) =>
          !cotizacion.convertida_en_venta &&
          ["Borrador", "Enviada"].includes(
            cotizacion.estado || "Borrador"
          )
      ),
    [cotizaciones]
  );

  const productosAgotados = useMemo(
    () =>
      productos.filter(
        (producto) =>
          producto.activo !== false &&
          Number(producto.stock_actual || 0) <= 0
      ),
    [productos]
  );

  const ultimaVenta = useMemo(() => {
    return [...ventas]
      .filter((venta) => venta.fecha)
      .sort(
        (a, b) =>
          new Date(b.fecha) -
          new Date(a.fecha)
      )[0];
  }, [ventas]);

  const alertasInteligentes = useMemo(() => {
    const alertas = [];

    if (productosAgotados.length > 0) {
      alertas.push({
        tipo: "urgente",
        texto: `${productosAgotados.length} producto${
          productosAgotados.length === 1 ? "" : "s"
        } sin stock`,
      });
    }

    if (stockCritico.length > 0) {
      alertas.push({
        tipo: "advertencia",
        texto: `${stockCritico.length} producto${
          stockCritico.length === 1 ? "" : "s"
        } bajo el mínimo`,
      });
    }

    if (cotizacionesPendientes.length > 0) {
      alertas.push({
        tipo: "info",
        texto: `${cotizacionesPendientes.length} cotización${
          cotizacionesPendientes.length === 1 ? "" : "es"
        } pendiente${
          cotizacionesPendientes.length === 1 ? "" : "s"
        }`,
      });
    }

    if (
      ventasMes.length === 0
    ) {
      alertas.push({
        tipo: "info",
        texto: "Aún no hay ventas registradas este mes",
      });
    }

    if (
      metricasMes.gananciaNeta < 0
    ) {
      alertas.push({
        tipo: "urgente",
        texto: "La ganancia neta del mes está en negativo",
      });
    }

    return alertas.slice(0, 4);
  }, [
    productosAgotados,
    stockCritico,
    cotizacionesPendientes,
    ventasMes,
    metricasMes.gananciaNeta,
  ]);

  const saludo = useMemo(() => {
    const hora = new Date().getHours();

    if (hora < 12) return "Buenos días";
    if (hora < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const tiempoRelativo = (fecha) => {
    const diferencia = Date.now() - new Date(fecha).getTime();
    if (!Number.isFinite(diferencia)) return "";

    const minutos = Math.max(0, Math.floor(diferencia / 60000));
    if (minutos < 1) return "Ahora";
    if (minutos < 60) return `Hace ${minutos} min`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} h`;

    const diasTranscurridos = Math.floor(horas / 24);
    return `Hace ${diasTranscurridos} día${diasTranscurridos === 1 ? "" : "s"}`;
  };

  const borrarDatosPrueba = () => {
    const confirmar = window.confirm(
      "¿Borrar todas las ventas de prueba y devolver el stock vendido?"
    );
    if (!confirmar) return;

    try {
      const ventasGuardadas = JSON.parse(localStorage.getItem("ventas") || "[]");
      const inventarioGuardado = JSON.parse(localStorage.getItem("inventario") || "[]");

      const inventarioRestaurado = inventarioGuardado.map((producto) => {
        const cantidadVendida = ventasGuardadas
          .filter((venta) => String(venta.producto_id) === String(producto.id))
          .reduce((total, venta) => total + Number(venta.cantidad || 0), 0);

        return {
          ...producto,
          stock_actual: Number(producto.stock_actual || 0) + cantidadVendida,
        };
      });

      localStorage.setItem("inventario", JSON.stringify(inventarioRestaurado));
      localStorage.setItem("ventas", JSON.stringify([]));
      window.location.reload();
    } catch (error) {
      console.error("No se pudieron borrar las ventas de prueba:", error);
      window.alert("Ocurrió un error al borrar las ventas de prueba.");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-sm text-primary font-medium">
            {saludo}
          </p>

          <h1 className="text-2xl md:text-3xl font-bold font-heading mt-1">
            {configuracionEmpresa.nombre ||
              "Maderas M&M"}
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Resumen de{" "}
            {now.toLocaleDateString("es-CL", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Última venta
            </p>

            <p className="text-sm font-medium">
              {ultimaVenta
                ? tiempoRelativo(ultimaVenta.fecha)
                : "Sin ventas todavía"}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen ejecutivo */}
      <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card">
        <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">
                Resumen ejecutivo
              </h2>
            </div>

            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              En un vistazo: ventas, inventario y cotizaciones que requieren atención.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Ventas del mes
                </p>
                <p className="font-bold mt-1">
                  {ventasMes.length}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Cotizaciones
                </p>
                <p className="font-bold mt-1">
                  {cotizacionesPendientes.length}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Stock crítico
                </p>
                <p className="font-bold mt-1">
                  {stockCritico.length}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Sin stock
                </p>
                <p className="font-bold mt-1">
                  {productosAgotados.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/35 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Atención
            </p>

            {alertasInteligentes.length > 0 ? (
              <div className="space-y-2 mt-3">
                {alertasInteligentes.map((alerta, index) => (
                  <div
                    key={`${alerta.texto}-${index}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        alerta.tipo === "urgente"
                          ? "bg-red-500"
                          : alerta.tipo === "advertencia"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                    />

                    <span>{alerta.texto}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-emerald-400">
                Todo se ve en orden por ahora.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          icon={TrendingUp}
          label="Ingresos del mes"
          value={fmtMoney(metricasMes.ingresos)}
          accent="primary"
        />
        <StatCard
          icon={Banknote}
          label="Ganancia bruta"
          value={fmtMoney(metricasMes.gananciaBruta)}
          accent="green"
        />
        <StatCard
          icon={Wallet}
          label="Gastos del mes"
          value={fmtMoney(metricasMes.gastosTotales)}
          accent="red"
        />
        <StatCard
          icon={Banknote}
          label="Ganancia neta"
          value={fmtMoney(metricasMes.gananciaNeta)}
          accent={metricasMes.gananciaNeta >= 0 ? "green" : "red"}
        />
      </div>

      {/* Producto estrella y mejor cliente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 bg-card border-border">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                Producto estrella del mes
              </p>

              <p className="font-semibold text-lg mt-1 truncate">
                {productoEstrella?.nombre ||
                  "Aún sin ventas"}
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                <span className="text-muted-foreground">
                  Unidades:{" "}
                  <strong className="text-foreground">
                    {productoEstrella?.cantidad || 0}
                  </strong>
                </span>

                <span className="text-muted-foreground">
                  Ventas:{" "}
                  <strong className="text-primary">
                    {fmtMoney(
                      productoEstrella?.total || 0
                    )}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-violet-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                Mejor cliente del mes
              </p>

              <p className="font-semibold text-lg mt-1 truncate">
                {mejorCliente?.nombre ||
                  "Aún sin clientes"}
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                <span className="text-muted-foreground">
                  Compras:{" "}
                  <strong className="text-foreground">
                    {mejorCliente?.compras || 0}
                  </strong>
                </span>

                <span className="text-muted-foreground">
                  Total:{" "}
                  <strong className="text-primary">
                    {fmtMoney(
                      mejorCliente?.total || 0
                    )}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 bg-card border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="font-semibold">Ingresos vs Gastos</h3>

            <div className="relative">
              {menuPeriodosAbierto && (
                <div className="absolute right-0 bottom-full mb-2 z-20 min-w-[140px] rounded-xl border border-border bg-card p-1.5 shadow-xl">
                  {PERIODOS.map((periodo) => (
                    <button
                      key={periodo.id}
                      type="button"
                      onClick={() => {
                        setPeriodoSeleccionado(periodo.id);
                        setMenuPeriodosAbierto(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                        periodoSeleccionado === periodo.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {periodo.nombre}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setMenuPeriodosAbierto((abierto) => !abierto)}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
              >
                {periodoActual.nombre}
                {menuPeriodosAbierto ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {hayMovimientos ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30,8%,22%)" />
                <XAxis
                  dataKey="dia"
                  stroke="hsl(36,10%,55%)"
                  fontSize={12}
                  interval={
                    periodoActual.dias === 30
                      ? 4
                      : periodoActual.dias === 14
                      ? 1
                      : 0
                  }
                />
                <YAxis
                  stroke="hsl(36,10%,55%)"
                  fontSize={12}
                  tickFormatter={(value) => "$" + (value / 1000).toFixed(0) + "k"}
                />
                <Tooltip
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.fechaCompleta || ""
                  }
                  contentStyle={{
                    background: "hsl(20,8%,12%)",
                    border: "1px solid hsl(30,8%,22%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => fmtMoney(value)}
                />
                <Legend />
                <Bar
                  dataKey="ingresos"
                  name="Ingresos"
                  fill="hsl(36,38%,62%)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="gastos"
                  name="Gastos"
                  fill="hsl(0,72%,51%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground text-sm text-center">
              <p>Aún no existen movimientos para mostrar.</p>
              <p className="text-xs mt-1">
                Período seleccionado: {periodoActual.nombre}
              </p>
            </div>
          )}
        </Card>

        <Card className="p-5 bg-card border-border">
          <h3 className="font-semibold mb-4">Gastos por categoría</h3>

          {gastosPorCat.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={gastosPorCat}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => entry.name}
                >
                  {gastosPorCat.map((categoria, index) => (
                    <Cell
                      key={`${categoria.name}-${index}`}
                      fill={categoria.color}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(20,8%,12%)",
                    border: "1px solid hsl(30,8%,22%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => fmtMoney(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
              Sin gastos este mes
            </div>
          )}
        </Card>
      </div>

      {/* Stock crítico */}
      <Card className="p-5 bg-card border-border mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="font-semibold">Stock crítico</h3>
          <span className="ml-auto text-sm text-muted-foreground">
            {stockCritico.length} producto(s)
          </span>
        </div>

        {stockCritico.length === 0 ? (
          <div className="py-6 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="font-medium text-emerald-400">
              Todo el inventario está en niveles saludables
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              No hay productos con stock crítico.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stockCritico.map((producto) => (
              <div
                key={producto.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20"
              >
                <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{producto.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {producto.categoria}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-destructive font-bold text-sm">
                    {producto.stock_actual} {producto.unidad_medida?.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    mín: {producto.stock_minimo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actividad reciente */}
      <Card className="p-5 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <Clock3 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Actividad reciente</h3>
        </div>

        {actividadReciente.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">
            Todavía no hay actividad para mostrar.
          </p>
        ) : (
          <div className="space-y-2">
            {actividadReciente.map((actividad) => {
              const Icono =
                actividad.tipo === "venta" ? ShoppingCart : FileText;

              return (
                <div
                  key={actividad.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      actividad.tipo === "venta"
                        ? "bg-emerald-500/10"
                        : "bg-primary/10"
                    }`}
                  >
                    <Icono
                      className={`w-5 h-5 ${
                        actividad.tipo === "venta"
                          ? "text-emerald-500"
                          : "text-primary"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{actividad.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {actividad.detalle}
                      {" · "}
                      {actividad.cliente}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">
                      {fmtMoney(actividad.monto)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tiempoRelativo(actividad.fecha)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}