import React, {
  useMemo,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Pencil,
  Trash2,
  Plus,
  Search,
  Package,
  RotateCcw,
  Image as ImageIcon,
  History,
  ArrowDownToLine,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Clock3,
} from "lucide-react";

import ProductFormDialog from "@/components/ProductFormDialog";
import { useAuth } from "@/lib/AuthContext";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import NumericInput from "@/components/NumericInput";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  TIPOS_MOVIMIENTO,
  etiquetaMovimiento,
  movimientoEsEntrada,
  movimientosDeProducto,
  registrarMovimientoInventario,
} from "@/lib/inventoryMovements";

import {
  getProductos,
  registrarActividad,
  saveProductos,
} from "@/lib/database";

const resumirProducto = (producto) => ({
  nombre: producto?.nombre || "",
  categoria: producto?.categoria || "",
  medida:
    producto?.subcategoria || producto?.unidad_medida || "",
  precio: Number(producto?.precio_unitario || 0),
  costo: Number(producto?.costo_unitario || 0),
  stock: Number(producto?.stock_actual || 0),
  stock_minimo: Number(producto?.stock_minimo || 0),
});

const productosIniciales = [
  {
    id: 1,
    nombre: "Melamina Blanca 15mm",
    categoria: "Planchas",
    subcategoria: "2440x1220mm",
    unidad_medida: "Placa",
    precio_unitario: 12000,
    costo_unitario: 8500,
    stock_actual: 3,
    stock_minimo: 10,
    foto_url: "",
    activo: true,
  },
  {
    id: 2,
    nombre: "Plywood 15mm",
    categoria: "Planchas",
    subcategoria: "2440x1220mm",
    unidad_medida: "Placa",
    precio_unitario: 9800,
    costo_unitario: 7000,
    stock_actual: 22,
    stock_minimo: 10,
    foto_url: "",
    activo: true,
  },
];

