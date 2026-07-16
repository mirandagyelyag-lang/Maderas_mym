import React, {
  useMemo,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  ShoppingCart,
  Search,
  RotateCcw,
  Eye,
  Download,
  ReceiptText,
  TrendingUp,
  Calculator,
  Wallet,
  UserRound,
  CreditCard,
  Package,
  CalendarDays,
  X,
} from "lucide-react";

import {
  fmtMoney,
  fmtDateTime,
} from "@/lib/format";

import {
  TIPOS_MOVIMIENTO,
  registrarMovimientoInventario,
} from "@/lib/inventoryMovements";

const pagoColors = {
  Efectivo:
    "bg-emerald-500/10 text-emerald-500",
  Transferencia:
    "bg-blue-500/10 text-blue-500",
  Tarjeta:
    "bg-violet-500/10 text-violet-500",
  "Cuenta Corriente":
    "bg-amber-500/10 text-amber-500",
  Cotización:
    "bg-cyan-500/10 text-cyan-500",
};

const metodosPago = [
  "Todos",
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Cuenta Corriente",
  "Cotización",
];

const periodos = [
  {
    id: "hoy",
    nombre: "Hoy",
  },
  {
    id: "semana",
    nombre: "7 días",
  },
  {
    id: "mes",
    nombre: "Este mes",
  },
  {
    id: "anio",
    nombre: "Este año",
  },
  {
    id: "todo",
    nombre: "Todo",
  },
];

const normalizar = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

const fechaValida = (valor) => {
  const fecha = new Date(valor);

  return Number.isNaN(
    fecha.getTime()
  )
    ? null
    : fecha;
};

const escaparCSV = (valor) => {
  const texto = String(
    valor ?? ""
  );

  return `"${texto.replace(
    /"/g,
    '""'
  )}"`;
};

