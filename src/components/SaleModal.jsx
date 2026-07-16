import React, {
  useMemo,
  useRef,
  useState,
} from "react";

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
  Search,
  UserRound,
  CreditCard,
  Package,
  ShoppingCart,
  X,
} from "lucide-react";

import { fmtMoney } from "@/lib/format";

import {
  TIPOS_MOVIMIENTO,
  registrarMovimientoInventario,
} from "@/lib/inventoryMovements";

const metodos = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Cuenta Corriente",
];

const normalizar = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

export default function SaleModal({
  product,
  onClose,
  actualizarProductos,
  actualizarVentas,
}) {
  const clienteRef = useRef(null);

  const [cantidad, setCantidad] =
    useState("1");

  const [metodo, setMetodo] =
    useState("Efectivo");

  const [cliente, setCliente] =
    useState("");

  const [clienteId, setClienteId] =
    useState("");

  const [
    buscadorClienteAbierto,
    setBuscadorClienteAbierto,
  ] = useState(false);

  const [guardado, setGuardado] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [mensajeError, setMensajeError] =
    useState("");

  const clientes = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          "mis_clientes_data"
        ) || "[]"
      );
    } catch {
      return [];
    }
  }, []);

  const clientesFiltrados =
    useMemo(() => {
      const texto =
        normalizar(cliente);

      if (!texto) {
        return clientes.slice(0, 6);
      }

      return clientes
        .filter((item) =>
          [
            item.nombre,
            item.telefono_whatsapp,
            item.rut_dni,
          ].some((campo) =>
            normalizar(campo).includes(
              texto
            )
          )
        )
        .slice(0, 6);
    }, [clientes, cliente]);

  const stockDisponible = Number(
    product.stock_actual || 0
  );

  const precioUnitario = Number(
    product.precio_unitario || 0
  );

  const cantidadNumero = Number(
    cantidad || 0
  );

  const total =
    cantidadNumero *
    precioUnitario;

  const confirmar = () => {
    if (loading) return;

    setMensajeError("");

    if (cantidadNumero <= 0) {
      setMensajeError(
        "La cantidad debe ser mayor que cero."
      );
      return;
    }

    if (
      cantidadNumero >
      stockDisponible
    ) {
      setMensajeError(
        `No hay suficiente stock. Hay ${stockDisponible} disponible(s).`
      );
      return;
    }

    setLoading(true);

    try {
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

      const clienteGuardado =
        clientes.find(
          (item) =>
            String(item.id) ===
            String(clienteId)
        );

      const nuevaVenta = {
        id: Date.now(),
        fecha:
          new Date().toISOString(),
        producto_id: product.id,
        nombre_producto:
          product.nombre,
        categoria:
          product.categoria || "",
        cantidad:
          cantidadNumero,
        precio_unitario:
          precioUnitario,
        costo_unitario: Number(
          product.costo_unitario || 0
        ),
        total,
        metodo_pago: metodo,
        cliente: cliente.trim(),
        cliente_id:
          clienteGuardado?.id || "",
        telefono_cliente:
          clienteGuardado
            ?.telefono_whatsapp || "",
        email_cliente:
          clienteGuardado?.email || "",
        direccion_cliente:
          clienteGuardado
            ?.direccion || "",
        rut_cliente:
          clienteGuardado
            ?.rut_dni || "",
      };

      const inventarioActualizado =
        inventarioGuardado.map(
          (producto) =>
            String(producto.id) ===
            String(product.id)
              ? {
                  ...producto,
                  stock_actual:
                    Number(
                      producto.stock_actual ||
                        0
                    ) -
                    cantidadNumero,
                }
              : producto
        );

      localStorage.setItem(
        "ventas",
        JSON.stringify([
          ...ventasGuardadas,
          nuevaVenta,
        ])
      );

      localStorage.setItem(
        "inventario",
        JSON.stringify(
          inventarioActualizado
        )
      );

      registrarMovimientoInventario({
        productoId:
          product.id,
        productoNombre:
          product.nombre,
        tipo:
          TIPOS_MOVIMIENTO.VENTA,
        cantidad:
          cantidadNumero,
        stockAnterior:
          stockDisponible,
        stockNuevo:
          stockDisponible -
          cantidadNumero,
        motivo:
          cliente.trim()
            ? `Venta a ${cliente.trim()}`
            : "Venta registrada",
        referenciaId:
          nuevaVenta.id,
        referenciaTipo:
          "venta",
      });

      actualizarProductos?.();
      actualizarVentas?.();

      setGuardado(true);

      window.setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error(
        "Error al registrar la venta:",
        error
      );

      setMensajeError(
        "No se pudo registrar la venta."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={Boolean(product)}
      onOpenChange={(open) => {
        if (!open && !loading) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md bg-card border-border">
        {guardado ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-5">
              <Check className="w-10 h-10 text-emerald-500" />
            </div>

            <p className="text-xl font-semibold">
              Venta registrada
            </p>

            <p className="text-3xl font-bold text-emerald-400 mt-3">
              {fmtMoney(total)}
            </p>

            <div className="mt-5 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <p>
                Stock actualizado automáticamente
              </p>

              <p className="mt-1">
                {cantidadNumero}{" "}
                {product.unidad_medida?.toLowerCase() ||
                  "unidad(es)"}{" "}
                de {product.nombre}
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Registrar venta
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {product.nombre}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    {product.categoria ||
                      "Sin categoría"}
                    {" · "}
                    {product.unidad_medida ||
                      "Unidad"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold text-primary">
                    {fmtMoney(
                      precioUnitario
                    )}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Stock:{" "}
                    {stockDisponible}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Cantidad</Label>

                  <span className="text-xs text-muted-foreground">
                    Máximo{" "}
                    {stockDisponible}
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
                        String(
                          Math.max(
                            1,
                            cantidadNumero -
                              1
                          )
                        )
                      )
                    }
                    disabled={
                      loading ||
                      cantidadNumero <= 1
                    }
                  >
                    <Minus className="w-4 h-4" />
                  </Button>

                  <NumericInput
                    min={1}
                    max={
                      stockDisponible
                    }
                    value={cantidad}
                    onValueChange={
                      setCantidad
                    }
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
                            Math.max(
                              0,
                              cantidadNumero
                            ) + 1
                          )
                        )
                      )
                    }
                    disabled={
                      loading ||
                      cantidadNumero >=
                        stockDisponible
                    }
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div
                ref={clienteRef}
                className="relative"
              >
                <Label>
                  Cliente{" "}
                  <span className="text-xs text-muted-foreground">
                    (opcional)
                  </span>
                </Label>

                <div className="relative mt-2">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                  <Input
                    value={cliente}
                    onFocus={() =>
                      setBuscadorClienteAbierto(
                        true
                      )
                    }
                    onChange={(event) => {
                      setCliente(
                        event.target.value
                      );

                      setClienteId("");

                      setBuscadorClienteAbierto(
                        true
                      );
                    }}
                    placeholder="Buscar o escribir cliente..."
                    className="h-12 pl-10 pr-10"
                    disabled={loading}
                  />

                  {cliente && (
                    <button
                      type="button"
                      onClick={() => {
                        setCliente("");
                        setClienteId("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {buscadorClienteAbierto &&
                  !loading && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl">
                      {clientesFiltrados.length >
                      0 ? (
                        clientesFiltrados.map(
                          (
                            clienteGuardado
                          ) => (
                            <button
                              key={
                                clienteGuardado.id
                              }
                              type="button"
                              onClick={() => {
                                setCliente(
                                  clienteGuardado.nombre
                                );

                                setClienteId(
                                  clienteGuardado.id
                                );

                                setBuscadorClienteAbierto(
                                  false
                                );
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border last:border-b-0 hover:bg-muted transition"
                            >
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0">
                                {clienteGuardado.nombre
                                  ?.charAt(
                                    0
                                  )
                                  .toUpperCase() ||
                                  "?"}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {
                                    clienteGuardado.nombre
                                  }
                                </p>

                                <p className="text-xs text-muted-foreground truncate">
                                  {clienteGuardado.telefono_whatsapp ||
                                    "Sin teléfono"}
                                </p>
                              </div>
                            </button>
                          )
                        )
                      ) : (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          Puedes usar ese nombre como cliente nuevo.
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div>
                <Label>
                  Método de pago
                </Label>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  {metodos.map(
                    (metodoPago) => (
                      <button
                        key={
                          metodoPago
                        }
                        type="button"
                        onClick={() =>
                          setMetodo(
                            metodoPago
                          )
                        }
                        disabled={
                          loading
                        }
                        className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm transition ${
                          metodo ===
                          metodoPago
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />

                        {
                          metodoPago
                        }
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Precio unitario
                  </span>

                  <span>
                    {fmtMoney(
                      precioUnitario
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
                  <span>
                    Cantidad
                  </span>

                  <span>
                    {cantidadNumero}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                  <span className="font-medium">
                    Total
                  </span>

                  <span className="text-3xl font-bold text-primary">
                    {fmtMoney(total)}
                  </span>
                </div>
              </div>

              {mensajeError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {mensajeError}
                </div>
              )}

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
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Confirmar venta
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}