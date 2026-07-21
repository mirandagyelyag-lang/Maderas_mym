import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Package,
  Search,
  ShoppingCart,
  Boxes,
  ScanLine,
  Keyboard,
  X,
  Minus,
  Plus,
  Trash2,
  UserRound,
  CreditCard,
  Check,
  Loader2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import ProductCard from "@/components/ProductCard";
import BarcodeScannerDialog from "@/components/BarcodeScannerDialog";

import { fmtMoney } from "@/lib/format";

import {
  generarId,
  getClientes,
  getProductos,
  getVentas,
  saveProductos,
  saveVentas,
} from "@/lib/database";

import {
  TIPOS_MOVIMIENTO,
  registrarMovimientoInventario,
} from "@/lib/inventoryMovements";

const categorias = [
  "Todos",
  "Madera Bruta",
  "Madera Impregnada",
  "Planchas",
  "Accesorios",
];

const metodosPago = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Cuenta Corriente",
];

const normalizarCodigo = (valor) =>
  String(valor || "")
    .trim()
    .replace(/\s+/g, "");

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

export default function Vender({
  productos = [],
  actualizarProductos,
  actualizarVentas,
}) {
  const lectorBufferRef = useRef("");
  const lectorTiempoRef = useRef(0);
  const mensajeTimeoutRef = useRef(null);
  const ultimoCodigoRef = useRef({
    codigo: "",
    fecha: 0,
  });

  const [categoria, setCategoria] =
    useState("Todos");

  const [search, setSearch] =
    useState("");

  const [scannerAbierto, setScannerAbierto] =
    useState(false);

  const [mensajeCodigo, setMensajeCodigo] =
    useState("");

  const [carrito, setCarrito] =
    useState([]);

  const [cliente, setCliente] =
    useState("");

  const [clienteId, setClienteId] =
    useState("");

  const [
    buscadorClienteAbierto,
    setBuscadorClienteAbierto,
  ] = useState(false);

  const [metodoPago, setMetodoPago] =
    useState("Efectivo");

  const [observaciones, setObservaciones] =
    useState("");

  const [guardando, setGuardando] =
    useState(false);

  const [ventaGuardada, setVentaGuardada] =
    useState(false);

  const [mensajeError, setMensajeError] =
    useState("");

  const productosActivos = useMemo(
    () =>
      productos.filter(
        (producto) =>
          producto.activo !== false
      ),
    [productos]
  );

  const clientes = useMemo(
    () => getClientes(),
    []
  );

  const clientesFiltrados = useMemo(() => {
    const texto =
      normalizarTexto(cliente);

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
          normalizarTexto(
            campo
          ).includes(texto)
        )
      )
      .slice(0, 6);
  }, [clientes, cliente]);

  const mostrarMensajeCodigo = (
    mensaje
  ) => {
    if (
      mensajeTimeoutRef.current
    ) {
      window.clearTimeout(
        mensajeTimeoutRef.current
      );
    }

    setMensajeCodigo(mensaje);

    mensajeTimeoutRef.current =
      window.setTimeout(() => {
        setMensajeCodigo("");
        mensajeTimeoutRef.current =
          null;
      }, 5000);
  };

  useEffect(() => {
    return () => {
      if (
        mensajeTimeoutRef.current
      ) {
        window.clearTimeout(
          mensajeTimeoutRef.current
        );
      }
    };
  }, []);

  const agregarProducto = (
    producto
  ) => {
    const stockDisponible =
      Number(
        producto.stock_actual || 0
      );

    if (stockDisponible <= 0) {
      mostrarMensajeCodigo(
        `${producto.nombre} está sin stock.`
      );
      return;
    }

    setMensajeError("");

    setCarrito((actual) => {
      const existente =
        actual.find(
          (item) =>
            String(item.producto.id) ===
            String(producto.id)
        );

      if (existente) {
        if (
          existente.cantidad >=
          stockDisponible
        ) {
          mostrarMensajeCodigo(
            `No puedes agregar más unidades de ${producto.nombre}.`
          );

          return actual;
        }

        return actual.map((item) =>
          String(item.producto.id) ===
          String(producto.id)
            ? {
                ...item,
                cantidad:
                  item.cantidad + 1,
              }
            : item
        );
      }

      return [
        ...actual,
        {
          producto,
          cantidad: 1,
        },
      ];
    });
  };

  const cambiarCantidad = (
    productoId,
    nuevaCantidad
  ) => {
    setCarrito((actual) =>
      actual
        .map((item) => {
          if (
            String(
              item.producto.id
            ) !==
            String(productoId)
          ) {
            return item;
          }

          const maximo = Number(
            item.producto
              .stock_actual || 0
          );

          return {
            ...item,
            cantidad: Math.max(
              1,
              Math.min(
                maximo,
                nuevaCantidad
              )
            ),
          };
        })
        .filter(
          (item) =>
            item.cantidad > 0
        )
    );
  };

  const quitarProducto = (
    productoId
  ) => {
    setCarrito((actual) =>
      actual.filter(
        (item) =>
          String(
            item.producto.id
          ) !==
          String(productoId)
      )
    );
  };

  const limpiarVenta = () => {
    setCarrito([]);
    setCliente("");
    setClienteId("");
    setMetodoPago("Efectivo");
    setObservaciones("");
    setMensajeError("");
    setVentaGuardada(false);
  };

  const buscarPorCodigo = (
    codigoLeido
  ) => {
    const codigo =
      normalizarCodigo(
        codigoLeido
      );

    if (!codigo) return false;

    const ahora = Date.now();

    if (
      ultimoCodigoRef.current
        .codigo === codigo &&
      ahora -
        ultimoCodigoRef.current
          .fecha <
        1800
    ) {
      return false;
    }

    ultimoCodigoRef.current = {
      codigo,
      fecha: ahora,
    };

    const producto =
      productosActivos.find(
        (item) =>
          normalizarCodigo(
            item.codigo_barras
          ) === codigo
      );

    if (!producto) {
      setSearch(codigo);

      mostrarMensajeCodigo(
        `No existe un producto registrado con el código ${codigo}.`
      );

      return false;
    }

    agregarProducto(producto);
    setSearch("");
    setCategoria("Todos");

    return true;
  };

  useEffect(() => {
    const manejarLectorUSB = (
      event
    ) => {
      const objetivo =
        event.target;

      const escribiendoEnCampo =
        objetivo instanceof
          HTMLInputElement ||
        objetivo instanceof
          HTMLTextAreaElement ||
        objetivo instanceof
          HTMLSelectElement ||
        objetivo?.isContentEditable;

      if (
        escribiendoEnCampo ||
        scannerAbierto
      ) {
        return;
      }

      const ahora = Date.now();

      if (
        ahora -
          lectorTiempoRef.current >
        90
      ) {
        lectorBufferRef.current =
          "";
      }

      lectorTiempoRef.current =
        ahora;

      if (
        event.key === "Enter"
      ) {
        const codigo =
          lectorBufferRef.current;

        lectorBufferRef.current =
          "";

        if (codigo.length >= 4) {
          buscarPorCodigo(codigo);
        }

        return;
      }

      if (
        event.key.length === 1
      ) {
        lectorBufferRef.current +=
          event.key;
      }
    };

    window.addEventListener(
      "keydown",
      manejarLectorUSB
    );

    return () =>
      window.removeEventListener(
        "keydown",
        manejarLectorUSB
      );
  }, [
    productosActivos,
    scannerAbierto,
  ]);

  const productosFiltrados =
    useMemo(
      () =>
        productosActivos.filter(
          (producto) => {
            const coincideCategoria =
              categoria ===
                "Todos" ||
              producto.categoria ===
                categoria;

            const texto =
              normalizarTexto(search);

            const campos = [
              producto.nombre,
              producto.subcategoria,
              producto.categoria,
              producto.unidad_medida,
              producto.codigo_barras,
            ].map(normalizarTexto);

            const coincideBusqueda =
              texto === "" ||
              campos.some(
                (campo) =>
                  campo.includes(
                    texto
                  )
              );

            return (
              coincideCategoria &&
              coincideBusqueda
            );
          }
        ),
      [
        productosActivos,
        categoria,
        search,
      ]
    );

  const productosConStock =
    productosActivos.filter(
      (producto) =>
        Number(
          producto.stock_actual ||
            0
        ) > 0
    ).length;

  const productosAgotados =
    productosActivos.length -
    productosConStock;

  const totalVenta =
    carrito.reduce(
      (total, item) =>
        total +
        item.cantidad *
          Number(
            item.producto
              .precio_unitario || 0
          ),
      0
    );

  const totalProductos =
    carrito.reduce(
      (total, item) =>
        total + item.cantidad,
      0
    );

  const registrarVenta = () => {
    if (
      guardando ||
      carrito.length === 0
    ) {
      return;
    }

    setMensajeError("");
    setGuardando(true);

    try {
      const inventarioActual =
        getProductos();

      const ventasActuales =
        getVentas();

      const fecha =
        new Date().toISOString();

      const grupoVentaId =
        generarId();

      const clienteGuardado =
        clientes.find(
          (item) =>
            String(item.id) ===
            String(clienteId)
        );

      for (const item of carrito) {
        const productoActual =
          inventarioActual.find(
            (producto) =>
              String(
                producto.id
              ) ===
              String(
                item.producto.id
              )
          );

        const stockActual =
          Number(
            productoActual
              ?.stock_actual || 0
          );

        if (
          item.cantidad >
          stockActual
        ) {
          throw new Error(
            `No hay suficiente stock de ${item.producto.nombre}.`
          );
        }
      }

      const nuevasVentas =
        carrito.map((item) => {
          const precioUnitario =
            Number(
              item.producto
                .precio_unitario ||
                0
            );

          return {
            id: generarId(),
            venta_grupo_id:
              grupoVentaId,
            fecha,
            producto_id:
              item.producto.id,
            nombre_producto:
              item.producto
                .nombre,
            categoria:
              item.producto
                .categoria || "",
            cantidad:
              item.cantidad,
            precio_unitario:
              precioUnitario,
            costo_unitario:
              Number(
                item.producto
                  .costo_unitario ||
                  0
              ),
            total:
              item.cantidad *
              precioUnitario,
            total_venta:
              totalVenta,
            metodo_pago:
              metodoPago,
            cliente:
              cliente.trim(),
            cliente_id:
              clienteGuardado?.id ||
              "",
            telefono_cliente:
              clienteGuardado
                ?.telefono_whatsapp ||
              "",
            email_cliente:
              clienteGuardado
                ?.email || "",
            direccion_cliente:
              clienteGuardado
                ?.direccion || "",
            rut_cliente:
              clienteGuardado
                ?.rut_dni || "",
            observaciones:
              observaciones.trim(),
          };
        });

      const inventarioActualizado =
        inventarioActual.map(
          (producto) => {
            const item =
              carrito.find(
                (linea) =>
                  String(
                    linea.producto.id
                  ) ===
                  String(
                    producto.id
                  )
              );

            if (!item) {
              return producto;
            }

            return {
              ...producto,
              stock_actual:
                Number(
                  producto.stock_actual ||
                    0
                ) -
                item.cantidad,
            };
          }
        );

      saveVentas([
        ...ventasActuales,
        ...nuevasVentas,
      ]);

      saveProductos(
        inventarioActualizado
      );

      carrito.forEach((item) => {
        const stockAnterior =
          Number(
            item.producto
              .stock_actual || 0
          );

        registrarMovimientoInventario(
          {
            productoId:
              item.producto.id,
            productoNombre:
              item.producto
                .nombre,
            tipo:
              TIPOS_MOVIMIENTO.VENTA,
            cantidad:
              item.cantidad,
            stockAnterior,
            stockNuevo:
              stockAnterior -
              item.cantidad,
            motivo:
              cliente.trim()
                ? `Venta a ${cliente.trim()}`
                : "Venta registrada",
            referenciaId:
              grupoVentaId,
            referenciaTipo:
              "venta",
          }
        );
      });

      actualizarProductos?.();
      actualizarVentas?.();

      setVentaGuardada(true);

      window.setTimeout(() => {
        limpiarVenta();
      }, 2500);
    } catch (error) {
      console.error(
        "Error al registrar venta:",
        error
      );

      setMensajeError(
        error.message ||
          "No se pudo registrar la venta."
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl font-bold">
              Registrar venta
            </h1>

            <p className="text-muted-foreground text-sm mt-0.5">
              Haz clic en los productos vendidos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMensajeCodigo("");
              setScannerAbierto(true);
            }}
            className="h-auto px-4 py-3"
          >
            <ScanLine className="w-4 h-4 mr-2" />
            Escanear código
          </Button>

          <Card className="px-4 py-3 bg-card border-border">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />

              <div>
                <p className="text-[11px] text-muted-foreground">
                  Disponibles
                </p>

                <p className="font-semibold text-sm">
                  {productosConStock}
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-4 py-3 bg-card border-border">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-destructive" />

              <div>
                <p className="text-[11px] text-muted-foreground">
                  Agotados
                </p>

                <p className="font-semibold text-sm">
                  {productosAgotados}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {ventaGuardada && (
        <Card className="mb-6 border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-3 text-emerald-400">
            <Check className="w-6 h-6" />

            <div>
              <p className="font-semibold">
                Venta registrada correctamente
              </p>

              <p className="text-sm opacity-80">
                El stock y el historial fueron actualizados.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_390px] gap-6 items-start">
        <div>
          <Card className="p-4 md:p-5 bg-card border-border mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  className="pl-10 pr-10 h-11"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      buscarPorCodigo(
                        search
                      );
                    }
                  }}
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <Keyboard className="w-4 h-4 text-primary" />
                <span>
                  Lector USB listo
                </span>
              </div>
            </div>

            {mensajeCodigo && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                {mensajeCodigo}
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
              {categorias.map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setCategoria(cat)
                    }
                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                      categoria ===
                      cat
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {
                productosFiltrados.length
              }{" "}
              producto
              {productosFiltrados.length ===
              1
                ? ""
                : "s"}
            </p>

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="text-xs text-primary hover:underline"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>

          {productosFiltrados.length ===
          0 ? (
            <Card className="flex flex-col items-center py-16 bg-card border-border text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-40" />

              <p className="font-medium">
                No hay productos disponibles
              </p>

              <p className="text-xs mt-1">
                Prueba otra búsqueda, categoría o código
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-4 gap-3 md:gap-4">
              {productosFiltrados.map(
                (producto) => (
                  <ProductCard
                    key={
                      producto.id
                    }
                    product={
                      producto
                    }
                    onClick={
                      agregarProducto
                    }
                  />
                )
              )}
            </div>
          )}
        </div>

        <Card className="bg-card border-border xl:sticky xl:top-6 overflow-hidden">
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg">
                  Venta actual
                </h2>

                <p className="text-xs text-muted-foreground mt-1">
                  {totalProductos} producto
                  {totalProductos === 1
                    ? ""
                    : "s"}
                </p>
              </div>

              {carrito.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={
                    limpiarVenta
                  }
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {carrito.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <ShoppingCart className="w-11 h-11 opacity-30 mb-3" />

                <p className="font-medium">
                  Aún no agregas productos
                </p>

                <p className="text-xs mt-1 max-w-[220px]">
                  Haz clic en un producto para añadirlo a esta venta.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[330px] overflow-y-auto pr-1">
                {carrito.map(
                  (item) => (
                    <div
                      key={
                        item.producto.id
                      }
                      className="rounded-xl border border-border bg-muted/15 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {
                              item.producto
                                .nombre
                            }
                          </p>

                          <p className="text-xs text-muted-foreground mt-1">
                            {fmtMoney(
                              item.producto
                                .precio_unitario
                            )}{" "}
                            c/u
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            quitarProducto(
                              item.producto
                                .id
                            )
                          }
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Quitar ${item.producto.nombre}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              cambiarCantidad(
                                item.producto
                                  .id,
                                item.cantidad -
                                  1
                              )
                            }
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>

                          <span className="w-7 text-center font-semibold">
                            {
                              item.cantidad
                            }
                          </span>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              cambiarCantidad(
                                item.producto
                                  .id,
                                item.cantidad +
                                  1
                              )
                            }
                            disabled={
                              item.cantidad >=
                              Number(
                                item.producto
                                  .stock_actual ||
                                  0
                              )
                            }
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <span className="font-semibold text-primary">
                          {fmtMoney(
                            item.cantidad *
                              Number(
                                item.producto
                                  .precio_unitario ||
                                  0
                              )
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {carrito.length > 0 && (
              <>
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="relative">
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
                        onChange={(
                          event
                        ) => {
                          setCliente(
                            event.target
                              .value
                          );

                          setClienteId(
                            ""
                          );

                          setBuscadorClienteAbierto(
                            true
                          );
                        }}
                        placeholder="Escribir o buscar cliente"
                        className="pl-10"
                      />
                    </div>

                    {buscadorClienteAbierto && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl">
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
                                className="w-full px-3 py-2.5 text-left border-b border-border last:border-b-0 hover:bg-muted"
                              >
                                <p className="font-medium text-sm">
                                  {
                                    clienteGuardado.nombre
                                  }
                                </p>

                                {clienteGuardado.telefono_whatsapp && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {
                                      clienteGuardado.telefono_whatsapp
                                    }
                                  </p>
                                )}
                              </button>
                            )
                          )
                        ) : (
                          <p className="p-3 text-xs text-muted-foreground text-center">
                            Puedes usar ese nombre igualmente.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>
                      Método de pago
                    </Label>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {metodosPago.map(
                        (metodo) => (
                          <button
                            key={
                              metodo
                            }
                            type="button"
                            onClick={() =>
                              setMetodoPago(
                                metodo
                              )
                            }
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition ${
                              metodoPago ===
                              metodo
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            {metodo}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>
                      Observaciones{" "}
                      <span className="text-xs text-muted-foreground">
                        (opcional)
                      </span>
                    </Label>

                    <Input
                      value={
                        observaciones
                      }
                      onChange={(event) =>
                        setObservaciones(
                          event.target
                            .value
                        )
                      }
                      placeholder="Ej.: entrega pendiente"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total
                    </span>

                    <span className="text-2xl font-bold text-primary">
                      {fmtMoney(
                        totalVenta
                      )}
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
                  onClick={
                    registrarVenta
                  }
                  disabled={
                    guardando ||
                    carrito.length ===
                      0
                  }
                >
                  {guardando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Registrar venta
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

      {scannerAbierto && (
        <BarcodeScannerDialog
          onClose={() =>
            setScannerAbierto(false)
          }
          onDetected={(codigo) => {
            setScannerAbierto(false);

            window.setTimeout(
              () =>
                buscarPorCodigo(
                  codigo
                ),
              50
            );
          }}
        />
      )}
    </div>
  );
}