export default function Ventas({
  ventas = [],
  actualizarVentas,
  actualizarProductos,
}) {
  const temporizadorRef =
    useRef(null);

  const [busqueda, setBusqueda] =
    useState("");

  const [
    metodoSeleccionado,
    setMetodoSeleccionado,
  ] = useState("Todos");

  const [
    periodoSeleccionado,
    setPeriodoSeleccionado,
  ] = useState("mes");

  const [
    ventaDetalle,
    setVentaDetalle,
  ] = useState(null);

  const [
    ventaAnulada,
    setVentaAnulada,
  ] = useState(null);

  const ventasPeriodo = useMemo(
    () => {
      const ahora = new Date();

      return ventas.filter(
        (venta) => {
          const fecha =
            fechaValida(
              venta.fecha
            );

          if (!fecha) {
            return false;
          }

          if (
            periodoSeleccionado ===
            "hoy"
          ) {
            return (
              fecha.toDateString() ===
              ahora.toDateString()
            );
          }

          if (
            periodoSeleccionado ===
            "semana"
          ) {
            const limite =
              new Date(ahora);

            limite.setDate(
              ahora.getDate() - 6
            );

            limite.setHours(
              0,
              0,
              0,
              0
            );

            return fecha >= limite;
          }

          if (
            periodoSeleccionado ===
            "mes"
          ) {
            return (
              fecha.getMonth() ===
                ahora.getMonth() &&
              fecha.getFullYear() ===
                ahora.getFullYear()
            );
          }

          if (
            periodoSeleccionado ===
            "anio"
          ) {
            return (
              fecha.getFullYear() ===
              ahora.getFullYear()
            );
          }

          return true;
        }
      );
    },
    [ventas, periodoSeleccionado]
  );

  const ventasFiltradas =
    useMemo(() => {
      const texto =
        normalizar(busqueda);

      return [...ventasPeriodo]
        .filter((venta) => {
          const coincideMetodo =
            metodoSeleccionado ===
              "Todos" ||
            venta.metodo_pago ===
              metodoSeleccionado;

          const coincideBusqueda =
            !texto ||
            [
              venta.nombre_producto,
              venta.cliente,
              venta.categoria,
              venta.metodo_pago,
              venta.cotizacion_numero,
            ].some((campo) =>
              normalizar(campo).includes(
                texto
              )
            );

          return (
            coincideMetodo &&
            coincideBusqueda
          );
        })
        .sort(
          (a, b) =>
            new Date(b.fecha) -
            new Date(a.fecha)
        );
    }, [
      ventasPeriodo,
      busqueda,
      metodoSeleccionado,
    ]);

  const resumen = useMemo(() => {
    const total = ventasPeriodo.reduce(
      (acumulado, venta) =>
        acumulado +
        Number(venta.total || 0),
      0
    );

    const costo = ventasPeriodo.reduce(
      (acumulado, venta) =>
        acumulado +
        Number(
          venta.costo_unitario || 0
        ) *
          Number(
            venta.cantidad || 0
          ),
      0
    );

    const utilidad =
      total - costo;

    const promedio =
      ventasPeriodo.length > 0
        ? total /
          ventasPeriodo.length
        : 0;

    return {
      total,
      costo,
      utilidad,
      promedio,
      cantidad:
        ventasPeriodo.length,
    };
  }, [ventasPeriodo]);

  const productosMasVendidos =
    useMemo(() => {
      const agrupados = {};

      ventasPeriodo.forEach(
        (venta) => {
          const nombre =
            venta.nombre_producto ||
            "Sin nombre";

          if (!agrupados[nombre]) {
            agrupados[nombre] = {
              nombre,
              cantidad: 0,
              total: 0,
            };
          }

          agrupados[nombre].cantidad +=
            Number(
              venta.cantidad || 0
            );

          agrupados[nombre].total +=
            Number(
              venta.total || 0
            );
        }
      );

      return Object.values(
        agrupados
      )
        .sort(
          (a, b) =>
            b.cantidad -
            a.cantidad
        )
        .slice(0, 3);
    }, [ventasPeriodo]);

  const guardarVentas = (
    nuevasVentas
  ) => {
    localStorage.setItem(
      "ventas",
      JSON.stringify(nuevasVentas)
    );

    actualizarVentas?.();
  };

  const anularVenta = (
    venta
  ) => {
    try {
      if (
        temporizadorRef.current
      ) {
        window.clearTimeout(
          temporizadorRef.current
        );
      }

      const ventasGuardadas =
        JSON.parse(
          localStorage.getItem(
            "ventas"
          ) || "[]"
        );

      const inventarioGuardado =
        JSON.parse(
          localStorage.getItem(
            "inventario"
          ) || "[]"
        );

      const posicionOriginal =
        ventasGuardadas.findIndex(
          (item) =>
            String(item.id) ===
            String(venta.id)
        );

      const ventasActualizadas =
        ventasGuardadas.filter(
          (item) =>
            String(item.id) !==
            String(venta.id)
        );

      const inventarioActualizado =
        inventarioGuardado.map(
          (producto) =>
            String(producto.id) ===
            String(
              venta.producto_id
            )
              ? {
                  ...producto,
                  stock_actual:
                    Number(
                      producto.stock_actual ||
                        0
                    ) +
                    Number(
                      venta.cantidad ||
                        0
                    ),
                }
              : producto
        );

      guardarVentas(
        ventasActualizadas
      );

      localStorage.setItem(
        "inventario",
        JSON.stringify(
          inventarioActualizado
        )
      );

      registrarMovimientoInventario({
        productoId:
          venta.producto_id,
        productoNombre:
          venta.nombre_producto,
        tipo:
          TIPOS_MOVIMIENTO.DEVOLUCION,
        cantidad:
          Number(
            venta.cantidad || 0
          ),
        stockAnterior:
          Number(
            inventarioGuardado.find(
              (producto) =>
                String(
                  producto.id
                ) ===
                String(
                  venta.producto_id
                )
            )?.stock_actual || 0
          ),
        stockNuevo:
          Number(
            inventarioActualizado.find(
              (producto) =>
                String(
                  producto.id
                ) ===
                String(
                  venta.producto_id
                )
            )?.stock_actual || 0
          ),
        motivo:
          "Venta anulada",
        referenciaId:
          venta.id,
        referenciaTipo:
          "anulacion_venta",
      });

      actualizarProductos?.();

      setVentaAnulada({
        venta,
        posicionOriginal,
      });

      setVentaDetalle(null);

      temporizadorRef.current =
        window.setTimeout(() => {
          setVentaAnulada(null);
          temporizadorRef.current =
            null;
        }, 6000);
    } catch (error) {
      console.error(
        "Error al anular la venta:",
        error
      );
    }
  };

  const deshacerAnulacion =
    () => {
      if (!ventaAnulada) {
        return;
      }

      try {
        if (
          temporizadorRef.current
        ) {
          window.clearTimeout(
            temporizadorRef.current
          );

          temporizadorRef.current =
            null;
        }

        const ventasGuardadas =
          JSON.parse(
            localStorage.getItem(
              "ventas"
            ) || "[]"
          );

        const inventarioGuardado =
          JSON.parse(
            localStorage.getItem(
              "inventario"
            ) || "[]"
          );

        const ventasRestauradas = [
          ...ventasGuardadas,
        ];

        const posicion = Math.max(
          0,
          Math.min(
            ventaAnulada
              .posicionOriginal,
            ventasRestauradas.length
          )
        );

        ventasRestauradas.splice(
          posicion,
          0,
          ventaAnulada.venta
        );

        const inventarioRestaurado =
          inventarioGuardado.map(
            (producto) =>
              String(
                producto.id
              ) ===
              String(
                ventaAnulada.venta
                  .producto_id
              )
                ? {
                    ...producto,
                    stock_actual:
                      Number(
                        producto.stock_actual ||
                          0
                      ) -
                      Number(
                        ventaAnulada.venta
                          .cantidad || 0
                      ),
                  }
                : producto
          );

        guardarVentas(
          ventasRestauradas
        );

        localStorage.setItem(
          "inventario",
          JSON.stringify(
            inventarioRestaurado
          )
        );

        registrarMovimientoInventario({
          productoId:
            ventaAnulada.venta
              .producto_id,
          productoNombre:
            ventaAnulada.venta
              .nombre_producto,
          tipo:
            TIPOS_MOVIMIENTO.VENTA,
          cantidad:
            Number(
              ventaAnulada.venta
                .cantidad || 0
            ),
          stockAnterior:
            Number(
              inventarioGuardado.find(
                (producto) =>
                  String(
                    producto.id
                  ) ===
                  String(
                    ventaAnulada.venta
                      .producto_id
                  )
              )?.stock_actual || 0
            ),
          stockNuevo:
            Number(
              inventarioRestaurado.find(
                (producto) =>
                  String(
                    producto.id
                  ) ===
                  String(
                    ventaAnulada.venta
                      .producto_id
                  )
              )?.stock_actual || 0
            ),
          motivo:
            "Anulación deshecha",
          referenciaId:
            ventaAnulada.venta.id,
          referenciaTipo:
            "venta_restaurada",
        });

        actualizarProductos?.();

        setVentaAnulada(null);
      } catch (error) {
        console.error(
          "Error restaurando la venta:",
          error
        );
      }
    };

  const exportarCSV = () => {
    if (
      ventasFiltradas.length === 0
    ) {
      return;
    }

    const encabezados = [
      "Fecha",
      "Producto",
      "Categoría",
      "Cantidad",
      "Precio unitario",
      "Costo unitario",
      "Total",
      "Utilidad",
      "Método de pago",
      "Cliente",
    ];

    const filas =
      ventasFiltradas.map(
        (venta) => {
          const utilidad =
            Number(
              venta.total || 0
            ) -
            Number(
              venta.costo_unitario ||
                0
            ) *
              Number(
                venta.cantidad || 0
              );

          return [
            fmtDateTime(
              venta.fecha
            ),
            venta.nombre_producto,
            venta.categoria,
            venta.cantidad,
            venta.precio_unitario,
            venta.costo_unitario,
            venta.total,
            utilidad,
            venta.metodo_pago,
            venta.cliente,
          ]
            .map(escaparCSV)
            .join(",");
        }
      );

    const contenido = [
      encabezados
        .map(escaparCSV)
        .join(","),
      ...filas,
    ].join("\n");

    const blob = new Blob(
      [
        "\uFEFF",
        contenido,
      ],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const enlace =
      document.createElement(
        "a"
      );

    enlace.href = url;
    enlace.download = `ventas-${periodoSeleccionado}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(
      enlace
    );

    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Ventas
          </h1>

          <p className="text-muted-foreground">
            Historial, resultados y utilidad del negocio
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={exportarCSV}
          disabled={
            ventasFiltradas.length ===
            0
          }
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar ventas
        </Button>
      </div>

      {ventaAnulada && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-amber-300">
            <RotateCcw className="w-5 h-5 shrink-0" />

            <span>
              Venta de “
              {
                ventaAnulada.venta
                  .nombre_producto
              }
              ” anulada. El stock fue devuelto.
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={
              deshacerAnulacion
            }
            className="text-amber-200 hover:text-white hover:bg-amber-500/20"
          >
            Deshacer
          </Button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {periodos.map(
          (periodo) => (
            <button
              key={periodo.id}
              type="button"
              onClick={() =>
                setPeriodoSeleccionado(
                  periodo.id
                )
              }
              className={`rounded-full px-4 py-2 text-sm whitespace-nowrap transition ${
                periodoSeleccionado ===
                periodo.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodo.nombre}
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Ventas
              </p>

              <p className="text-xl font-bold">
                {fmtMoney(
                  resumen.total
                )}
              </p>

              <p className="text-[11px] text-muted-foreground mt-0.5">
                {
                  resumen.cantidad
                }{" "}
                transacción
                {resumen.cantidad ===
                1
                  ? ""
                  : "es"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Utilidad estimada
              </p>

              <p
                className={`text-xl font-bold ${
                  resumen.utilidad >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {fmtMoney(
                  resumen.utilidad
                )}
              </p>

              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ventas menos costo
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-blue-500" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Venta promedio
              </p>

              <p className="text-xl font-bold">
                {fmtMoney(
                  resumen.promedio
                )}
              </p>

              <p className="text-[11px] text-muted-foreground mt-0.5">
                Por transacción
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <ReceiptText className="w-5 h-5 text-amber-500" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Costo estimado
              </p>

              <p className="text-xl font-bold">
                {fmtMoney(
                  resumen.costo
                )}
              </p>

              <p className="text-[11px] text-muted-foreground mt-0.5">
                Costo de productos
              </p>
            </div>
          </div>
        </Card>
      </div>

      {productosMasVendidos.length >
        0 && (
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">
                Productos más vendidos
              </h2>

              <p className="text-xs text-muted-foreground mt-0.5">
                Según unidades vendidas
              </p>
            </div>

            <Package className="w-5 h-5 text-primary" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {productosMasVendidos.map(
              (producto, index) => (
                <div
                  key={
                    producto.nombre
                  }
                  className="rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {
                          producto.nombre
                        }
                      </p>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {
                          producto.cantidad
                        }{" "}
                        unidad
                        {producto.cantidad ===
                        1
                          ? ""
                          : "es"}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-primary">
                      {fmtMoney(
                        producto.total
                      )}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 bg-card border-border">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              value={busqueda}
              onChange={(event) =>
                setBusqueda(
                  event.target.value
                )
              }
              placeholder="Buscar producto, cliente o categoría..."
              className="pl-10 pr-10"
            />

            {busqueda && (
              <button
                type="button"
                onClick={() =>
                  setBusqueda("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={
              metodoSeleccionado
            }
            onChange={(event) =>
              setMetodoSeleccionado(
                event.target.value
              )
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm md:w-52"
          >
            {metodosPago.map(
              (metodo) => (
                <option
                  key={metodo}
                  value={metodo}
                >
                  {metodo === "Todos"
                    ? "Todos los pagos"
                    : metodo}
                </option>
              )
            )}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden border-border bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-semibold">
              Historial de ventas
            </h2>

            <p className="text-xs text-muted-foreground mt-0.5">
              {
                ventasFiltradas.length
              }{" "}
              resultado
              {ventasFiltradas.length ===
              1
                ? ""
                : "s"}
            </p>
          </div>

          <p className="font-bold text-primary">
            {fmtMoney(
              ventasFiltradas.reduce(
                (total, venta) =>
                  total +
                  Number(
                    venta.total || 0
                  ),
                0
              )
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                <th className="p-4 text-left font-medium">
                  Fecha
                </th>

                <th className="p-4 text-left font-medium">
                  Producto
                </th>

                <th className="p-4 text-right font-medium">
                  Cant.
                </th>

                <th className="p-4 text-right font-medium">
                  Total
                </th>

                <th className="p-4 text-left font-medium">
                  Pago
                </th>

                <th className="p-4 text-left font-medium">
                  Cliente
                </th>

                <th className="p-4 text-center font-medium">
                  Detalle
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {ventasFiltradas.length >
              0 ? (
                ventasFiltradas.map(
                  (venta) => (
                    <tr
                      key={venta.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4 text-primary font-medium whitespace-nowrap">
                        {fmtDateTime(
                          venta.fecha
                        )}
                      </td>

                      <td className="p-4">
                        <p className="font-medium">
                          {
                            venta.nombre_producto
                          }
                        </p>

                        {venta.categoria && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {
                              venta.categoria
                            }
                          </p>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {
                          venta.cantidad
                        }
                      </td>

                      <td className="p-4 text-right font-bold">
                        {fmtMoney(
                          venta.total
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            pagoColors[
                              venta.metodo_pago
                            ] ||
                            "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {venta.metodo_pago ||
                            "Sin método"}
                        </span>
                      </td>

                      <td className="p-4 text-muted-foreground">
                        {venta.cliente ||
                          "Cliente no registrado"}
                      </td>

                      <td className="p-4 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Ver detalle"
                          onClick={() =>
                            setVentaDetalle(
                              venta
                            )
                          }
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="p-16 text-center text-muted-foreground"
                  >
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />

                    <p className="text-lg font-medium">
                      {ventas.length === 0
                        ? "No hay ventas registradas"
                        : "No hay resultados"}
                    </p>

                    <p className="text-sm mt-1">
                      {ventas.length === 0
                        ? "Las ventas aparecerán aquí."
                        : "Prueba otro período, búsqueda o método de pago."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {ventaDetalle && (
        <DetalleVentaDialog
          venta={ventaDetalle}
          onClose={() =>
            setVentaDetalle(null)
          }
          onAnular={() =>
            anularVenta(
              ventaDetalle
            )
          }
        />
      )}
    </div>
  );
}

function DetalleVentaDialog({
  venta,
  onClose,
  onAnular,
}) {
  const costo =
    Number(
      venta.costo_unitario || 0
    ) *
    Number(venta.cantidad || 0);

  const utilidad =
    Number(venta.total || 0) -
    costo;

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            Detalle de venta
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold">
                {venta.nombre_producto}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                {venta.categoria ||
                  "Sin categoría"}
              </p>
            </div>

            <p className="font-bold text-primary">
              {fmtMoney(
                venta.total
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DatoDetalle
            icon={CalendarDays}
            titulo="Fecha"
            valor={fmtDateTime(
              venta.fecha
            )}
          />

          <DatoDetalle
            icon={CreditCard}
            titulo="Pago"
            valor={
              venta.metodo_pago ||
              "Sin método"
            }
          />

          <DatoDetalle
            icon={UserRound}
            titulo="Cliente"
            valor={
              venta.cliente ||
              "No registrado"
            }
          />

          <DatoDetalle
            icon={Package}
            titulo="Cantidad"
            valor={String(
              venta.cantidad || 0
            )}
          />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Precio unitario
            </span>

            <span>
              {fmtMoney(
                venta.precio_unitario
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Costo estimado
            </span>

            <span>
              {fmtMoney(costo)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
            <span className="font-medium">
              Utilidad estimada
            </span>

            <span
              className={`text-xl font-bold ${
                utilidad >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {fmtMoney(utilidad)}
            </span>
          </div>
        </div>

        {venta.cotizacion_numero && (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
            Generada desde la cotización N°{" "}
            {String(
              venta.cotizacion_numero
            ).padStart(4, "0")}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cerrar
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onAnular}
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Anular venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DatoDetalle({
  icon: Icono,
  titulo,
  valor,
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icono className="w-4 h-4" />
        {titulo}
      </div>

      <p className="font-medium text-sm mt-2 break-words">
        {valor}
      </p>
    </div>
  );
}
