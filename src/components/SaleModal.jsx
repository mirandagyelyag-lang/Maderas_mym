import React, { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";

import {
  Minus,
  Plus,
  Check,
  Loader2,
} from "lucide-react";

import { fmtMoney } from "@/lib/format";

const metodos = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Cuenta Corriente",
];

export default function SaleModal({
  product,
  onClose,
  actualizarProductos,
  actualizarVentas,
}) {
  const [cantidad, setCantidad] = useState("1");
  const [metodo, setMetodo] = useState("Efectivo");
  const [cliente, setCliente] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [loading, setLoading] = useState(false);

  const stockDisponible = Number(product.stock_actual || 0);
  const precioUnitario = Number(product.precio_unitario || 0);
  const cantidadNumero = Number(cantidad || 0);
  const total = cantidadNumero * precioUnitario;

  const confirmar = () => {
    if (loading) return;

    if (cantidadNumero <= 0) {
      window.alert("La cantidad debe ser mayor que cero.");
      return;
    }

    if (cantidadNumero > stockDisponible) {
      window.alert(
        `No hay suficiente stock. Hay ${stockDisponible} disponible(s).`
      );
      return;
    }

    setLoading(true);

    try {
      const ventasGuardadas = JSON.parse(
        localStorage.getItem("ventas") || "[]"
      );

      const inventarioGuardado = JSON.parse(
        localStorage.getItem("inventario") || "[]"
      );

      const nuevaVenta = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        producto_id: product.id,
        nombre_producto: product.nombre,
        categoria: product.categoria || "",
        cantidad: cantidadNumero,
        precio_unitario: precioUnitario,
        costo_unitario: Number(product.costo_unitario || 0),
        total,
        metodo_pago: metodo,
        cliente: cliente.trim(),
      };

      const inventarioActualizado = inventarioGuardado.map(
        (producto) =>
          String(producto.id) === String(product.id)
            ? {
                ...producto,
                stock_actual:
                  Number(producto.stock_actual || 0) -
                  cantidadNumero,
              }
            : producto
      );

      const ventasActualizadas = [
        ...ventasGuardadas,
        nuevaVenta,
      ];

      localStorage.setItem(
        "ventas",
        JSON.stringify(ventasActualizadas)
      );

      localStorage.setItem(
        "inventario",
        JSON.stringify(inventarioActualizado)
      );

      actualizarProductos?.();
      actualizarVentas?.();

      setGuardado(true);

      window.setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Error al registrar la venta:", error);
      window.alert("No se pudo registrar la venta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={Boolean(product)}
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
    >
      <DialogContent className="max-w-sm bg-card border-border">
        {guardado ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>

            <p className="text-lg font-semibold">
              ¡Venta registrada!
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              El inventario y el Dashboard fueron actualizados.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{product.nombre}</DialogTitle>

              {product.subcategoria && (
                <p className="text-sm text-muted-foreground">
                  {product.subcategoria}
                </p>
              )}
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Cantidad</Label>

                  <span className="text-xs text-muted-foreground">
                    Stock disponible: {stockDisponible}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                    onClick={() =>
                      setCantidad(
                        String(Math.max(1, cantidadNumero - 1))
                      )
                    }
                    disabled={loading}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>

                  <NumericInput
                    min={1}
                    max={stockDisponible}
                    value={cantidad}
                    onValueChange={setCantidad}
                    className="h-12 text-center text-xl font-bold"
                    disabled={loading}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                    onClick={() =>
                      setCantidad(
                        String(
                          Math.min(
                            stockDisponible,
                            Math.max(0, cantidadNumero) + 1
                          )
                        )
                      )
                    }
                    disabled={
                      loading ||
                      cantidadNumero >= stockDisponible
                    }
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Cliente (opcional)</Label>

                <Input
                  value={cliente}
                  onChange={(event) =>
                    setCliente(event.target.value)
                  }
                  placeholder="Nombre del cliente"
                  className="h-12 mt-2"
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Método de pago</Label>

                <select
                  className="h-12 mt-2 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={metodo}
                  onChange={(event) =>
                    setMetodo(event.target.value)
                  }
                  disabled={loading}
                >
                  {metodos.map((metodoPago) => (
                    <option
                      key={metodoPago}
                      value={metodoPago}
                    >
                      {metodoPago}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Total
                </span>

                <span className="text-2xl font-bold text-primary">
                  {fmtMoney(total)}
                </span>
              </div>

              <Button
                type="button"
                className="w-full h-12 text-base font-semibold"
                onClick={confirmar}
                disabled={
                  loading ||
                  stockDisponible <= 0 ||
                  cantidadNumero <= 0
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Confirmar venta"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
