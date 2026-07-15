import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { jsPDF } from "jspdf";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";

import { fmtMoney } from "@/lib/format";

import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Search,
  Package,
  FileDown,
  X,
  ShoppingCart,
} from "lucide-react";

const estados = [
  "Borrador",
  "Enviada",
  "Aceptada",
  "Rechazada",
];

const calcularTotales = (
  items,
  descuento,
  ivaPorcentaje
) => {
  const subtotal = items.reduce(
    (total, item) =>
      total +
      Number(item.cant || 0) *
        Number(item.precio || 0),
    0
  );

  const porcentajeDescuento = Math.min(
    100,
    Math.max(0, Number(descuento || 0))
  );

  const porcentajeIVA = Math.min(
    100,
    Math.max(0, Number(ivaPorcentaje || 0))
  );

  const montoDescuento =
    subtotal *
    (porcentajeDescuento / 100);

  const neto = Math.max(
    0,
    subtotal - montoDescuento
  );

  const iva =
    neto * (porcentajeIVA / 100);

  const total = neto + iva;

  return {
    subtotal,
    descuento:
      descuento === ""
        ? ""
        : porcentajeDescuento,
    monto_descuento:
      montoDescuento,
    neto,
    iva_porcentaje:
      ivaPorcentaje === ""
        ? ""
        : porcentajeIVA,
    iva,
    total,
  };
};

const limpiarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

