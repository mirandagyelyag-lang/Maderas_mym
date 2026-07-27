import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Users,
  CreditCard,
  Download,
  CalendarDays,
  Trophy,
  Crown,
  Receipt,
  ShoppingBag,
  Scale,
  ChartNoAxesCombined,
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

import {
  fmtMoney,
  fmtDate,
} from "@/lib/format";
import {
  getProductosLocalesRespaldo,
  getProductosRemotos,
  subscribeInventario,
} from "@/lib/inventoryRepository";
import {
  getVentasLocalesRespaldo,
  getVentasRemotas,
  subscribeVentas,
} from "@/lib/salesRepository";
import {
  getGastosLocalesRespaldo,
  getGastosRemotos,
  subscribeGastos,
} from "@/lib/expenseRepository";
import {
  getComprasLocalesRespaldo,
  getComprasRemotas,
  subscribeCompras,
} from "@/lib/purchasingRepository";
import {
  getCierresCajaLocalesRespaldo,
  getCierresCajaRemotos,
  subscribeCaja,
} from "@/lib/cashRepository";

const COLORES = [
  "hsl(36,38%,62%)",
  "hsl(142,60%,45%)",
  "hsl(197,52%,55%)",
  "hsl(0,72%,51%)",
  "hsl(280,55%,65%)",
];

const PERIODOS = [
  { id: "7d", nombre: "Últimos 7 días", dias: 7 },
  { id: "30d", nombre: "Últimos 30 días", dias: 30 },
  { id: "mes", nombre: "Este mes" },
  { id: "ano", nombre: "Este año" },
  { id: "todo", nombre: "Todo" },
];

const parsearFecha = (valor) => {
  if (!valor) return new Date(0);

  if (
    typeof valor === "string" &&
    valor.length === 10
  ) {
    return new Date(`${valor}T12:00:00`);
  }

  return new Date(valor);
};

const estaEnPeriodo = (fecha, periodo) => {
  const actual = new Date();
  const valor = parsearFecha(fecha);

  if (periodo === "todo") return true;

  if (periodo === "mes") {
    return (
      valor.getMonth() === actual.getMonth() &&
      valor.getFullYear() === actual.getFullYear()
    );
  }

  if (periodo === "ano") {
    return valor.getFullYear() === actual.getFullYear();
  }

  const dias =
    periodo === "7d" ? 7 : 30;

  const limite = new Date();
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - (dias - 1));

  return valor >= limite;
};

