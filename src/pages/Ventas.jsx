import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Package,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  fmtDateTime,
  fmtMoney,
} from "@/lib/format";

import { getVentas } from "@/lib/database";

const TODOS_LOS_METODOS = "Todos";
const TODOS_LOS_PERIODOS = "todos";

const periodos = [
  {
    id: TODOS_LOS_PERIODOS,
    nombre: "Todo el historial",
  },
  {
    id: "hoy",
    nombre: "Hoy",
  },
  {
    id: "7-dias",
    nombre: "Últimos 7 días",
  },
  {
    id: "30-dias",
    nombre: "Últimos 30 días",
  },
];

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

const numeroSeguro = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const obtenerFechaValida = (valor) => {
  const fecha = valor
    ? new Date(valor)
    : null;

  if (
    !fecha ||
    Number.isNaN(fecha.getTime())
  ) {
    return null;
  }

  return fecha;
};

const obtenerInicioDia = (fecha) => {
  const resultado = new Date(fecha);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
};

function agruparVentas(ventas) {
  const grupos = new Map();

  ventas.forEach((venta, indice) => {
    const grupoId = String(
      venta.venta_grupo_id ||
        venta.id ||
        `venta-${indice}`
    );

    if (!grupos.has(grupoId)) {
      grupos.set(grupoId, {
        id: grupoId,
        fecha: venta.fecha || "",
        cliente:
          venta.cliente?.trim?.() ||
          "Venta sin cliente",
        clienteId:
          venta.cliente_id || "",
        telefono:
          venta.telefono_cliente || "",
        email:
          venta.email_cliente || "",
        direccion:
          venta.direccion_cliente || "",
        rut:
          venta.rut_cliente || "",
        metodoPago:
          venta.metodo_pago ||
          "Sin especificar",
        observaciones:
          venta.observaciones || "",
        usuarioNombre:
          venta.usuario_nombre || "No registrado",
        usuarioRol:
          venta.usuario_rol || "",
        productos: [],
      });
    }

    const grupo = grupos.get(grupoId);

    grupo.productos.push({
      id:
        venta.id ||
        `${grupoId}-${indice}`,
      productoId:
        venta.producto_id || "",
      nombre:
        venta.nombre_producto ||
        "Producto sin nombre",
      categoria:
        venta.categoria || "",
      cantidad:
        numeroSeguro(venta.cantidad),
      precioUnitario:
        numeroSeguro(
          venta.precio_unitario
        ),
      costoUnitario:
        numeroSeguro(
          venta.costo_unitario
        ),
      total:
        numeroSeguro(venta.total) ||
        numeroSeguro(venta.cantidad) *
          numeroSeguro(
            venta.precio_unitario
          ),
    });
  });

  return Array.from(grupos.values())
    .map((grupo) => {
      const total = grupo.productos.reduce(
        (acumulado, producto) =>
          acumulado + producto.total,
        0
      );

      const costo = grupo.productos.reduce(
        (acumulado, producto) =>
          acumulado +
          producto.cantidad *
            producto.costoUnitario,
        0
      );

      const cantidadProductos =
        grupo.productos.reduce(
          (acumulado, producto) =>
            acumulado +
            producto.cantidad,
          0
        );

      return {
        ...grupo,
        total,
        costo,
        utilidad: total - costo,
        cantidadProductos,
      };
    })
    .sort((ventaA, ventaB) => {
      const fechaA =
        obtenerFechaValida(
          ventaA.fecha
        )?.getTime() || 0;

      const fechaB =
        obtenerFechaValida(
          ventaB.fecha
        )?.getTime() || 0;

      return fechaB - fechaA;
    });
}

function perteneceAlPeriodo(
  fechaValor,
  periodo
) {
  if (periodo === TODOS_LOS_PERIODOS) {
    return true;
  }

  const fecha =
    obtenerFechaValida(fechaValor);

  if (!fecha) {
    return false;
  }

  const hoy = obtenerInicioDia(
    new Date()
  );

  const fechaVenta =
    obtenerInicioDia(fecha);

  if (periodo === "hoy") {
    return (
      fechaVenta.getTime() ===
      hoy.getTime()
    );
  }

  const dias =
    periodo === "7-dias" ? 7 : 30;

  const inicio = new Date(hoy);
  inicio.setDate(
    inicio.getDate() -
      (dias - 1)
  );

  return (
    fechaVenta >= inicio &&
    fechaVenta <= hoy
  );
}

