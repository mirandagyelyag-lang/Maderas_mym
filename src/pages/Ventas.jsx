import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import {
  ShoppingCart,
  Search,
  Trash2,
  RotateCcw,
} from "lucide-react";

const pagoColors = {
  Efectivo: "bg-emerald-500/10 text-emerald-500",
  Transferencia: "bg-blue-500/10 text-blue-500",
  Tarjeta: "bg-violet-500/10 text-violet-500",
  "Cuenta Corriente": "bg-amber-500/10 text-amber-500",
};

const metodosPago = [
  "Todos",
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Cuenta Corriente",
];

export default function Ventas({
  ventas = [],
  actualizarVentas,
  actualizarProductos,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [metodoSeleccionado, setMetodoSeleccionado] =
    useState("Todos");

  const hoy = new Date().toDateString();

  const ventasHoy = ventas.filter(
    (venta) =>
      new Date(venta.fecha).toDateString() === hoy
  );

  const totalHoy = ventasHoy.reduce(
    (total, venta) =>
      total + Number(venta.total || 0),
    0
  );

  const totalMes = ventas
    .filter((venta) => {
      const fechaVenta = new Date(venta.fecha);
      const fechaActual = new Date();

      return (
        fechaVenta.getMonth() ===
          fechaActual.getMonth() &&
        fechaVenta.getFullYear() ===
          fechaActual.getFullYear()
      );
    })
    .reduce(
      (total, venta) =>
        total + Number(venta.total || 0),
      0
    );

  const ventasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return [...ventas]
      .filter((venta) => {
        const coincideMetodo =
          metodoSeleccionado === "Todos" ||
          venta.metodo_pago === metodoSeleccionado;

        const producto = String(
          venta.nombre_producto || ""
        ).toLowerCase();

        const cliente = String(
          venta.cliente || ""
        ).toLowerCase();

        const coincideBusqueda =
          texto === "" ||
          producto.includes(texto) ||
          cliente.includes(texto);

        return coincideMetodo && coincideBusqueda;
      })
      .sort(
        (a, b) =>
          new Date(b.fecha) - new Date(a.fecha)
      );
  }, [ventas, busqueda, metodoSeleccionado]);

  const anularVenta = (venta) => {
    const confirmar = window.confirm(
      `¿Anular la venta de "${venta.nombre_producto}"?\n\nEl stock vendido será devuelto al inventario.`
    );

    if (!confirmar) return;

    try {
      const ventasGuardadas = JSON.parse(
        localStorage.getItem("ventas") || "[]"
      );

      const inventarioGuardado = JSON.parse(
        localStorage.getItem("inventario") || "[]"
      );

      const ventasActualizadas = ventasGuardadas.filter(
        (item) =>
          String(item.id) !== String(venta.id)
      );

      const inventarioActualizado =
        inventarioGuardado.map((producto) =>
          String(producto.id) ===
          String(venta.producto_id)
            ? {
                ...producto,
                stock_actual:
                  Number(
                    producto.stock_actual || 0
                  ) +
                  Number(venta.cantidad || 0),
              }
            : producto
        );

      localStorage.setItem(
        "ventas",
        JSON.stringify(ventasActualizadas)
      );

      localStorage.setItem(
        "inventario",
        JSON.stringify(inventarioActualizado)
      );

      actualizarVentas?.();
      actualizarProductos?.();
    } catch (error) {
      console.error(
        "Error al anular la venta:",
        error
      );

      window.alert(
        "No se pudo anular la venta."
      );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Ventas
        </h1>

        <p className="text-muted-foreground">
          Historial de transacciones registradas
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6 bg-card border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Ventas hoy
          </p>

          <p className="text-3xl font-bold mt-1 text-primary">
            {fmtMoney(totalHoy)}
          </p>

          <p className="text-xs text-muted-foreground mt-2">
            {ventasHoy.length} transacción
            {ventasHoy.length === 1 ? "" : "es"}
          </p>
        </Card>

        <Card className="p-6 bg-card border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            Total del mes
          </p>

          <p className="text-3xl font-bold mt-1">
            {fmtMoney(totalMes)}
          </p>

          <p className="text-xs text-muted-foreground mt-2">
            {ventas.length} venta
            {ventas.length === 1 ? "" : "s"} totales
          </p>
        </Card>
      </div>

      {/* Buscador y filtro */}
      <Card className="p-4 bg-card border-border">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              value={busqueda}
              onChange={(event) =>
                setBusqueda(event.target.value)
              }
              placeholder="Buscar por producto o cliente..."
              className="pl-10"
            />
          </div>

          <select
            value={metodoSeleccionado}
            onChange={(event) =>
              setMetodoSeleccionado(
                event.target.value
              )
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm md:w-52"
          >
            {metodosPago.map((metodo) => (
              <option
                key={metodo}
                value={metodo}
              >
                {metodo === "Todos"
                  ? "Todos los pagos"
                  : metodo}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden border-border bg-card">
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
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {ventasFiltradas.length > 0 ? (
                ventasFiltradas.map((venta) => (
                  <tr
                    key={venta.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="p-4 text-[#C3A579] font-medium whitespace-nowrap">
                      {fmtDateTime(venta.fecha)}
                    </td>

                    <td className="p-4 font-medium">
                      {venta.nombre_producto}
                    </td>

                    <td className="p-4 text-right">
                      {venta.cantidad}
                    </td>

                    <td className="p-4 text-right font-bold">
                      {fmtMoney(venta.total)}
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          pagoColors[
                            venta.metodo_pago
                          ] || "bg-secondary"
                        }`}
                      >
                        {venta.metodo_pago}
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
                        title="Anular venta"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() =>
                          anularVenta(venta)
                        }
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="p-16 text-center text-muted-foreground"
                  >
                    {ventas.length === 0 ? (
                      <>
                        <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />

                        <p className="text-lg font-medium">
                          No hay ventas registradas
                        </p>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-20" />

                        <p className="text-lg font-medium">
                          No hay resultados
                        </p>

                        <p className="text-sm mt-1">
                          Prueba otra búsqueda o
                          método de pago.
                        </p>
                      </>
                    )}
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