export default function Reportes({
  productos: productosIniciales = [],
  ventas: ventasIniciales = [],
  gastos: gastosIniciales = [],
}) {
  const [periodo, setPeriodo] =
    useState("30d");

  const [productos, setProductos] =
    useState(() =>
      productosIniciales.length > 0
        ? productosIniciales
        : getProductosLocalesRespaldo()
    );

  const [ventas, setVentas] =
    useState(() =>
      ventasIniciales.length > 0
        ? ventasIniciales
        : getVentasLocalesRespaldo()
    );

  const [gastos, setGastos] =
    useState(() =>
      gastosIniciales.length > 0
        ? gastosIniciales
        : getGastosLocalesRespaldo()
    );

  const [compras, setCompras] =
    useState(
      getComprasLocalesRespaldo
    );

  const [
    cierresCaja,
    setCierresCaja,
  ] = useState(
    getCierresCajaLocalesRespaldo
  );

  const [
    errorSincronizacion,
    setErrorSincronizacion,
  ] = useState("");

  useEffect(() => {
    let activo = true;

    const cargarDatos = async () => {
      try {
        const [
          productosRemotos,
          ventasRemotas,
          gastosRemotos,
          comprasRemotas,
          cierresRemotos,
        ] = await Promise.all([
          getProductosRemotos(),
          getVentasRemotas(),
          getGastosRemotos(),
          getComprasRemotas(),
          getCierresCajaRemotos(),
        ]);

        if (!activo) return;

        setProductos(productosRemotos);
        setVentas(ventasRemotas);
        setGastos(gastosRemotos);
        setCompras(comprasRemotas);
        setCierresCaja(cierresRemotos);
        setErrorSincronizacion("");
      } catch (error) {
        console.error(
          "No se pudieron cargar los reportes:",
          error
        );

        if (!activo) return;

        setProductos(
          productosIniciales.length > 0
            ? productosIniciales
            : getProductosLocalesRespaldo()
        );
        setVentas(
          ventasIniciales.length > 0
            ? ventasIniciales
            : getVentasLocalesRespaldo()
        );
        setGastos(
          gastosIniciales.length > 0
            ? gastosIniciales
            : getGastosLocalesRespaldo()
        );
        setCompras(
          getComprasLocalesRespaldo()
        );
        setCierresCaja(
          getCierresCajaLocalesRespaldo()
        );
        setErrorSincronizacion(
          "No se pudo sincronizar el reporte con Supabase. Se muestran temporalmente los datos guardados en este equipo."
        );
      }
    };

    cargarDatos();

    const cancelarInventario =
      subscribeInventario(cargarDatos);
    const cancelarVentas =
      subscribeVentas(cargarDatos);
    const cancelarGastos =
      subscribeGastos(cargarDatos);
    const cancelarCompras =
      subscribeCompras(cargarDatos);
    const cancelarCaja =
      subscribeCaja(cargarDatos);

    return () => {
      activo = false;
      cancelarInventario();
      cancelarVentas();
      cancelarGastos();
      cancelarCompras();
      cancelarCaja();
    };
  }, []);

  const ventasPeriodo = useMemo(
    () =>
      ventas.filter((venta) =>
        estaEnPeriodo(venta.fecha, periodo)
      ),
    [ventas, periodo]
  );

  const gastosPeriodo = useMemo(
    () =>
      gastos.filter((gasto) =>
        estaEnPeriodo(gasto.fecha, periodo)
      ),
    [gastos, periodo]
  );

  const comprasPeriodo = useMemo(
    () =>
      compras.filter((compra) =>
        estaEnPeriodo(compra.fecha, periodo)
      ),
    [compras, periodo]
  );

  const cierresPeriodo = useMemo(
    () =>
      cierresCaja.filter((cierre) =>
        estaEnPeriodo(
          cierre.fecha_cierre,
          periodo
        )
      ),
    [cierresCaja, periodo]
  );

  const metricas = useMemo(() => {
    const ingresos = ventasPeriodo.reduce(
      (total, venta) =>
        total + Number(venta.total || 0),
      0
    );

    const costoVentas = ventasPeriodo.reduce(
      (total, venta) =>
        total +
        Number(
          venta.costo_unitario || 0
        ) *
          Number(venta.cantidad || 0),
      0
    );

    const gastosTotales = gastosPeriodo.reduce(
      (total, gasto) =>
        total + Number(gasto.monto || 0),
      0
    );

    const comprasTotales = comprasPeriodo.reduce(
      (total, compra) =>
        total + Number(compra.total || 0),
      0
    );

    const utilidadBruta =
      ingresos - costoVentas;

    const utilidadNeta =
      utilidadBruta - gastosTotales;

    const unidadesVendidas =
      ventasPeriodo.reduce(
        (total, venta) =>
          total +
          Number(venta.cantidad || 0),
        0
      );

    return {
      ingresos,
      costoVentas,
      gastosTotales,
      comprasTotales,
      utilidadBruta,
      utilidadNeta,
      unidadesVendidas,
    };
  }, [
    ventasPeriodo,
    gastosPeriodo,
    comprasPeriodo,
  ]);

  const ventasPorMetodo = useMemo(() => {
    const agrupadas = {};

    ventasPeriodo.forEach((venta) => {
      const metodo =
        venta.metodo_pago ||
        "Sin especificar";

      agrupadas[metodo] =
        (agrupadas[metodo] || 0) +
        Number(venta.total || 0);
    });

    return Object.entries(agrupadas)
      .map(([name, value], index) => ({
        name,
        value,
        color:
          COLORES[index % COLORES.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [ventasPeriodo]);

  const productosMasVendidos = useMemo(() => {
    const agrupados = {};

    ventasPeriodo.forEach((venta) => {
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

    return Object.values(agrupados)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);
  }, [ventasPeriodo]);

  const mejoresClientes = useMemo(() => {
    const agrupados = {};

    ventasPeriodo.forEach((venta) => {
      const nombre =
        venta.cliente?.trim() ||
        "Cliente no registrado";

      if (!agrupados[nombre]) {
        agrupados[nombre] = {
          nombre,
          compras: 0,
          total: 0,
        };
      }

      agrupados[nombre].compras += 1;
      agrupados[nombre].total +=
        Number(venta.total || 0);
    });

    return Object.values(agrupados)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [ventasPeriodo]);

  const evolucion = useMemo(() => {
    const dias =
      periodo === "7d"
        ? 7
        : periodo === "30d"
        ? 30
        : 12;

    if (
      periodo === "mes" ||
      periodo === "ano" ||
      periodo === "todo"
    ) {
      const meses = [];

      for (let i = dias - 1; i >= 0; i--) {
        const fecha = new Date();
        fecha.setDate(1);
        fecha.setMonth(fecha.getMonth() - i);

        const mes = fecha.getMonth();
        const ano = fecha.getFullYear();

        meses.push({
          etiqueta: fecha.toLocaleDateString(
            "es-CL",
            {
              month: "short",
              year: "2-digit",
            }
          ),
          ingresos: ventas
            .filter((venta) => {
              const f = parsearFecha(venta.fecha);

              return (
                f.getMonth() === mes &&
                f.getFullYear() === ano
              );
            })
            .reduce(
              (total, venta) =>
                total +
                Number(venta.total || 0),
              0
            ),
          gastos: gastos
            .filter((gasto) => {
              const f = parsearFecha(gasto.fecha);

              return (
                f.getMonth() === mes &&
                f.getFullYear() === ano
              );
            })
            .reduce(
              (total, gasto) =>
                total +
                Number(gasto.monto || 0),
              0
            ),
        });
      }

      return meses;
    }

    const resultado = [];

    for (let i = dias - 1; i >= 0; i--) {
      const fecha = new Date();
      fecha.setHours(0, 0, 0, 0);
      fecha.setDate(fecha.getDate() - i);

      resultado.push({
        etiqueta: fecha.toLocaleDateString(
          "es-CL",
          {
            day: "2-digit",
            month: "2-digit",
          }
        ),
        ingresos: ventasPeriodo
          .filter(
            (venta) =>
              parsearFecha(
                venta.fecha
              ).toDateString() ===
              fecha.toDateString()
          )
          .reduce(
            (total, venta) =>
              total +
              Number(venta.total || 0),
            0
          ),
        gastos: gastosPeriodo
          .filter(
            (gasto) =>
              parsearFecha(
                gasto.fecha
              ).toDateString() ===
              fecha.toDateString()
          )
          .reduce(
            (total, gasto) =>
              total +
              Number(gasto.monto || 0),
            0
          ),
      });
    }

    return resultado;
  }, [
    periodo,
    ventas,
    gastos,
    ventasPeriodo,
    gastosPeriodo,
  ]);

  const stockCritico = useMemo(
    () =>
      productos.filter(
        (producto) =>
          producto.activo !== false &&
          Number(
            producto.stock_actual || 0
          ) <=
            Number(
              producto.stock_minimo || 0
            )
      ),
    [productos]
  );

  const diferenciasCaja = useMemo(
    () =>
      cierresPeriodo.reduce(
        (total, cierre) =>
          total +
          Number(cierre.diferencia || 0),
        0
      ),
    [cierresPeriodo]
  );

  const exportarCSV = () => {
    const filas = [
      [
        "Fecha",
        "Tipo",
        "Descripción",
        "Método",
        "Cantidad",
        "Monto",
      ],
      ...ventasPeriodo.map((venta) => [
        fmtDate(venta.fecha),
        "Venta",
        venta.nombre_producto ||
          "Producto",
        venta.metodo_pago || "",
        venta.cantidad || 0,
        venta.total || 0,
      ]),
      ...gastosPeriodo.map((gasto) => [
        fmtDate(gasto.fecha),
        "Gasto",
        gasto.concepto || "",
        gasto.metodo_pago || "",
        1,
        -(Number(gasto.monto || 0)),
      ]),
      ...comprasPeriodo.map((compra) => [
        fmtDate(compra.fecha),
        "Compra",
        compra.proveedor_nombre ||
          "Proveedor",
        "",
        compra.items?.reduce(
          (total, item) =>
            total +
            Number(item.cantidad || 0),
          0
        ) || 0,
        -(Number(compra.total || 0)),
      ]),
    ];

    const contenido = filas
      .map((fila) =>
        fila
          .map(
            (valor) =>
              `"${String(valor ?? "").replace(
                /"/g,
                '""'
              )}"`
          )
          .join(";")
      )
      .join("\n");

    const blob = new Blob(
      ["\ufeff", contenido],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const enlace =
      document.createElement("a");

    enlace.href = url;
    enlace.download = `reporte-${periodo}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    enlace.click();

    URL.revokeObjectURL(url);
  };

  const productoEstrella =
    productosMasVendidos[0];

  const clienteEstrella =
    mejoresClientes[0];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-sm text-primary font-medium">
            Inteligencia del negocio
          </p>

          <h1 className="text-3xl font-bold mt-1">
            Reportes
          </h1>

          <p className="text-muted-foreground mt-1">
            Ventas, gastos, utilidad y rendimiento
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={periodo}
            onChange={(event) =>
              setPeriodo(event.target.value)
            }
            className="h-11 rounded-xl border border-input bg-background px-4 text-sm"
          >
            {PERIODOS.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.nombre}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={exportarCSV}
            className="h-11"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {errorSincronizacion && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {errorSincronizacion}
        </div>
      )}

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card">
        <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6">
          <div>
            <div className="flex items-center gap-2">
              <ChartNoAxesCombined className="w-5 h-5 text-primary" />

              <h2 className="font-semibold">
                Resultado del período
              </h2>
            </div>

            <p className="text-sm text-muted-foreground mt-2">
              Utilidad neta después de costos y gastos.
            </p>

            <p
              className={`text-4xl md:text-5xl font-bold mt-5 ${
                metricas.utilidadNeta >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {fmtMoney(
                metricas.utilidadNeta
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background/35 p-4 space-y-3">
            <LineaResumen
              label="Ingresos"
              valor={metricas.ingresos}
            />

            <LineaResumen
              label="Costo de ventas"
              valor={metricas.costoVentas}
              negativo
            />

            <LineaResumen
              label="Gastos"
              valor={metricas.gastosTotales}
              negativo
            />

            <div className="pt-3 border-t border-border">
              <LineaResumen
                label="Margen neto"
                valor={
                  metricas.ingresos > 0
                    ? (metricas.utilidadNeta /
                        metricas.ingresos) *
                      100
                    : 0
                }
                porcentaje
                destacado
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <MetricaCard
          icon={TrendingUp}
          titulo="Ingresos"
          valor={fmtMoney(metricas.ingresos)}
          subtitulo={`${ventasPeriodo.length} venta(s)`}
          clase="bg-emerald-500/10 text-emerald-400"
        />

        <MetricaCard
          icon={Wallet}
          titulo="Gastos"
          valor={fmtMoney(metricas.gastosTotales)}
          subtitulo={`${gastosPeriodo.length} registro(s)`}
          clase="bg-red-500/10 text-red-400"
        />

        <MetricaCard
          icon={ShoppingBag}
          titulo="Compras"
          valor={fmtMoney(metricas.comprasTotales)}
          subtitulo={`${comprasPeriodo.length} compra(s)`}
          clase="bg-primary/10 text-primary"
        />

        <MetricaCard
          icon={Package}
          titulo="Unidades vendidas"
          valor={metricas.unidadesVendidas}
          subtitulo={`${stockCritico.length} en stock crítico`}
          clase="bg-blue-500/10 text-blue-400"
        />
      </div>

      <Card className="p-5 bg-card border-border">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />

            <div>
              <h3 className="font-semibold">
                Stock crítico
              </h3>

              <p className="text-xs text-muted-foreground mt-0.5">
                Productos con existencias iguales o inferiores a su mínimo
              </p>
            </div>
          </div>

          <span className="min-w-9 h-9 px-3 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-sm font-bold">
            {stockCritico.length}
          </span>
        </div>

        {stockCritico.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {stockCritico.map((producto) => (
              <div
                key={producto.id}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
              >
                <p className="font-medium truncate">
                  {producto.nombre ||
                    "Producto sin nombre"}
                </p>

                <div className="flex items-center justify-between gap-3 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    Stock actual
                  </span>

                  <span className="font-bold text-amber-400">
                    {Number(
                      producto.stock_actual ||
                        0
                    )}{" "}
                    / mín.{" "}
                    {Number(
                      producto.stock_minimo ||
                        0
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/15 py-8 text-center text-sm text-muted-foreground">
            No hay productos con stock crítico
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />

            <h3 className="font-semibold">
              Ingresos vs gastos
            </h3>
          </div>

          <ResponsiveContainer
            width="100%"
            height={290}
          >
            <BarChart data={evolucion}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(30,8%,22%)"
              />

              <XAxis
                dataKey="etiqueta"
                stroke="hsl(36,10%,55%)"
                fontSize={11}
                interval={
                  evolucion.length > 14
                    ? 3
                    : 0
                }
              />

              <YAxis
                stroke="hsl(36,10%,55%)"
                fontSize={11}
                tickFormatter={(value) =>
                  `$${Math.round(
                    value / 1000
                  )}k`
                }
              />

              <Tooltip
                contentStyle={{
                  background:
                    "hsl(20,8%,12%)",
                  border:
                    "1px solid hsl(30,8%,22%)",
                  borderRadius: "10px",
                }}
                formatter={(value) =>
                  fmtMoney(value)
                }
              />

              <Legend />

              <Bar
                dataKey="ingresos"
                name="Ingresos"
                fill="hsl(36,38%,62%)"
                radius={[5, 5, 0, 0]}
              />

              <Bar
                dataKey="gastos"
                name="Gastos"
                fill="hsl(0,72%,51%)"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />

            <h3 className="font-semibold">
              Ventas por método de pago
            </h3>
          </div>

          {ventasPorMetodo.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={290}
            >
              <PieChart>
                <Pie
                  data={ventasPorMetodo}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                >
                  {ventasPorMetodo.map(
                    (item) => (
                      <Cell
                        key={item.name}
                        fill={item.color}
                      />
                    )
                  )}
                </Pie>

                <Tooltip
                  contentStyle={{
                    background:
                      "hsl(20,8%,12%)",
                    border:
                      "1px solid hsl(30,8%,22%)",
                    borderRadius: "10px",
                  }}
                  formatter={(value) =>
                    fmtMoney(value)
                  }
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[290px] flex items-center justify-center text-sm text-muted-foreground">
              No hay ventas en este período
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard
          icon={Trophy}
          titulo="Productos más vendidos"
          items={productosMasVendidos}
          renderPrincipal={(item) =>
            item.nombre
          }
          renderSecundario={(item) =>
            `${item.cantidad} unidad(es)`
          }
          renderValor={(item) =>
            fmtMoney(item.total)
          }
          vacio="No hay productos vendidos"
        />

        <RankingCard
          icon={Crown}
          titulo="Clientes que más compran"
          items={mejoresClientes}
          renderPrincipal={(item) =>
            item.nombre
          }
          renderSecundario={(item) =>
            `${item.compras} compra(s)`
          }
          renderValor={(item) =>
            fmtMoney(item.total)
          }
          vacio="No hay clientes para mostrar"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResumenSimple
          icon={Scale}
          titulo="Diferencias de caja"
          valor={fmtMoney(
            diferenciasCaja
          )}
          subtitulo={`${cierresPeriodo.length} cierre(s)`}
          positivo={
            diferenciasCaja === 0
          }
        />

        <ResumenSimple
          icon={Receipt}
          titulo="Ticket promedio"
          valor={fmtMoney(
            ventasPeriodo.length > 0
              ? metricas.ingresos /
                  ventasPeriodo.length
              : 0
          )}
          subtitulo="Promedio por venta"
        />

        <ResumenSimple
          icon={Users}
          titulo="Clientes únicos"
          valor={
            new Set(
              ventasPeriodo
                .map((venta) =>
                  venta.cliente?.trim()
                )
                .filter(Boolean)
            ).size
          }
          subtitulo="Con compra registrada"
        />
      </div>
    </div>
  );
}

function MetricaCard({
  icon: Icon,
  titulo,
  valor,
  subtitulo,
  clase,
}) {
  return (
    <Card className="p-5 bg-card border-border">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${clase}`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        {titulo}
      </p>

      <p className="text-xl md:text-2xl font-bold mt-1">
        {valor}
      </p>

      <p className="text-[11px] text-muted-foreground mt-1">
        {subtitulo}
      </p>
    </Card>
  );
}

function LineaResumen({
  label,
  valor,
  negativo = false,
  porcentaje = false,
  destacado = false,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          destacado
            ? "font-semibold"
            : "text-sm text-muted-foreground"
        }
      >
        {label}
      </span>

      <span
        className={`font-bold ${
          negativo
            ? "text-red-400"
            : destacado
            ? valor >= 0
              ? "text-emerald-400"
              : "text-red-400"
            : ""
        }`}
      >
        {negativo ? "-" : ""}
        {porcentaje
          ? `${Number(valor || 0).toFixed(
              1
            )}%`
          : fmtMoney(
              Math.abs(valor)
            )}
      </span>
    </div>
  );
}

function RankingCard({
  icon: Icon,
  titulo,
  items,
  renderPrincipal,
  renderSecundario,
  renderValor,
  vacio,
}) {
  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-primary" />

        <h3 className="font-semibold">
          {titulo}
        </h3>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={`${renderPrincipal(
                item
              )}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/15 px-3 py-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {renderPrincipal(item)}
                </p>

                <p className="text-xs text-muted-foreground mt-0.5">
                  {renderSecundario(item)}
                </p>
              </div>

              <p className="font-semibold text-primary shrink-0">
                {renderValor(item)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {vacio}
        </div>
      )}
    </Card>
  );
}

function ResumenSimple({
  icon: Icon,
  titulo,
  valor,
  subtitulo,
  positivo = false,
}) {
  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {titulo}
          </p>

          <p
            className={`text-xl font-bold mt-1 ${
              positivo
                ? "text-emerald-400"
                : ""
            }`}
          >
            {valor}
          </p>

          <p className="text-[11px] text-muted-foreground mt-1">
            {subtitulo}
          </p>
        </div>
      </div>
    </Card>
  );
}