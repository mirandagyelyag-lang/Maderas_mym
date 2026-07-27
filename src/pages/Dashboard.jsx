import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Card } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import { fmtMoney } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";
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
  getCotizacionesLocalesRespaldo,
  getCotizacionesRemotas,
  subscribeCotizaciones,
} from "@/lib/quotationRepository";

import {
  Wallet,
  Banknote,
  Package,
  AlertTriangle,
  FileText,
  ShoppingCart,
  Clock3,
  BellRing,
  Sparkles,
} from "lucide-react";
import {
  getCajaActualLocalRespaldo,
  getCajaActualRemota,
  subscribeCaja,
} from "@/lib/cashRepository";

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
  productos: productosIniciales = [],
  ventas: ventasIniciales = [],
  gastos: gastosIniciales = [],
  cotizaciones: cotizacionesIniciales = [],
}) {
  const { user } = useAuth();

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

  const [
    cotizaciones,
    setCotizaciones,
  ] = useState(() =>
    cotizacionesIniciales.length > 0
      ? cotizacionesIniciales
      : getCotizacionesLocalesRespaldo()
  );

  const [cajaActual, setCajaActual] =
    useState(
      getCajaActualLocalRespaldo
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
          cotizacionesRemotas,
          cajaRemota,
        ] = await Promise.all([
          getProductosRemotos(),
          getVentasRemotas(),
          getGastosRemotos(),
          getCotizacionesRemotas(),
          getCajaActualRemota(),
        ]);

        if (!activo) return;

        setProductos(productosRemotos);
        setVentas(ventasRemotas);
        setGastos(gastosRemotos);
        setCotizaciones(
          cotizacionesRemotas
        );
        setCajaActual(cajaRemota);
        setErrorSincronizacion("");
      } catch (error) {
        console.error(
          "No se pudo sincronizar el Dashboard:",
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
        setCotizaciones(
          cotizacionesIniciales.length > 0
            ? cotizacionesIniciales
            : getCotizacionesLocalesRespaldo()
        );
        setCajaActual(
          getCajaActualLocalRespaldo()
        );
        setErrorSincronizacion(
          "No se pudo sincronizar el Dashboard con Supabase. Se muestran temporalmente los datos guardados en este equipo."
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
    const cancelarCotizaciones =
      subscribeCotizaciones(cargarDatos);
    const cancelarCaja =
      subscribeCaja(cargarDatos);

    return () => {
      activo = false;
      cancelarInventario();
      cancelarVentas();
      cancelarGastos();
      cancelarCotizaciones();
      cancelarCaja();
    };
  }, []);

  const now = useMemo(() => new Date(), []);

  const ventasHoy = useMemo(
    () =>
      ventas.filter(
        (venta) =>
          parsearFechaLocal(
            venta.fecha
          ).toDateString() ===
          now.toDateString()
      ),
    [ventas, now]
  );

  const metricasHoy = useMemo(
    () => ({
      ventas: new Set(
        ventasHoy.map(
          (venta) =>
            venta.venta_grupo_id ||
            venta.id
        )
      ).size,
      ingresos: ventasHoy.reduce(
        (total, venta) =>
          total +
          Number(venta.total || 0),
        0
      ),
      unidades: ventasHoy.reduce(
        (total, venta) =>
          total +
          Number(venta.cantidad || 0),
        0
      ),
    }),
    [ventasHoy]
  );

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
      ...gastos.map((gasto) => ({
        id: `gasto-${gasto.id}`,
        tipo: "gasto",
        fecha: gasto.fecha,
        titulo: "Gasto registrado",
        detalle:
          gasto.concepto ||
          gasto.categoria ||
          "Gasto",
        monto: Number(gasto.monto || 0),
        cliente:
          gasto.metodo_pago ||
          "Sin método de pago",
      })),
    ]
      .filter((act) => act.fecha)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 6);
  }, [ventas, cotizaciones, gastos]);

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

    if (ventasHoy.length === 0) {
      alertas.push({
        tipo: "info",
        texto: "Aún no hay ventas registradas hoy",
      });
    }

    if (!cajaActual) {
      alertas.push({
        tipo: "advertencia",
        texto: "La caja todavía no ha sido abierta",
      });
    }

    return alertas.slice(0, 4);
  }, [
    productosAgotados,
    stockCritico,
    cotizacionesPendientes,
    ventasHoy,
    cajaActual,
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

  return (
    <div className="dashboard-cinematic p-4 md:p-8 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="dashboard-reveal dashboard-delay-1 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p
            className="font-heading text-foreground"
            style={{
              fontSize: "clamp(1.5rem, 2.4vw, 1.875rem)",
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {saludo}
          </p>

          <h1 className="text-lg md:text-xl font-semibold text-primary mt-1">
            {user?.name || "Usuario"}
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

      {errorSincronizacion && (
        <div className="dashboard-reveal dashboard-delay-2 mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {errorSincronizacion}
        </div>
      )}

      {/* Resumen ejecutivo */}
      <Card className="dashboard-reveal dashboard-delay-2 dashboard-hero-card mb-6 overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card">
        <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">
                Centro operativo
              </h2>
            </div>

            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              En un vistazo: ventas, inventario y cotizaciones que requieren atención.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Ventas de hoy
                </p>
                <p className="font-bold mt-1">
                  {metricasHoy.ventas}
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
      <div className="dashboard-reveal dashboard-delay-3 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          icon={Banknote}
          label="Ingresos de hoy"
          value={fmtMoney(metricasHoy.ingresos)}
          accent="primary"
        />

        <StatCard
          icon={ShoppingCart}
          label="Unidades vendidas hoy"
          value={metricasHoy.unidades}
          accent="green"
        />

        <StatCard
          icon={Wallet}
          label="Estado de caja"
          value={
            cajaActual
              ? "Abierta"
              : "Cerrada"
          }
          accent={
            cajaActual
              ? "green"
              : "red"
          }
        />

        <StatCard
          icon={FileText}
          label="Cotizaciones pendientes"
          value={cotizacionesPendientes.length}
          accent="primary"
        />
      </div>

      {/* Stock crítico */}
      <Card className="dashboard-reveal dashboard-delay-6 p-5 bg-card border-border mb-6">
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
      <Card className="dashboard-reveal dashboard-delay-7 p-5 bg-card border-border">
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
                actividad.tipo === "venta"
                  ? ShoppingCart
                  : actividad.tipo === "gasto"
                  ? Wallet
                  : FileText;

              return (
                <div
                  key={actividad.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      actividad.tipo === "venta"
                        ? "bg-emerald-500/10"
                        : actividad.tipo === "gasto"
                        ? "bg-red-500/10"
                        : "bg-primary/10"
                    }`}
                  >
                    <Icono
                      className={`w-5 h-5 ${
                        actividad.tipo === "venta"
                          ? "text-emerald-500"
                          : actividad.tipo === "gasto"
                          ? "text-red-400"
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
                      {actividad.tipo === "gasto"
                        ? "-"
                        : ""}
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