export default function CotizacionDetalle({
  actualizarProductos,
  actualizarVentas,
  actualizarCotizaciones,
}) {
  const { id } = useParams();
  const navigate = useNavigate();

  const buscadorRef = useRef(null);
  const inputBusquedaRef = useRef(null);

  const [cotizacion, setCotizacion] =
    useState(null);

  const [productos, setProductos] =
    useState([]);

  const [busquedaProducto, setBusquedaProducto] =
    useState("");

  const [buscadorAbierto, setBuscadorAbierto] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  useEffect(() => {
    try {
      const todas = JSON.parse(
        localStorage.getItem(
          "cotizaciones"
        ) || "[]"
      );

      const inventario = JSON.parse(
        localStorage.getItem(
          "inventario"
        ) || "[]"
      );

      const encontrada = todas.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

      if (!encontrada) {
        navigate("/cotizaciones");
        return;
      }

      const items = (
        encontrada.items || []
      ).map((item, index) => ({
        id:
          item.id ||
          `${Date.now()}-${index}`,
        producto_id:
          item.producto_id || "",
        desc: item.desc || "",
        unidad:
          item.unidad ||
          item.unidad_medida ||
          "Unidad",
        cant:
          item.cant === undefined
            ? "1"
            : String(item.cant),
        precio:
          item.precio === undefined
            ? ""
            : String(item.precio),
      }));

      const descuentoInicial =
        encontrada.descuento === undefined
          ? ""
          : String(
              encontrada.descuento
            );

      const ivaInicial =
        encontrada.iva_porcentaje ===
        undefined
          ? "19"
          : String(
              encontrada.iva_porcentaje
            );

      const totales = calcularTotales(
        items,
        descuentoInicial,
        ivaInicial
      );

      setCotizacion({
        ...encontrada,
        nombre_cliente:
          encontrada.nombre_cliente || "",
        estado:
          encontrada.estado ||
          "Borrador",
        validez_dias:
          encontrada.validez_dias ===
          undefined
            ? "15"
            : String(
                encontrada.validez_dias
              ),
        descuento:
          descuentoInicial,
        iva_porcentaje:
          ivaInicial,
        items,
        ...totales,
      });

      setProductos(
        inventario.filter(
          (producto) =>
            producto.activo !== false
        )
      );
    } catch (error) {
      console.error(
        "Error cargando cotización:",
        error
      );

      navigate("/cotizaciones");
    }
  }, [id, navigate]);

  useEffect(() => {
    const cerrarBuscador = (event) => {
      if (
        buscadorRef.current &&
        !buscadorRef.current.contains(
          event.target
        )
      ) {
        setBuscadorAbierto(false);
      }
    };

    document.addEventListener(
      "mousedown",
      cerrarBuscador
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        cerrarBuscador
      );
    };
  }, []);

  const actualizarCotizacion = (
    cambios
  ) => {
    setCotizacion((actual) => {
      if (!actual) return actual;

      const siguiente = {
        ...actual,
        ...cambios,
      };

      const totales = calcularTotales(
        siguiente.items || [],
        siguiente.descuento,
        siguiente.iva_porcentaje
      );

      return {
        ...siguiente,
        ...totales,
      };
    });
  };

  const mostrarMensaje = (
    texto,
    duracion = 2200
  ) => {
    setMensaje(texto);

    window.setTimeout(() => {
      setMensaje("");
    }, duracion);
  };

  const productosFiltrados =
    useMemo(() => {
      const texto = limpiarTexto(
        busquedaProducto
      );

      return productos
        .filter((producto) => {
          if (!texto) return true;

          return [
            producto.nombre,
            producto.categoria,
            producto.subcategoria,
            producto.unidad_medida,
          ].some((campo) =>
            limpiarTexto(campo).includes(
              texto
            )
          );
        })
        .slice(0, 8);
    }, [
      productos,
      busquedaProducto,
    ]);

  const agregarProducto = (
    producto
  ) => {
    if (!producto) return;

    setCotizacion((actual) => {
      if (!actual) return actual;

      const indiceExistente =
        actual.items.findIndex(
          (item) =>
            String(item.producto_id) ===
            String(producto.id)
        );

      let itemsActualizados;

      if (indiceExistente !== -1) {
        itemsActualizados =
          actual.items.map(
            (item, index) =>
              index === indiceExistente
                ? {
                    ...item,
                    cant: String(
                      Number(
                        item.cant || 0
                      ) + 1
                    ),
                  }
                : item
          );
      } else {
        const nuevoItem = {
          id: `${Date.now()}-${Math.random()}`,
          producto_id: producto.id,
          desc: producto.nombre,
          unidad:
            producto.unidad_medida ||
            "Unidad",
          cant: "1",
          precio: String(
            producto.precio_unitario ||
              ""
          ),
          stock_disponible: Number(
            producto.stock_actual || 0
          ),
        };

        itemsActualizados = [
          ...actual.items,
          nuevoItem,
        ];
      }

      const siguiente = {
        ...actual,
        items: itemsActualizados,
      };

      const totales = calcularTotales(
        siguiente.items,
        siguiente.descuento,
        siguiente.iva_porcentaje
      );

      return {
        ...siguiente,
        ...totales,
      };
    });

    const yaExistia =
      cotizacion?.items.some(
        (item) =>
          String(item.producto_id) ===
          String(producto.id)
      );

    mostrarMensaje(
      yaExistia
        ? `${producto.nombre}: cantidad aumentada`
        : `${producto.nombre} agregado`
    );

    setBusquedaProducto("");
    setBuscadorAbierto(false);

    window.setTimeout(() => {
      inputBusquedaRef.current?.focus();
    }, 0);
  };

  const agregarItemManual = () => {
    const nuevoItem = {
      id: `${Date.now()}-${Math.random()}`,
      producto_id: "",
      desc: "",
      unidad: "Unidad",
      cant: "1",
      precio: "",
    };

    actualizarCotizacion({
      items: [
        ...cotizacion.items,
        nuevoItem,
      ],
    });
  };

  const eliminarItem = (itemId) => {
    actualizarCotizacion({
      items: cotizacion.items.filter(
        (item) => item.id !== itemId
      ),
    });
  };

  const actualizarItem = (
    itemId,
    campo,
    valor
  ) => {
    const itemsActualizados =
      cotizacion.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          [campo]: valor,
        };
      });

    actualizarCotizacion({
      items: itemsActualizados,
    });
  };

  const handleSave = () => {
    if (guardando) return;

    if (!cotizacion.nombre_cliente.trim()) {
      mostrarMensaje(
        "Debes escribir el nombre del cliente antes de guardar."
      );

      window.setTimeout(() => {
        document
          .getElementById("nombre-cliente")
          ?.focus();
      }, 0);

      return;
    }

    setGuardando(true);

    try {
      const todas = JSON.parse(
        localStorage.getItem(
          "cotizaciones"
        ) || "[]"
      );

      const index = todas.findIndex(
        (item) =>
          String(item.id) ===
          String(id)
      );

      if (index === -1) {
        mostrarMensaje(
          "No se encontró esta cotización."
        );
        return;
      }

      const cotizacionGuardada = {
        ...cotizacion,
        validez_dias: Number(
          cotizacion.validez_dias ||
            1
        ),
        descuento: Number(
          cotizacion.descuento || 0
        ),
        iva_porcentaje: Number(
          cotizacion.iva_porcentaje ||
            0
        ),
        items:
          cotizacion.items.map(
            (item) => ({
              ...item,
              cant: Number(
                item.cant || 0
              ),
              precio: Number(
                item.precio || 0
              ),
            })
          ),
        fecha_actualizacion:
          new Date().toISOString(),
      };

      todas[index] =
        cotizacionGuardada;

      localStorage.setItem(
        "cotizaciones",
        JSON.stringify(todas)
      );

      setCotizacion({
        ...cotizacionGuardada,
        validez_dias: String(
          cotizacionGuardada
            .validez_dias
        ),
        descuento: String(
          cotizacionGuardada
            .descuento
        ),
        iva_porcentaje: String(
          cotizacionGuardada
            .iva_porcentaje
        ),
        items:
          cotizacionGuardada.items.map(
            (item) => ({
              ...item,
              cant: String(item.cant),
              precio: String(
                item.precio
              ),
            })
          ),
      });

      setMensaje(
        "Cotización guardada correctamente"
      );

      window.setTimeout(() => {
        navigate("/cotizaciones");
      }, 1200);
    } catch (error) {
      console.error(
        "Error guardando cotización:",
        error
      );

      mostrarMensaje(
        "No se pudo guardar la cotización"
      );
    } finally {
      setGuardando(false);
    }
  };

  const convertirEnVenta = () => {
    if (guardando) return;

    if (!cotizacion.nombre_cliente.trim()) {
      mostrarMensaje(
        "Debes escribir el nombre del cliente antes de convertir la cotización."
      );

      window.setTimeout(() => {
        document
          .getElementById("nombre-cliente")
          ?.focus();
      }, 0);

      return;
    }

    if (cotizacion.estado !== "Aceptada") {
      mostrarMensaje(
        'La cotización debe estar en estado "Aceptada" antes de convertirla.'
      );
      return;
    }

    if (cotizacion.convertida_en_venta) {
      mostrarMensaje(
        "Esta cotización ya fue convertida en venta."
      );
      return;
    }

    if (cotizacion.items.length === 0) {
      mostrarMensaje(
        "Agrega al menos un producto antes de convertirla."
      );
      return;
    }

    try {
      const inventario = JSON.parse(
        localStorage.getItem("inventario") || "[]"
      );

      const ventasActuales = JSON.parse(
        localStorage.getItem("ventas") || "[]"
      );

      const cotizaciones = JSON.parse(
        localStorage.getItem("cotizaciones") || "[]"
      );

      const problemasStock = cotizacion.items
        .filter((item) => item.producto_id)
        .map((item) => {
          const producto = inventario.find(
            (productoInventario) =>
              String(productoInventario.id) ===
              String(item.producto_id)
          );

          if (!producto) {
            return `${item.desc}: producto no encontrado`;
          }

          const disponible = Number(
            producto.stock_actual || 0
          );

          const solicitado = Number(
            item.cant || 0
          );

          if (solicitado > disponible) {
            return `${item.desc}: hay ${disponible} y se necesitan ${solicitado}`;
          }

          return null;
        })
        .filter(Boolean);

      if (problemasStock.length > 0) {
        mostrarMensaje(
          `No se puede convertir: ${problemasStock[0]}`,
          3500
        );
        return;
      }

      const factorDescuento =
        1 - Number(cotizacion.descuento || 0) / 100;

      const factorIVA =
        1 + Number(cotizacion.iva_porcentaje || 0) / 100;

      const fechaConversion = new Date().toISOString();

      const nuevasVentas = cotizacion.items.map(
        (item, index) => {
          const producto = inventario.find(
            (productoInventario) =>
              String(productoInventario.id) ===
              String(item.producto_id)
          );

          const cantidad = Number(item.cant || 0);
          const precioUnitario = Number(item.precio || 0);
          const totalItem =
            cantidad *
            precioUnitario *
            factorDescuento *
            factorIVA;

          return {
            id: `${Date.now()}-${index}`,
            fecha: fechaConversion,
            producto_id: item.producto_id || "",
            nombre_producto: item.desc,
            categoria: producto?.categoria || "Cotización",
            cantidad,
            precio_unitario: precioUnitario,
            costo_unitario: Number(
              producto?.costo_unitario || 0
            ),
            total: Math.round(totalItem),
            metodo_pago: "Cotización",
            cliente: cotizacion.nombre_cliente.trim(),
            cotizacion_id: cotizacion.id,
            cotizacion_numero: cotizacion.numero,
          };
        }
      );

      const inventarioActualizado = inventario.map(
        (producto) => {
          const cantidadCotizada = cotizacion.items
            .filter(
              (item) =>
                String(item.producto_id) ===
                String(producto.id)
            )
            .reduce(
              (total, item) =>
                total + Number(item.cant || 0),
              0
            );

          if (cantidadCotizada === 0) {
            return producto;
          }

          return {
            ...producto,
            stock_actual:
              Number(producto.stock_actual || 0) -
              cantidadCotizada,
          };
        }
      );

      const cotizacionConvertida = {
        ...cotizacion,
        convertida_en_venta: true,
        fecha_conversion: fechaConversion,
        estado: "Aceptada",
        ventas_generadas: nuevasVentas.map((venta) => venta.id),
      };

      const cotizacionesActualizadas = cotizaciones.map(
        (item) =>
          String(item.id) === String(cotizacion.id)
            ? {
                ...cotizacionConvertida,
                validez_dias: Number(
                  cotizacionConvertida.validez_dias || 1
                ),
                descuento: Number(
                  cotizacionConvertida.descuento || 0
                ),
                iva_porcentaje: Number(
                  cotizacionConvertida.iva_porcentaje || 0
                ),
                items: cotizacionConvertida.items.map(
                  (productoCotizado) => ({
                    ...productoCotizado,
                    cant: Number(
                      productoCotizado.cant || 0
                    ),
                    precio: Number(
                      productoCotizado.precio || 0
                    ),
                  })
                ),
              }
            : item
      );

      localStorage.setItem(
        "inventario",
        JSON.stringify(inventarioActualizado)
      );

      localStorage.setItem(
        "ventas",
        JSON.stringify([
          ...ventasActuales,
          ...nuevasVentas,
        ])
      );

      localStorage.setItem(
        "cotizaciones",
        JSON.stringify(cotizacionesActualizadas)
      );

      setCotizacion({
        ...cotizacionConvertida,
        validez_dias: String(
          cotizacionConvertida.validez_dias
        ),
        descuento: String(
          cotizacionConvertida.descuento
        ),
        iva_porcentaje: String(
          cotizacionConvertida.iva_porcentaje
        ),
      });

      actualizarProductos?.();
      actualizarVentas?.();
      actualizarCotizaciones?.();

      setMensaje(
        "Cotización convertida en venta correctamente"
      );

      window.setTimeout(() => {
        navigate("/ventas");
      }, 1400);
    } catch (error) {
      console.error(
        "Error convirtiendo la cotización:",
        error
      );

      mostrarMensaje(
        "No se pudo convertir la cotización en venta"
      );
    }
  };

  const descargarPDF = () => {
    if (!cotizacion.nombre_cliente.trim()) {
      mostrarMensaje(
        "Debes escribir el nombre del cliente antes de descargar el PDF."
      );

      window.setTimeout(() => {
        document
          .getElementById("nombre-cliente")
          ?.focus();
      }, 0);

      return;
    }

    try {
      const doc = new jsPDF();

      const numero = String(
        cotizacion.numero
      ).padStart(4, "0");

      doc.setFontSize(20);
      doc.text(
        "Maderas M&M",
        20,
        20
      );

      doc.setFontSize(14);
      doc.text(
        `Cotización N° ${numero}`,
        20,
        32
      );

      doc.setFontSize(10);
      doc.text(
        `Cliente: ${
          cotizacion.nombre_cliente ||
          "Sin cliente"
        }`,
        20,
        42
      );

      doc.text(
        `Fecha: ${
          cotizacion.fecha
        }`,
        20,
        49
      );

      doc.text(
        `Validez: ${
          cotizacion.validez_dias
        } días`,
        20,
        56
      );

      let y = 70;

      doc.setFontSize(10);
      doc.text(
        "Producto",
        20,
        y
      );

      doc.text(
        "Cant.",
        105,
        y
      );

      doc.text(
        "Unidad",
        125,
        y
      );

      doc.text(
        "Precio",
        155,
        y
      );

      doc.line(
        20,
        y + 3,
        190,
        y + 3
      );

      y += 10;

      cotizacion.items.forEach(
        (item) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }

          const descripcion =
            String(
              item.desc || ""
            ).slice(0, 36);

          doc.text(
            descripcion,
            20,
            y
          );

          doc.text(
            String(
              Number(
                item.cant || 0
              )
            ),
            105,
            y
          );

          doc.text(
            String(
              item.unidad ||
              "Unidad"
            ).slice(0, 12),
            125,
            y
          );

          doc.text(
            fmtMoney(
              Number(
                item.precio || 0
              )
            ),
            155,
            y
          );

          y += 8;
        }
      );

      y += 6;

      doc.line(
        110,
        y,
        190,
        y
      );

      y += 8;

      doc.text(
        `Subtotal: ${fmtMoney(
          cotizacion.subtotal
        )}`,
        120,
        y
      );

      y += 7;

      doc.text(
        `Descuento: ${Number(
          cotizacion.descuento ||
            0
        )}%`,
        120,
        y
      );

      y += 7;

      doc.text(
        `IVA: ${Number(
          cotizacion.iva_porcentaje ||
            0
        )}%`,
        120,
        y
      );

      y += 9;

      doc.setFontSize(13);
      doc.text(
        `TOTAL: ${fmtMoney(
          cotizacion.total
        )}`,
        120,
        y
      );

      doc.save(
        `cotizacion-${numero}.pdf`
      );

      mostrarMensaje(
        "PDF descargado correctamente"
      );
    } catch (error) {
      console.error(
        "Error generando PDF:",
        error
      );

      mostrarMensaje(
        "No se pudo generar el PDF"
      );
    }
  };

  const subtotalItems = useMemo(
    () =>
      cotizacion?.items.map(
        (item) => ({
          ...item,
          total:
            Number(
              item.cant || 0
            ) *
            Number(
              item.precio || 0
            ),
        })
      ) || [],
    [cotizacion?.items]
  );

  if (!cotizacion) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const esConvertida = Boolean(
    cotizacion.convertida_en_venta
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto text-white">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Cotización N°{" "}
            {String(
              cotizacion.numero
            ).padStart(4, "0")}
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            {esConvertida
              ? "Cotización convertida y bloqueada"
              : "Edita los datos y guarda los cambios"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigate("/cotizaciones")
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>

          <Button
            variant="outline"
            onClick={descargarPDF}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>

          <Button
            type="button"
            onClick={convertirEnVenta}
            disabled={
              guardando ||
              cotizacion.convertida_en_venta
            }
            className={
              cotizacion.convertida_en_venta
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {cotizacion.convertida_en_venta
              ? "Ya convertida"
              : "Convertir en venta"}
          </Button>

          {!esConvertida && (
            <Button
              onClick={handleSave}
              disabled={guardando}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {guardando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}

              Guardar
            </Button>
          )}
        </div>
      </div>

      {mensaje && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{mensaje}</span>
        </div>
      )}

      {esConvertida && (
        <Card className="mb-4 p-5 border-emerald-500/30 bg-emerald-500/10">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="flex-1">
              <p className="font-semibold text-emerald-300">
                Cotización convertida en venta
              </p>

              <p className="text-sm text-emerald-100/70 mt-1">
                Cliente: {cotizacion.nombre_cliente}
                {" · "}
                {cotizacion.fecha_conversion
                  ? new Date(
                      cotizacion.fecha_conversion
                    ).toLocaleString("es-CL")
                  : "Fecha no disponible"}
              </p>

              <p className="text-xs text-emerald-100/60 mt-1">
                Se generaron{" "}
                {(cotizacion.ventas_generadas || []).length ||
                  cotizacion.items.length}{" "}
                registro(s) de venta. Esta cotización ya no puede editarse.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>
              Cliente{" "}
              <span className="text-red-400">*</span>
            </Label>

            <Input
              id="nombre-cliente"
              required
              disabled={esConvertida}
              value={
                cotizacion.nombre_cliente
              }
              onChange={(event) =>
                actualizarCotizacion({
                  nombre_cliente:
                    event.target.value,
                })
              }
              placeholder="Nombre del cliente"
              className="bg-zinc-950 border-zinc-800 mt-1"
            />

            <p className="text-xs text-zinc-500 mt-1">
              Campo obligatorio
            </p>
          </div>

          <div>
            <Label>Estado</Label>

            <select
              className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-md px-3 mt-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-700"
              disabled={esConvertida}
              value={
                cotizacion.estado
              }
              onChange={(event) =>
                actualizarCotizacion({
                  estado:
                    event.target.value,
                })
              }
            >
              {estados.map(
                (estado) => (
                  <option
                    key={estado}
                    value={estado}
                  >
                    {estado}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <Label>Fecha</Label>

            <Input
              type="date"
              disabled={esConvertida}
              value={
                cotizacion.fecha
              }
              onChange={(event) =>
                actualizarCotizacion({
                  fecha:
                    event.target.value,
                })
              }
              className="bg-zinc-950 border-zinc-800 mt-1 [color-scheme:dark]"
            />
          </div>

          <div>
            <Label>Validez</Label>

            <div className="flex items-center gap-2 mt-1">
              <NumericInput
                min={1}
                disabled={esConvertida}
                value={
                  cotizacion.validez_dias
                }
                onValueChange={(valor) =>
                  actualizarCotizacion({
                    validez_dias:
                      valor,
                  })
                }
                className="bg-zinc-950 border-zinc-800"
              />

              <span className="text-sm text-muted-foreground whitespace-nowrap">
                días
              </span>
            </div>
          </div>
        </div>

        {!esConvertida && (
        <div
          ref={buscadorRef}
          className="relative p-4 rounded-lg border border-zinc-800 bg-zinc-950/60"
        >
          <Label>
            Buscar producto del inventario
          </Label>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />

            <Input
              ref={inputBusquedaRef}
              value={busquedaProducto}
              onFocus={() =>
                setBuscadorAbierto(true)
              }
              onChange={(event) => {
                setBusquedaProducto(
                  event.target.value
                );
                setBuscadorAbierto(true);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  productosFiltrados.length > 0
                ) {
                  event.preventDefault();
                  agregarProducto(
                    productosFiltrados[0]
                  );
                }
              }}
              placeholder="Escribe nombre, categoría o medida..."
              className="bg-zinc-950 border-zinc-800 pl-10 pr-10"
            />

            {busquedaProducto && (
              <button
                type="button"
                onClick={() =>
                  setBusquedaProducto("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {buscadorAbierto && (
            <div className="absolute left-4 right-4 top-full mt-2 z-30 max-h-80 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              {productosFiltrados.length >
              0 ? (
                productosFiltrados.map(
                  (producto) => (
                    <button
                      key={producto.id}
                      type="button"
                      onClick={() =>
                        agregarProducto(
                          producto
                        )
                      }
                      className="w-full flex items-center gap-3 p-3 text-left border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900 transition"
                    >
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-amber-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {
                            producto.nombre
                          }
                        </p>

                        <p className="text-xs text-zinc-400">
                          {producto.categoria ||
                            "Sin categoría"}
                          {" · "}
                          {producto.unidad_medida ||
                            "Unidad"}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-semibold text-amber-400">
                          {fmtMoney(
                            Number(
                              producto.precio_unitario ||
                                0
                            )
                          )}
                        </p>

                        <p className="text-xs text-zinc-500">
                          Stock:{" "}
                          {Number(
                            producto.stock_actual ||
                              0
                          )}
                        </p>
                      </div>
                    </button>
                  )
                )
              ) : (
                <div className="p-6 text-center text-sm text-zinc-500">
                  No se encontraron productos
                </div>
              )}
            </div>
          )}
        </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-3">
            <Label>
              Ítems / Productos
            </Label>

            {!esConvertida && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={agregarItemManual}
                className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
              >
                <Plus className="w-4 h-4 mr-1" />
                Ítem manual
              </Button>
            )}
          </div>

          {subtotalItems.length ===
          0 ? (
            <div className="py-10 text-center rounded-lg border border-dashed border-zinc-800 text-muted-foreground">
              <p>
                No hay productos en esta cotización
              </p>

              <p className="text-xs mt-1">
                Busca un producto del inventario o agrega un ítem manual
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {subtotalItems.map(
                (item) => {
                  const productoOriginal =
                    productos.find(
                      (producto) =>
                        String(
                          producto.id
                        ) ===
                        String(
                          item.producto_id
                        )
                    );

                  const stockDisponible =
                    productoOriginal
                      ? Number(
                          productoOriginal.stock_actual ||
                            0
                        )
                      : item.stock_disponible;

                  return (
                    <Card
                      key={item.id}
                      className="p-4 bg-zinc-950 border-zinc-800"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-amber-500" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <Input
                              disabled={esConvertida}
                              className="bg-transparent border-zinc-800 font-medium"
                              placeholder="Descripción"
                              value={item.desc}
                              onChange={(event) =>
                                actualizarItem(
                                  item.id,
                                  "desc",
                                  event.target.value
                                )
                              }
                            />

                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
                              <span>
                                Unidad:{" "}
                                <span className="text-zinc-300">
                                  {item.unidad ||
                                    "Unidad"}
                                </span>
                              </span>

                              {stockDisponible !==
                                undefined && (
                                <span>
                                  Stock:{" "}
                                  <span className="text-zinc-300">
                                    {
                                      stockDisponible
                                    }
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          {!esConvertida && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                              onClick={() =>
                                eliminarItem(item.id)
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-zinc-400">
                              Cantidad
                            </Label>

                            <NumericInput
                              disabled={esConvertida}
                              className="mt-1 bg-zinc-900 border-zinc-800"
                              min={0}
                              placeholder="Cant."
                              value={item.cant}
                              onValueChange={(valor) =>
                                actualizarItem(
                                  item.id,
                                  "cant",
                                  valor
                                )
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-xs text-zinc-400">
                              Precio unitario
                            </Label>

                            <NumericInput
                              disabled={esConvertida}
                              className="mt-1 bg-zinc-900 border-zinc-800"
                              min={0}
                              placeholder="Precio"
                              value={item.precio}
                              onValueChange={(valor) =>
                                actualizarItem(
                                  item.id,
                                  "precio",
                                  valor
                                )
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-xs text-zinc-400">
                              Subtotal
                            </Label>

                            <div className="mt-1 h-10 flex items-center justify-end rounded-md border border-zinc-800 bg-zinc-900 px-3 font-semibold text-emerald-400">
                              {fmtMoney(
                                item.total
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
          <div className="space-y-4">
            <div>
              <Label>
                Descuento (%)
              </Label>

              <NumericInput
                min={0}
                max={100}
                disabled={esConvertida}
                value={
                  cotizacion.descuento
                }
                onValueChange={(valor) =>
                  actualizarCotizacion({
                    descuento: valor,
                  })
                }
                className="bg-zinc-950 border-zinc-800 mt-1"
              />
            </div>

            <div>
              <Label>
                IVA (%)
              </Label>

              <NumericInput
                min={0}
                max={100}
                disabled={esConvertida}
                value={
                  cotizacion.iva_porcentaje
                }
                onValueChange={(valor) =>
                  actualizarCotizacion({
                    iva_porcentaje:
                      valor,
                  })
                }
                className="bg-zinc-950 border-zinc-800 mt-1"
              />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <div className="flex justify-between gap-6 text-sm">
              <span className="text-zinc-400">
                Subtotal
              </span>

              <span>
                {fmtMoney(
                  cotizacion.subtotal
                )}
              </span>
            </div>

            <div className="flex justify-between gap-6 text-sm">
              <span className="text-zinc-400">
                Descuento
              </span>

              <span>
                -
                {fmtMoney(
                  cotizacion.monto_descuento
                )}
              </span>
            </div>

            <div className="flex justify-between gap-6 text-sm">
              <span className="text-zinc-400">
                Neto
              </span>

              <span>
                {fmtMoney(
                  cotizacion.neto
                )}
              </span>
            </div>

            <div className="flex justify-between gap-6 text-sm">
              <span className="text-zinc-400">
                IVA (
                {Number(
                  cotizacion.iva_porcentaje ||
                    0
                )}
                %)
              </span>

              <span>
                {fmtMoney(
                  cotizacion.iva
                )}
              </span>
            </div>

            <div className="flex justify-between gap-6 pt-3 border-t border-zinc-800">
              <span className="font-medium">
                Total
              </span>

              <span className="text-3xl font-bold text-emerald-400">
                {fmtMoney(
                  cotizacion.total
                )}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
