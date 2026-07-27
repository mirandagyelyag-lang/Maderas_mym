import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  ClipboardList,
  Plus,
  Search,
  Trash2,
  Truck,
  Package,
  CalendarDays,
  ReceiptText,
  X,
  ShoppingBag,
} from "lucide-react";

import {
  fmtMoney,
  fmtDateTime,
} from "@/lib/format";

import {
  registrarActividad,
} from "@/lib/database";
import {
  getProductosLocalesRespaldo,
  getProductosRemotos,
  importarInventarioLocalSiVacio,
  subscribeInventario,
} from "@/lib/inventoryRepository";
import {
  getComprasLocalesRespaldo,
  getComprasRemotas,
  getProveedoresLocalesRespaldo,
  getProveedoresRemotos,
  importarComprasYProveedoresLocalesSiVacio,
  registrarCompraRemota,
  subscribeCompras,
  subscribeProveedores,
} from "@/lib/purchasingRepository";

export default function Compras({
  productos,
  actualizarProductos,
}) {
  const [
    productosDisponibles,
    setProductosDisponibles,
  ] = useState(() =>
    Array.isArray(productos)
      ? productos
      : getProductosLocalesRespaldo()
  );

  const [compras, setCompras] =
    useState(
      getComprasLocalesRespaldo
    );

  const [
    proveedores,
    setProveedores,
  ] = useState(
    getProveedoresLocalesRespaldo
  );

  const [busqueda, setBusqueda] =
    useState("");

  const [dialogo, setDialogo] =
    useState(false);

  const [
    errorSincronizacion,
    setErrorSincronizacion,
  ] = useState("");

  const [guardando, setGuardando] =
    useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        await importarInventarioLocalSiVacio();
        await importarComprasYProveedoresLocalesSiVacio();

        const [
          comprasRemotas,
          proveedoresRemotos,
          productosRemotos,
        ] = await Promise.all([
          getComprasRemotas(),
          getProveedoresRemotos(),
          getProductosRemotos(),
        ]);

        setCompras(comprasRemotas);
        setProveedores(proveedoresRemotos);
        setProductosDisponibles(productosRemotos);
        setErrorSincronizacion("");
      } catch (error) {
        console.error(
          "No se pudieron sincronizar las compras:",
          error
        );

        setCompras(
          getComprasLocalesRespaldo()
        );
        setProveedores(
          getProveedoresLocalesRespaldo()
        );
        setProductosDisponibles(
          getProductosLocalesRespaldo()
        );
        setErrorSincronizacion(
          "No se pudieron sincronizar Compras y Proveedores con Supabase."
        );
      }
    };

    cargarDatos();

    const cancelarCompras =
      subscribeCompras(cargarDatos);
    const cancelarProveedores =
      subscribeProveedores(cargarDatos);
    const cancelarInventario =
      subscribeInventario(cargarDatos);

    return () => {
      cancelarCompras();
      cancelarProveedores();
      cancelarInventario();
    };
  }, []);

  const comprasFiltradas =
    useMemo(() => {
      const texto = busqueda
        .trim()
        .toLowerCase();

      return [...compras]
        .filter(
          (compra) =>
            !texto ||
            [
              compra.proveedor_nombre,
              compra.numero_documento,
              compra.notas,
            ].some((campo) =>
              String(campo || "")
                .toLowerCase()
                .includes(texto)
            )
        )
        .sort(
          (a, b) =>
            new Date(b.fecha) -
            new Date(a.fecha)
        );
    }, [
      compras,
      busqueda,
    ]);

  const totalMes = useMemo(() => {
    const ahora = new Date();

    return compras
      .filter((compra) => {
        const fecha =
          new Date(compra.fecha);

        return (
          fecha.getMonth() ===
            ahora.getMonth() &&
          fecha.getFullYear() ===
            ahora.getFullYear()
        );
      })
      .reduce(
        (total, compra) =>
          total +
          Number(
            compra.total || 0
          ),
        0
      );
  }, [compras]);

  const registrarCompra = async (
    compra
  ) => {
    if (guardando) return;

    setGuardando(true);

    let compraRegistrada;

    try {
      compraRegistrada =
        await registrarCompraRemota(
          compra
        );

      const [
        comprasActualizadas,
        inventarioActualizado,
      ] = await Promise.all([
        getComprasRemotas(),
        getProductosRemotos(),
      ]);

      setCompras(
        comprasActualizadas
      );
      setProductosDisponibles(
        inventarioActualizado
      );
      setErrorSincronizacion("");
    } catch (error) {
      console.error(
        "No se pudo registrar la compra:",
        error
      );

      setErrorSincronizacion(
        error.message ||
          "No se pudo registrar la compra."
      );
      setGuardando(false);
      return;
    }

    registrarActividad({
      accion: "registrar_compra",
      modulo: "Compras",
      entidadId: compraRegistrada.id,
      entidadNombre: `Compra a ${compraRegistrada.proveedor_nombre}`,
      descripcion: `Registró una compra a ${
        compraRegistrada.proveedor_nombre
      } por ${fmtMoney(compraRegistrada.total)}`,
      datosDespues: {
        proveedor: compraRegistrada.proveedor_nombre,
        documento: compraRegistrada.numero_documento || "",
        productos: compraRegistrada.items.length,
        unidades: compraRegistrada.items.reduce(
          (total, item) => total + Number(item.cantidad || 0),
          0
        ),
        total: Number(compraRegistrada.total || 0),
      },
    });

    actualizarProductos?.();
    setDialogo(false);
    setGuardando(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Compras
          </h1>

          <p className="text-muted-foreground">
            Entradas de mercadería y costos de proveedores
          </p>
        </div>

        <Button
          onClick={() =>
            setDialogo(true)
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva compra
        </Button>
      </div>

      {errorSincronizacion && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errorSincronizacion}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-card border-border">
          <p className="text-xs text-muted-foreground">
            Total este mes
          </p>

          <p className="text-2xl font-bold text-primary mt-1">
            {fmtMoney(totalMes)}
          </p>
        </Card>

        <Card className="p-5 bg-card border-border">
          <p className="text-xs text-muted-foreground">
            Compras registradas
          </p>

          <p className="text-2xl font-bold mt-1">
            {compras.length}
          </p>
        </Card>

        <Card className="p-5 bg-card border-border">
          <p className="text-xs text-muted-foreground">
            Unidades ingresadas
          </p>

          <p className="text-2xl font-bold mt-1">
            {compras.reduce(
              (total, compra) =>
                total +
                compra.items.reduce(
                  (
                    suma,
                    item
                  ) =>
                    suma +
                    Number(
                      item.cantidad ||
                        0
                    ),
                  0
                ),
              0
            )}
          </p>
        </Card>
      </div>

      <Card className="p-4 bg-card border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            value={busqueda}
            onChange={(event) =>
              setBusqueda(
                event.target.value
              )
            }
            placeholder="Buscar proveedor, documento o nota..."
            className="pl-10"
          />
        </div>
      </Card>

      <Card className="overflow-hidden border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 text-left">
                  Fecha
                </th>

                <th className="p-4 text-left">
                  Proveedor
                </th>

                <th className="p-4 text-left">
                  Documento
                </th>

                <th className="p-4 text-right">
                  Productos
                </th>

                <th className="p-4 text-right">
                  Total
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {comprasFiltradas.length >
              0 ? (
                comprasFiltradas.map(
                  (compra) => (
                    <tr
                      key={compra.id}
                      className="hover:bg-muted/30"
                    >
                      <td className="p-4 text-primary font-medium whitespace-nowrap">
                        {fmtDateTime(
                          compra.fecha
                        )}
                      </td>

                      <td className="p-4">
                        <p className="font-medium">
                          {
                            compra.proveedor_nombre
                          }
                        </p>
                      </td>

                      <td className="p-4 text-muted-foreground">
                        {compra.numero_documento ||
                          "Sin documento"}
                      </td>

                      <td className="p-4 text-right">
                        {
                          compra.items.length
                        }
                      </td>

                      <td className="p-4 text-right font-bold">
                        {fmtMoney(
                          compra.total
                        )}
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="p-16 text-center text-muted-foreground"
                  >
                    <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-25" />

                    <p className="font-medium">
                      No hay compras para mostrar
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {dialogo && (
        <CompraDialog
          productos={productosDisponibles}
          proveedores={proveedores}
          guardando={guardando}
          onClose={() =>
            setDialogo(false)
          }
          onSave={
            registrarCompra
          }
        />
      )}
    </div>
  );
}

function CompraDialog({
  productos,
  proveedores,
  guardando,
  onClose,
  onSave,
}) {
  const [proveedorId, setProveedorId] =
    useState("");

  const [
    numeroDocumento,
    setNumeroDocumento,
  ] = useState("");

  const [notas, setNotas] =
    useState("");

  const [busqueda, setBusqueda] =
    useState("");

  const [items, setItems] =
    useState([]);

  const [error, setError] =
    useState("");

  const productosFiltrados =
    useMemo(() => {
      const texto = busqueda
        .trim()
        .toLowerCase();

      if (!texto) return [];

      return productos
        .filter((producto) =>
          [
            producto.nombre,
            producto.categoria,
            producto.subcategoria,
          ].some((campo) =>
            String(campo || "")
              .toLowerCase()
              .includes(texto)
          )
        )
        .slice(0, 8);
    }, [
      productos,
      busqueda,
    ]);

  const agregarProducto = (
    producto
  ) => {
    if (
      items.some(
        (item) =>
          String(
            item.producto_id
          ) ===
          String(producto.id)
      )
    ) {
      setBusqueda("");
      return;
    }

    setItems([
      ...items,
      {
        id: `${Date.now()}-${Math.random()}`,
        producto_id:
          producto.id,
        nombre:
          producto.nombre,
        cantidad: "1",
        costo_unitario:
          String(
            producto.costo_unitario ||
              0
          ),
      },
    ]);

    setBusqueda("");
  };

  const actualizarItem = (
    id,
    campo,
    valor
  ) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              [campo]: valor,
            }
          : item
      )
    );
  };

  const total = items.reduce(
    (suma, item) =>
      suma +
      Number(
        item.cantidad || 0
      ) *
        Number(
          item.costo_unitario ||
            0
        ),
    0
  );

  const guardar = () => {
    const proveedor =
      proveedores.find(
        (item) =>
          String(item.id) ===
          String(proveedorId)
      );

    if (!proveedor) {
      setError(
        "Selecciona un proveedor."
      );
      return;
    }

    if (items.length === 0) {
      setError(
        "Agrega al menos un producto."
      );
      return;
    }

    const itemsValidos =
      items.map((item) => ({
        ...item,
        cantidad: Number(
          item.cantidad || 0
        ),
        costo_unitario: Number(
          item.costo_unitario ||
            0
        ),
      }));

    if (
      itemsValidos.some(
        (item) =>
          item.cantidad <= 0
      )
    ) {
      setError(
        "Todas las cantidades deben ser mayores que cero."
      );
      return;
    }

    onSave({
      id: Date.now().toString(),
      fecha:
        new Date().toISOString(),
      proveedor_id:
        proveedor.id,
      proveedor_nombre:
        proveedor.nombre,
      numero_documento:
        numeroDocumento.trim(),
      notas: notas.trim(),
      items: itemsValidos,
      total,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-3xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Nueva compra
          </DialogTitle>
        </DialogHeader>

        {proveedores.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-300">
            Primero debes crear un proveedor en la sección Proveedores.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>
                  Proveedor{" "}
                  <span className="text-red-400">
                    *
                  </span>
                </Label>

                <select
                  value={proveedorId}
                  onChange={(event) =>
                    setProveedorId(
                      event.target.value
                    )
                  }
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">
                    Seleccionar proveedor
                  </option>

                  {proveedores.map(
                    (proveedor) => (
                      <option
                        key={
                          proveedor.id
                        }
                        value={
                          proveedor.id
                        }
                      >
                        {
                          proveedor.nombre
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <Label>
                  N° factura / documento
                </Label>

                <Input
                  value={
                    numeroDocumento
                  }
                  onChange={(event) =>
                    setNumeroDocumento(
                      event.target.value
                    )
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>
                Agregar productos
              </Label>

              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  value={busqueda}
                  onChange={(event) =>
                    setBusqueda(
                      event.target.value
                    )
                  }
                  placeholder="Buscar producto..."
                  className="pl-10"
                />

                {productosFiltrados.length >
                  0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
                    {productosFiltrados.map(
                      (producto) => (
                        <button
                          key={
                            producto.id
                          }
                          type="button"
                          onClick={() =>
                            agregarProducto(
                              producto
                            )
                          }
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left border-b border-border last:border-b-0 hover:bg-muted"
                        >
                          <div>
                            <p className="font-medium">
                              {
                                producto.nombre
                              }
                            </p>

                            <p className="text-xs text-muted-foreground">
                              Stock:{" "}
                              {
                                producto.stock_actual
                              }
                            </p>
                          </div>

                          <Plus className="w-4 h-4 text-primary" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <Card
                  key={item.id}
                  className="p-4 bg-muted/15 border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">
                          {
                            item.nombre
                          }
                        </p>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItems(
                              items.filter(
                                (
                                  actual
                                ) =>
                                  actual.id !==
                                  item.id
                              )
                            )
                          }
                          className="text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label>
                            Cantidad
                          </Label>

                          <NumericInput
                            min={1}
                            value={
                              item.cantidad
                            }
                            onValueChange={(
                              valor
                            ) =>
                              actualizarItem(
                                item.id,
                                "cantidad",
                                valor
                              )
                            }
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>
                            Costo unitario
                          </Label>

                          <NumericInput
                            min={0}
                            value={
                              item.costo_unitario
                            }
                            onValueChange={(
                              valor
                            ) =>
                              actualizarItem(
                                item.id,
                                "costo_unitario",
                                valor
                              )
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <p className="text-right font-bold text-primary mt-3">
                        {fmtMoney(
                          Number(
                            item.cantidad ||
                              0
                          ) *
                            Number(
                              item.costo_unitario ||
                                0
                            )
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div>
              <Label>Notas</Label>

              <Input
                value={notas}
                onChange={(event) =>
                  setNotas(
                    event.target.value
                  )
                }
                placeholder="Observaciones de la compra"
                className="mt-1"
              />
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between">
              <span className="font-medium">
                Total de la compra
              </span>

              <span className="text-3xl font-bold text-primary">
                {fmtMoney(total)}
              </span>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            onClick={guardar}
            disabled={
              proveedores.length === 0 ||
              guardando
            }
          >
            {guardando
              ? "Registrando..."
              : "Registrar compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}