export default function Ventas() {
  const [ventas, setVentas] =
    useState(() => getVentas());

  const [busqueda, setBusqueda] =
    useState("");

  const [metodoPago, setMetodoPago] =
    useState(TODOS_LOS_METODOS);

  const [periodo, setPeriodo] =
    useState(TODOS_LOS_PERIODOS);

  const [ventaSeleccionada, setVentaSeleccionada] =
    useState(null);

  const recargarVentas = () => {
    setVentas(getVentas());
  };

  useEffect(() => {
    const manejarStorage = (event) => {
      if (
        !event.key ||
        event.key === "ventas"
      ) {
        recargarVentas();
      }
    };

    window.addEventListener(
      "storage",
      manejarStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        manejarStorage
      );
    };
  }, []);

  useEffect(() => {
    if (!ventaSeleccionada) {
      return undefined;
    }

    const manejarEscape = (event) => {
      if (event.key === "Escape") {
        setVentaSeleccionada(null);
      }
    };

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      manejarEscape
    );

    return () => {
      document.body.style.overflow =
        overflowAnterior;

      window.removeEventListener(
        "keydown",
        manejarEscape
      );
    };
  }, [ventaSeleccionada]);

  const ventasAgrupadas = useMemo(
    () => agruparVentas(ventas),
    [ventas]
  );

  const metodosDisponibles = useMemo(
    () => [
      TODOS_LOS_METODOS,
      ...Array.from(
        new Set(
          ventasAgrupadas
            .map(
              (venta) =>
                venta.metodoPago
            )
            .filter(Boolean)
        )
      ),
    ],
    [ventasAgrupadas]
  );

  const ventasFiltradas = useMemo(() => {
    const texto =
      normalizarTexto(busqueda);

    return ventasAgrupadas.filter(
      (venta) => {
        const coincideMetodo =
          metodoPago ===
            TODOS_LOS_METODOS ||
          venta.metodoPago ===
            metodoPago;

        const coincidePeriodo =
          perteneceAlPeriodo(
            venta.fecha,
            periodo
          );

        const campos = [
          venta.id,
          venta.cliente,
          venta.rut,
          venta.telefono,
          venta.metodoPago,
          ...venta.productos.map(
            (producto) =>
              producto.nombre
          ),
        ].map(normalizarTexto);

        const coincideBusqueda =
          !texto ||
          campos.some((campo) =>
            campo.includes(texto)
          );

        return (
          coincideMetodo &&
          coincidePeriodo &&
          coincideBusqueda
        );
      }
    );
  }, [
    ventasAgrupadas,
    busqueda,
    metodoPago,
    periodo,
  ]);

  const resumen = useMemo(() => {
    const totalVendido =
      ventasFiltradas.reduce(
        (acumulado, venta) =>
          acumulado + venta.total,
        0
      );

    const utilidad =
      ventasFiltradas.reduce(
        (acumulado, venta) =>
          acumulado +
          venta.utilidad,
        0
      );

    const unidades =
      ventasFiltradas.reduce(
        (acumulado, venta) =>
          acumulado +
          venta.cantidadProductos,
        0
      );

    return {
      totalVendido,
      utilidad,
      unidades,
      ticketPromedio:
        ventasFiltradas.length > 0
          ? totalVendido /
            ventasFiltradas.length
          : 0,
    };
  }, [ventasFiltradas]);

  const filtrosActivos =
    busqueda ||
    metodoPago !==
      TODOS_LOS_METODOS ||
    periodo !== TODOS_LOS_PERIODOS;

  const limpiarFiltros = () => {
    setBusqueda("");
    setMetodoPago(
      TODOS_LOS_METODOS
    );
    setPeriodo(
      TODOS_LOS_PERIODOS
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl font-bold">
              Historial de ventas
            </h1>

            <p className="text-muted-foreground text-sm mt-0.5">
              Consulta las operaciones registradas en Maderas M&amp;M
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={recargarVentas}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar historial
        </Button>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          icon={CircleDollarSign}
          label="Total vendido"
          value={fmtMoney(
            resumen.totalVendido
          )}
        />

        <SummaryCard
          icon={ShoppingBag}
          label="Operaciones"
          value={String(
            ventasFiltradas.length
          )}
        />

        <SummaryCard
          icon={Package}
          label="Unidades vendidas"
          value={String(
            resumen.unidades
          )}
        />

        <SummaryCard
          icon={BarChart3}
          label="Ticket promedio"
          value={fmtMoney(
            resumen.ticketPromedio
          )}
        />
      </section>

      <Card className="p-4 md:p-5 bg-card border-border mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              value={busqueda}
              onChange={(event) =>
                setBusqueda(
                  event.target.value
                )
              }
              placeholder="Buscar cliente, producto o número de venta..."
              className="h-11 pl-10 pr-10"
            />

            {busqueda && (
              <button
                type="button"
                onClick={() =>
                  setBusqueda("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={periodo}
            onChange={(event) =>
              setPeriodo(
                event.target.value
              )
            }
            className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filtrar por período"
          >
            {periodos.map((opcion) => (
              <option
                key={opcion.id}
                value={opcion.id}
              >
                {opcion.nombre}
              </option>
            ))}
          </select>

          <select
            value={metodoPago}
            onChange={(event) =>
              setMetodoPago(
                event.target.value
              )
            }
            className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filtrar por método de pago"
          >
            {metodosDisponibles.map(
              (metodo) => (
                <option
                  key={metodo}
                  value={metodo}
                >
                  {metodo ===
                  TODOS_LOS_METODOS
                    ? "Todos los métodos"
                    : metodo}
                </option>
              )
            )}
          </select>

          <Button
            type="button"
            variant="ghost"
            disabled={!filtrosActivos}
            onClick={limpiarFiltros}
            className="h-11"
          >
            Limpiar
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted-foreground">
          {ventasFiltradas.length}{" "}
          venta
          {ventasFiltradas.length === 1
            ? ""
            : "s"}
        </p>

        {ventasFiltradas.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-4 h-4 text-primary" />
            Utilidad estimada:{" "}
            <strong className="text-foreground">
              {fmtMoney(
                resumen.utilidad
              )}
            </strong>
          </div>
        )}
      </div>

      {ventasFiltradas.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 px-5 bg-card border-border text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Receipt className="w-7 h-7 text-muted-foreground" />
          </div>

          <h2 className="font-semibold text-lg">
            {ventasAgrupadas.length === 0
              ? "Todavía no hay ventas registradas"
              : "No encontramos ventas"}
          </h2>

          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            {ventasAgrupadas.length === 0
              ? "Cuando registres una operación desde Vender, aparecerá automáticamente en este historial."
              : "Prueba cambiando la búsqueda, el período o el método de pago."}
          </p>

          {filtrosActivos && (
            <Button
              type="button"
              variant="outline"
              onClick={limpiarFiltros}
              className="mt-5"
            >
              Limpiar filtros
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3">
          {ventasFiltradas.map(
            (venta) => (
              <button
                key={venta.id}
                type="button"
                onClick={() =>
                  setVentaSeleccionada(
                    venta
                  )
                }
                className="w-full text-left"
              >
                <Card className="group p-4 md:p-5 bg-card border-border hover:border-primary/40 hover:shadow-lg transition-all">
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Receipt className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="font-semibold truncate">
                          {venta.cliente}
                        </h3>

                        <span className="text-[11px] rounded-full border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                          {venta.metodoPago}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {fmtDateTime(
                            venta.fecha
                          ) ||
                            "Sin fecha"}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" />
                          {venta.cantidadProductos}{" "}
                          unidad
                          {venta.cantidadProductos ===
                          1
                            ? ""
                            : "es"}
                        </span>

                        <span>
                          {venta.productos.length}{" "}
                          producto
                          {venta.productos.length ===
                          1
                            ? ""
                            : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-lg text-primary">
                          {fmtMoney(
                            venta.total
                          )}
                        </p>

                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Ver detalle
                        </p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                </Card>
              </button>
            )
          )}
        </div>
      )}

      {ventaSeleccionada && (
        <VentaDetailDialog
          venta={ventaSeleccionada}
          onClose={() =>
            setVentaSeleccionada(null)
          }
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <Card className="p-4 md:p-5 bg-card border-border">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {label}
          </p>

          <p className="font-bold text-xl mt-1 truncate">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function VentaDetailDialog({
  venta,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="venta-detalle-titulo"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar detalle"
      />

      <Card className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-hidden bg-card border-border shadow-2xl">
        <header className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-border">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-primary font-semibold">
                Detalle de venta
              </p>

              <h2
                id="venta-detalle-titulo"
                className="text-xl md:text-2xl font-bold mt-1 truncate"
              >
                {venta.cliente}
              </h2>

              <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                Nº {venta.id}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </Button>
        </header>

        <div className="max-h-[calc(92vh-104px)] overflow-y-auto p-5 md:p-6 space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoBlock
              icon={CalendarDays}
              label="Fecha"
              value={
                fmtDateTime(
                  venta.fecha
                ) || "Sin fecha"
              }
            />

            <InfoBlock
              icon={CreditCard}
              label="Método de pago"
              value={venta.metodoPago}
            />

            <InfoBlock
              icon={CircleDollarSign}
              label="Total"
              value={fmtMoney(
                venta.total
              )}
              highlighted
            />
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">
                Productos vendidos
              </h3>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              {venta.productos.map(
                (producto) => (
                  <div
                    key={producto.id}
                    className="grid grid-cols-[1fr_auto] gap-4 p-4 border-b border-border last:border-b-0 bg-muted/10"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {producto.nombre}
                      </p>

                      <p className="text-xs text-muted-foreground mt-1">
                        {producto.cantidad} ×{" "}
                        {fmtMoney(
                          producto.precioUnitario
                        )}
                        {producto.categoria
                          ? ` · ${producto.categoria}`
                          : ""}
                      </p>
                    </div>

                    <p className="font-semibold text-primary whitespace-nowrap">
                      {fmtMoney(
                        producto.total
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-muted/15 border-border">
              <div className="flex items-center gap-2 mb-3">
                <UserRound className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">
                  Cliente
                </h3>
              </div>

              <div className="space-y-2 text-sm">
                <DetailRow
                  label="Nombre"
                  value={venta.cliente}
                />

                {venta.rut && (
                  <DetailRow
                    label="RUT"
                    value={venta.rut}
                  />
                )}

                {venta.telefono && (
                  <DetailRow
                    label="Teléfono"
                    value={venta.telefono}
                  />
                )}

                {venta.email && (
                  <DetailRow
                    label="Correo"
                    value={venta.email}
                  />
                )}

                {venta.direccion && (
                  <DetailRow
                    label="Dirección"
                    value={venta.direccion}
                  />
                )}
              </div>
            </Card>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">
                  Resumen
                </h3>
              </div>

              <div className="space-y-2 text-sm">
                <DetailRow
                  label="Unidades"
                  value={String(
                    venta.cantidadProductos
                  )}
                />

                <DetailRow
                  label="Registrada por"
                  value={
                    venta.usuarioRol
                      ? `${venta.usuarioNombre} · ${venta.usuarioRol}`
                      : venta.usuarioNombre
                  }
                />

                <DetailRow
                  label="Costo estimado"
                  value={fmtMoney(
                    venta.costo
                  )}
                />

                <DetailRow
                  label="Utilidad estimada"
                  value={fmtMoney(
                    venta.utilidad
                  )}
                  strong
                />

                <div className="pt-3 mt-3 border-t border-primary/20 flex items-center justify-between gap-4">
                  <span className="font-medium">
                    Total venta
                  </span>

                  <strong className="text-xl text-primary">
                    {fmtMoney(
                      venta.total
                    )}
                  </strong>
                </div>
              </div>
            </Card>
          </section>

          {venta.observaciones && (
            <section className="rounded-xl border border-border bg-muted/15 p-4">
              <h3 className="font-semibold text-sm">
                Observaciones
              </h3>

              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {venta.observaciones}
              </p>
            </section>
          )}
        </div>
      </Card>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  highlighted = false,
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlighted
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-muted/15"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-4 h-4" />
        {label}
      </div>

      <p
        className={`font-semibold mt-2 ${
          highlighted
            ? "text-primary text-lg"
            : "text-sm"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span
        className={`text-right break-words ${
          strong
            ? "font-semibold text-primary"
            : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}