export default function Inventario({
  onDataChange,
}) {
  const { user } = useAuth();
  const temporizadorRef = useRef(null);

  const [dialog, setDialog] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [
    productoEliminado,
    setProductoEliminado,
  ] = useState(null);

  const [
    productoHistorial,
    setProductoHistorial,
  ] = useState(null);

  const [
    productoMovimiento,
    setProductoMovimiento,
  ] = useState(null);

  const [productos, setProductos] =
    useState(() => {
      const guardados =
        getProductos();

      if (guardados.length > 0) {
        return guardados;
      }

      const productosEmpresa =
        productosIniciales.map(
          (producto) => ({
            ...producto,
            empresaId:
              user?.empresaId || "",
          })
        );

      saveProductos(
        productosEmpresa
      );

      return productosEmpresa;
    });

  const guardarProductos = (
    nuevaLista
  ) => {
    setProductos(nuevaLista);
    saveProductos(nuevaLista);
    onDataChange?.();
  };

  const deleteProduct = (
    producto
  ) => {
    if (
      temporizadorRef.current
    ) {
      window.clearTimeout(
        temporizadorRef.current
      );
    }

    const posicionOriginal =
      productos.findIndex(
        (item) =>
          String(item.id) ===
          String(producto.id)
      );

    guardarProductos(
      productos.filter(
        (item) =>
          String(item.id) !==
          String(producto.id)
      )
    );

    registrarActividad({
      accion: "eliminar",
      modulo: "Inventario",
      entidadId: producto.id,
      entidadNombre: producto.nombre,
      descripcion: `Eliminó el producto ${producto.nombre}`,
      datosAntes: resumirProducto(producto),
    });

    setProductoEliminado({
      producto,
      posicionOriginal,
    });

    temporizadorRef.current =
      window.setTimeout(() => {
        setProductoEliminado(null);
        temporizadorRef.current =
          null;
      }, 5000);
  };

  const deshacerEliminacion =
    () => {
      if (!productoEliminado) {
        return;
      }

      if (
        temporizadorRef.current
      ) {
        window.clearTimeout(
          temporizadorRef.current
        );

        temporizadorRef.current =
          null;
      }

      const restaurados = [
        ...productos,
      ];

      const posicion = Math.max(
        0,
        Math.min(
          productoEliminado
            .posicionOriginal,
          restaurados.length
        )
      );

      restaurados.splice(
        posicion,
        0,
        productoEliminado.producto
      );

      guardarProductos(
        restaurados
      );

      registrarActividad({
        accion: "restaurar",
        modulo: "Inventario",
        entidadId: productoEliminado.producto.id,
        entidadNombre: productoEliminado.producto.nombre,
        descripcion: `Restauró el producto ${
          productoEliminado.producto.nombre
        }`,
        datosDespues: resumirProducto(
          productoEliminado.producto
        ),
      });

      setProductoEliminado(null);
    };

  const handleSaved = () => {
    const productosActualizados = getProductos();

    if (dialog?.product) {
      const productoActualizado = productosActualizados.find(
        (producto) =>
          String(producto.id) === String(dialog.product.id)
      );

      if (productoActualizado) {
        registrarActividad({
          accion: "editar",
          modulo: "Inventario",
          entidadId: productoActualizado.id,
          entidadNombre: productoActualizado.nombre,
          descripcion: `Editó el producto ${productoActualizado.nombre}`,
          datosAntes: resumirProducto(dialog.product),
          datosDespues: resumirProducto(productoActualizado),
        });
      }
    } else {
      const idsAnteriores = new Set(
        dialog?.idsAntes || []
      );

      const productoNuevo = [...productosActualizados]
        .reverse()
        .find(
          (producto) => !idsAnteriores.has(String(producto.id))
        );

      if (productoNuevo) {
        registrarActividad({
          accion: "crear",
          modulo: "Inventario",
          entidadId: productoNuevo.id,
          entidadNombre: productoNuevo.nombre,
          descripcion: `Creó el producto ${productoNuevo.nombre}`,
          datosDespues: resumirProducto(productoNuevo),
        });
      }
    }

    setProductos(productosActualizados);
    setDialog(null);
    onDataChange?.();
  };

  const filtered = useMemo(
    () => {
      const texto = search
        .trim()
        .toLowerCase();

      return productos.filter(
        (producto) =>
          [
            producto.nombre,
            producto.categoria,
            producto.subcategoria,
            producto.unidad_medida,
          ].some((campo) =>
            String(campo || "")
              .toLowerCase()
              .includes(texto)
          )
      );
    },
    [productos, search]
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Inventario
          </h1>

          <p className="text-muted-foreground">
            {productos.length} producto
            {productos.length === 1
              ? ""
              : "s"}{" "}
            registrado
            {productos.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        <Button
          onClick={() =>
            setDialog({
              product: null,
              idsAntes: productos.map((producto) => String(producto.id)),
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {productoEliminado && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-red-400">
            <Trash2 className="w-5 h-5 shrink-0" />

            <span>
              {
                productoEliminado
                  .producto.nombre
              }{" "}
              eliminado
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={
              deshacerEliminacion
            }
            className="text-red-300 hover:text-white hover:bg-red-500/20"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Deshacer
          </Button>
        </div>
      )}

      <Card className="p-4 bg-card border-border mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Buscar por nombre, categoría o medida..."
            className="pl-10 h-11"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>
      </Card>

      <Card className="overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-4 text-left">
                  Producto
                </th>

                <th className="p-4 text-left">
                  Categoría
                </th>

                <th className="p-4 text-right">
                  Precio
                </th>

                <th className="p-4 text-right">
                  Costo
                </th>

                <th className="p-4 text-right">
                  Stock
                </th>

                <th className="p-4 text-center">
                  Estado
                </th>

                <th className="p-4 text-center">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map(
                  (producto) => {
                    const stockActual =
                      Number(
                        producto.stock_actual ||
                          0
                      );

                    const stockMinimo =
                      Number(
                        producto.stock_minimo ||
                          0
                      );

                    const sinStock =
                      stockActual <= 0;

                    const isCritical =
                      !sinStock &&
                      stockActual <=
                        stockMinimo;

                    return (
                      <tr
                        key={producto.id}
                        className="hover:bg-muted/30 transition"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3 min-w-[230px]">
                            <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-secondary shrink-0">
                              {producto.foto_url ? (
                                <img
                                  src={
                                    producto.foto_url
                                  }
                                  alt={
                                    producto.nombre
                                  }
                                  className="w-full h-full object-cover"
                                  onError={(
                                    event
                                  ) => {
                                    event.currentTarget.style.display =
                                      "none";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {
                                  producto.nombre
                                }
                              </p>

                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {producto.subcategoria ||
                                  producto.unidad_medida ||
                                  "Sin medida"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-muted-foreground">
                          {
                            producto.categoria
                          }
                        </td>

                        <td className="p-4 text-right font-medium">
                          {fmtMoney(
                            producto.precio_unitario
                          )}
                        </td>

                        <td className="p-4 text-right text-muted-foreground">
                          {fmtMoney(
                            producto.costo_unitario
                          )}
                        </td>

                        <td
                          className={`p-4 text-right font-medium ${
                            sinStock ||
                            isCritical
                              ? "text-red-500 font-bold"
                              : ""
                          }`}
                        >
                          {stockActual}{" "}
                          <span className="text-xs text-muted-foreground">
                            / mín{" "}
                            {stockMinimo}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              sinStock
                                ? "bg-red-500/15 text-red-400"
                                : isCritical
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-emerald-500/15 text-emerald-400"
                            }`}
                          >
                            {sinStock
                              ? "Agotado"
                              : isCritical
                              ? "Stock crítico"
                              : "Disponible"}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Registrar entrada o ajuste"
                              onClick={() =>
                                setProductoMovimiento(
                                  producto
                                )
                              }
                              className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <ArrowDownToLine className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Ver historial"
                              onClick={() =>
                                setProductoHistorial(
                                  producto
                                )
                              }
                              className="text-primary hover:bg-primary/10"
                            >
                              <History className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar producto"
                              onClick={() =>
                                setDialog({
                                  product:
                                    producto,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar producto"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() =>
                                deleteProduct(
                                  producto
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="p-16 text-center text-muted-foreground"
                  >
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />

                    <p className="font-medium">
                      No se encontraron productos
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {dialog && (
        <ProductFormDialog
          product={dialog.product}
          onClose={() =>
            setDialog(null)
          }
          onSaved={handleSaved}
        />
      )}

      {productoMovimiento && (
        <MovimientoStockDialog
          producto={productoMovimiento}
          user={user}
          onClose={() =>
            setProductoMovimiento(null)
          }
          onSaved={() => {
            setProductos(getProductos());
            onDataChange?.();
            setProductoMovimiento(null);
          }}
        />
      )}

      {productoHistorial && (
        <HistorialProductoDialog
          producto={productoHistorial}
          onClose={() =>
            setProductoHistorial(null)
          }
        />
      )}
    </div>
  );
}

function MovimientoStockDialog({
  producto,
  user,
  onClose,
  onSaved,
}) {
  const [tipo, setTipo] =
    useState("entrada");

  const [cantidad, setCantidad] =
    useState("");

  const [motivo, setMotivo] =
    useState("");

  const [error, setError] =
    useState("");

  const stockActual = Number(
    producto.stock_actual || 0
  );

  const guardar = () => {
    const cantidadNumero =
      Number(cantidad || 0);

    if (cantidadNumero <= 0) {
      setError(
        "La cantidad debe ser mayor que cero."
      );
      return;
    }

    let stockNuevo =
      stockActual;

    let tipoMovimiento =
      TIPOS_MOVIMIENTO.ENTRADA;

    if (tipo === "entrada") {
      stockNuevo =
        stockActual +
        cantidadNumero;

      tipoMovimiento =
        TIPOS_MOVIMIENTO.ENTRADA;
    }

    if (tipo === "sumar") {
      stockNuevo =
        stockActual +
        cantidadNumero;

      tipoMovimiento =
        TIPOS_MOVIMIENTO.AJUSTE_POSITIVO;
    }

    if (tipo === "restar") {
      stockNuevo =
        stockActual -
        cantidadNumero;

      if (stockNuevo < 0) {
        setError(
          "El ajuste no puede dejar el stock bajo cero."
        );
        return;
      }

      tipoMovimiento =
        TIPOS_MOVIMIENTO.AJUSTE_NEGATIVO;
    }

    try {
      const inventario =
        getProductos();

      const actualizado =
        inventario.map(
          (item) =>
            String(item.id) ===
            String(producto.id)
              ? {
                  ...item,
                  stock_actual:
                    stockNuevo,
                }
              : item
        );

      saveProductos(actualizado);

      registrarMovimientoInventario({
        productoId:
          producto.id,
        productoNombre:
          producto.nombre,
        tipo: tipoMovimiento,
        cantidad:
          cantidadNumero,
        stockAnterior:
          stockActual,
        stockNuevo,
        motivo:
          motivo ||
          (tipo === "entrada"
            ? "Entrada de mercadería"
            : "Ajuste manual"),
        referenciaTipo:
          "inventario",
        usuario:
          user?.name || "Usuario",
        usuarioId:
          user?.id || "",
        empresaId:
          user?.empresaId || "",
      });

      onSaved();
    } catch (errorGuardado) {
      console.error(
        "Error registrando movimiento:",
        errorGuardado
      );

      setError(
        "No se pudo registrar el movimiento."
      );
    }
  };

  const vistaStock =
    tipo === "restar"
      ? stockActual -
        Number(cantidad || 0)
      : stockActual +
        Number(cantidad || 0);

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            Movimiento de stock
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="font-semibold">
            {producto.nombre}
          </p>

          <p className="text-sm text-muted-foreground mt-1">
            Stock actual:{" "}
            <strong className="text-foreground">
              {stockActual}
            </strong>
          </p>
        </div>

        <div>
          <Label>
            Tipo de movimiento
          </Label>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              {
                id: "entrada",
                nombre: "Entrada",
              },
              {
                id: "sumar",
                nombre: "Sumar",
              },
              {
                id: "restar",
                nombre: "Restar",
              },
            ].map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() =>
                  setTipo(
                    opcion.id
                  )
                }
                className={`rounded-xl border px-3 py-3 text-sm transition ${
                  tipo === opcion.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {opcion.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Cantidad</Label>

          <NumericInput
            min={1}
            value={cantidad}
            onValueChange={(valor) => {
              setCantidad(valor);
              setError("");
            }}
            className="mt-1"
          />
        </div>

        <div>
          <Label>
            Motivo / nota
          </Label>

          <Input
            value={motivo}
            onChange={(event) =>
              setMotivo(
                event.target.value
              )
            }
            placeholder="Ej: Compra a proveedor"
            className="mt-1"
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Stock resultante
          </span>

          <span
            className={`text-2xl font-bold ${
              vistaStock < 0
                ? "text-red-400"
                : "text-emerald-400"
            }`}
          >
            {vistaStock}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={guardar}
          >
            Registrar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorialProductoDialog({
  producto,
  onClose,
}) {
  const [version, setVersion] =
    useState(0);

  React.useEffect(() => {
    const actualizar = () =>
      setVersion(
        (actual) =>
          actual + 1
      );

    window.addEventListener(
      "movimientos-inventario-actualizados",
      actualizar
    );

    return () =>
      window.removeEventListener(
        "movimientos-inventario-actualizados",
        actualizar
      );
  }, []);

  const movimientos =
    useMemo(
      () =>
        movimientosDeProducto(
          producto.id
        ),
      [producto.id, version]
    );

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Historial de{" "}
            {producto.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              Stock actual
            </p>

            <p className="text-2xl font-bold mt-1">
              {producto.stock_actual}
            </p>
          </div>

          <Clock3 className="w-6 h-6 text-primary" />
        </div>

        {movimientos.length > 0 ? (
          <div className="space-y-2">
            {movimientos.map(
              (movimiento) => {
                const entrada =
                  movimientoEsEntrada(
                    movimiento.tipo
                  );

                return (
                  <div
                    key={
                      movimiento.id
                    }
                    className="flex items-start gap-3 rounded-xl border border-border p-4"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        entrada
                          ? "bg-emerald-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {entrada ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {etiquetaMovimiento(
                            movimiento.tipo
                          )}
                        </p>

                        <p
                          className={`font-bold ${
                            entrada
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {entrada
                            ? "+"
                            : "-"}
                          {Math.abs(
                            Number(
                              movimiento.cantidad ||
                                0
                            )
                          )}
                        </p>
                      </div>

                      <p className="text-sm text-muted-foreground mt-1">
                        {movimiento.motivo ||
                          "Sin nota"}
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>
                          {fmtDateTime(
                            movimiento.fecha
                          )}
                        </span>

                        <span>
                          Stock:{" "}
                          {
                            movimiento.stock_anterior
                          }{" "}
                          →{" "}
                          {
                            movimiento.stock_nuevo
                          }
                        </span>

                        <span>
                          {
                            movimiento.usuario
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />

            <p className="font-medium">
              Todavía no hay movimientos
            </p>

            <p className="text-xs mt-1">
              Los movimientos nuevos comenzarán a registrarse desde ahora.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}