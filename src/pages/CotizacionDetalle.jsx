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
  getCotizaciones,
  registrarActividad,
  saveCotizaciones,
} from "@/lib/database";
import {
  getCotizacionesLocalesRespaldo,
  getCotizacionesRemotas,
  guardarCotizacionRemota,
  importarCotizacionesLocalesSiVacio,
} from "@/lib/quotationRepository";
import {
  getClientesLocalesRespaldo,
  getClientesRemotos,
  importarClientesLocalesSiVacio,
} from "@/lib/clientRepository";
import {
  getProductosLocalesRespaldo,
  getProductosRemotos,
} from "@/lib/inventoryRepository";
import {
  importarVentasLocalesSiVacio,
  registrarVentaRemota,
} from "@/lib/salesRepository";

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
  UserRound,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ImageOff,
} from "lucide-react";

const estados = [
  "Borrador",
  "Enviada",
  "Aceptada",
  "Rechazada",
];

const themedSurfaceStyle = {
  background:
    "linear-gradient(145deg, color-mix(in srgb, hsl(var(--start-accent)) 15%, hsl(var(--start-bg-b))), color-mix(in srgb, hsl(var(--start-accent)) 8%, hsl(var(--start-bg-a))))",
  borderColor:
    "color-mix(in srgb, hsl(var(--start-accent)) 24%, hsl(var(--start-border)))",
};

const themedInsetStyle = {
  background:
    "color-mix(in srgb, hsl(var(--start-accent)) 9%, hsl(var(--start-bg-a)))",
  borderColor:
    "color-mix(in srgb, hsl(var(--start-accent)) 20%, hsl(var(--start-border)))",
};

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

const resumirCotizacion = (cotizacion) => ({
  numero: cotizacion?.numero || "",
  cliente: cotizacion?.nombre_cliente || "",
  estado: cotizacion?.estado || "Borrador",
  items: (cotizacion?.items || []).length,
  descuento: Number(cotizacion?.descuento || 0),
  iva: Number(cotizacion?.iva_porcentaje || 0),
  total: Number(cotizacion?.total || 0),
});

export default function CotizacionDetalle({
  actualizarProductos,
  actualizarVentas,
  actualizarCotizaciones,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const esNuevaCotizacion = id === "nueva";

  const buscadorRef = useRef(null);
  const inputBusquedaRef = useRef(null);
  const buscadorClienteRef = useRef(null);
  const inputClienteRef = useRef(null);

  const [cotizacion, setCotizacion] =
    useState(null);

  const [productos, setProductos] =
    useState([]);

  const [clientes, setClientes] =
    useState([]);

  const [busquedaCliente, setBusquedaCliente] =
    useState("");

  const [buscadorClienteAbierto, setBuscadorClienteAbierto] =
    useState(false);

  const [busquedaProducto, setBusquedaProducto] =
    useState("");

  const [buscadorAbierto, setBuscadorAbierto] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [
    configuracionEmpresa,
    setConfiguracionEmpresa,
  ] = useState({
    nombre: "Maderas M&M",
    rut: "",
    telefono: "",
    correo: "",
    direccion: "",
    sitio_web: "",
    mensaje_pie:
      "Gracias por preferirnos.",
    logo: "/logo.png",
  });

  useEffect(() => {
    const cargarCotizacion = async () => {
      try {
      let todas;
      try {
        await importarCotizacionesLocalesSiVacio();
        todas = await getCotizacionesRemotas();
      } catch (errorCotizaciones) {
        console.error(
          "No se pudieron sincronizar las cotizaciones:",
          errorCotizaciones
        );
        todas = getCotizacionesLocalesRespaldo();
      }

      let inventario;
      try {
        inventario = await getProductosRemotos();
      } catch (errorInventario) {
        console.error("No se pudo sincronizar el inventario:", errorInventario);
        inventario = getProductosLocalesRespaldo();
      }

      let clientesGuardados;
      try {
        await importarClientesLocalesSiVacio();
        clientesGuardados = await getClientesRemotos();
      } catch (errorClientes) {
        console.error("No se pudieron sincronizar los clientes:", errorClientes);
        clientesGuardados = getClientesLocalesRespaldo();
      }

      const configuracionGuardada = JSON.parse(
        localStorage.getItem(
          "configuracion_empresa"
        ) || "{}"
      );

      setConfiguracionEmpresa(
        (actual) => ({
          ...actual,
          ...configuracionGuardada,
        })
      );

      const encontrada = todas.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

      if (!encontrada && esNuevaCotizacion) {
        const maxNum = todas.reduce(
          (maximo, item) =>
            Math.max(
              maximo,
              Number(item.numero || 0)
            ),
          0
        );

        const items = [];
        const descuentoInicial = "0";
        const ivaInicial = "19";
        const totales = calcularTotales(
          items,
          descuentoInicial,
          ivaInicial
        );

        setCotizacion({
          id: "nueva",
          numero: maxNum + 1,
          fecha: new Date()
            .toISOString()
            .split("T")[0],
          cliente_id: "",
          nombre_cliente: "",
          telefono_cliente: "",
          email_cliente: "",
          direccion_cliente: "",
          rut_cliente: "",
          estado: "Borrador",
          validez_dias: "15",
          descuento: descuentoInicial,
          iva_porcentaje: ivaInicial,
          items,
          ...totales,
        });

        setProductos(
          inventario.filter(
            (producto) =>
              producto.activo !== false
          )
        );

        setClientes(clientesGuardados);
        setBusquedaCliente("");
        return;
      }

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
        foto_url:
          item.foto_url || "",
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
        cliente_id:
          encontrada.cliente_id || "",
        nombre_cliente:
          encontrada.nombre_cliente || "",
        telefono_cliente:
          encontrada.telefono_cliente || "",
        email_cliente:
          encontrada.email_cliente || "",
        direccion_cliente:
          encontrada.direccion_cliente || "",
        rut_cliente:
          encontrada.rut_cliente || "",
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

      setClientes(clientesGuardados);

      setBusquedaCliente(
        encontrada.nombre_cliente || ""
      );
      } catch (error) {
      console.error(
        "Error cargando cotización:",
        error
      );

      navigate("/cotizaciones");
      }
    };

    cargarCotizacion();
  }, [id, navigate, esNuevaCotizacion]);

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

      if (
        buscadorClienteRef.current &&
        !buscadorClienteRef.current.contains(
          event.target
        )
      ) {
        setBuscadorClienteAbierto(false);
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

  const clientesFiltrados =
    useMemo(() => {
      const texto = limpiarTexto(
        busquedaCliente
      );

      if (!texto) {
        return clientes.slice(0, 8);
      }

      return clientes
        .filter((cliente) =>
          [
            cliente.nombre,
            cliente.telefono_whatsapp,
            cliente.email,
            cliente.direccion,
            cliente.rut_dni,
          ].some((campo) =>
            limpiarTexto(campo).includes(
              texto
            )
          )
        )
        .slice(0, 8);
    }, [
      clientes,
      busquedaCliente,
    ]);

  const seleccionarCliente = (
    cliente
  ) => {
    actualizarCotizacion({
      cliente_id: cliente.id,
      nombre_cliente:
        cliente.nombre || "",
      telefono_cliente:
        cliente.telefono_whatsapp || "",
      email_cliente:
        cliente.email || "",
      direccion_cliente:
        cliente.direccion || "",
      rut_cliente:
        cliente.rut_dni || "",
    });

    setBusquedaCliente(
      cliente.nombre || ""
    );

    setBuscadorClienteAbierto(false);

    mostrarMensaje(
      `${cliente.nombre} seleccionado`
    );
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
          foto_url:
            producto.foto_url || "",
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

  const handleSave = async () => {
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
      const todas = getCotizaciones();

      const index = todas.findIndex(
        (item) =>
          String(item.id) ===
          String(id)
      );

      const cotizacionAnterior =
        index >= 0 ? todas[index] : null;

      if (
        index === -1 &&
        !esNuevaCotizacion
      ) {
        mostrarMensaje(
          "No se encontró esta cotización."
        );
        setGuardando(false);
        return;
      }

      const numeroDefinitivo =
        esNuevaCotizacion
          ? todas.reduce(
              (maximo, item) =>
                Math.max(
                  maximo,
                  Number(item.numero || 0)
                ),
              0
            ) + 1
          : cotizacion.numero;

      const idDefinitivo =
        esNuevaCotizacion
          ? Date.now().toString()
          : cotizacion.id;

      const cotizacionGuardada = {
        ...cotizacion,
        id: idDefinitivo,
        numero: numeroDefinitivo,
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

      if (esNuevaCotizacion) {
        todas.push(cotizacionGuardada);
      } else {
        todas[index] =
          cotizacionGuardada;
      }

      const cotizacionSincronizada =
        await guardarCotizacionRemota(
          cotizacionGuardada
        );

      if (esNuevaCotizacion) {
        todas[todas.length - 1] =
          cotizacionSincronizada;
      } else {
        todas[index] =
          cotizacionSincronizada;
      }

      saveCotizaciones(todas);

      registrarActividad({
        accion: esNuevaCotizacion ? "crear" : "editar",
        modulo: "Cotizaciones",
        entidadId: cotizacionGuardada.id,
        entidadNombre: `Cotización N° ${String(
          cotizacionGuardada.numero
        ).padStart(4, "0")}`,
        descripcion: esNuevaCotizacion
          ? `Creó la Cotización N° ${String(
              cotizacionGuardada.numero
            ).padStart(4, "0")} para ${
              cotizacionGuardada.nombre_cliente
            }`
          : `Editó la Cotización N° ${String(
              cotizacionGuardada.numero
            ).padStart(4, "0")}`,
        datosAntes: cotizacionAnterior
          ? resumirCotizacion(cotizacionAnterior)
          : null,
        datosDespues: resumirCotizacion(cotizacionSincronizada),
      });

      setCotizacion({
        ...cotizacionSincronizada,
        validez_dias: String(
          cotizacionSincronizada
            .validez_dias
        ),
        descuento: String(
          cotizacionSincronizada
            .descuento
        ),
        iva_porcentaje: String(
          cotizacionSincronizada
            .iva_porcentaje
        ),
        items:
          cotizacionSincronizada.items.map(
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

  const convertirEnVenta = async () => {
    if (guardando) return;

    if (esNuevaCotizacion) {
      mostrarMensaje(
        "Guarda la cotización antes de convertirla en venta."
      );
      return;
    }

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
      const inventario = await getProductosRemotos();

      let cotizaciones;
      try {
        cotizaciones =
          await getCotizacionesRemotas();
      } catch (errorCotizaciones) {
        console.error(
          "No se pudieron sincronizar las cotizaciones:",
          errorCotizaciones
        );
        cotizaciones =
          getCotizacionesLocalesRespaldo();
      }

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
      const grupoVentaId = crypto.randomUUID();

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
            venta_grupo_id: grupoVentaId,
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
            total_venta: Math.round(cotizacion.total || 0),
            metodo_pago: "Cotización",
            cliente: cotizacion.nombre_cliente.trim(),
            cliente_id: cotizacion.cliente_id || "",
            telefono_cliente:
              cotizacion.telefono_cliente || "",
            email_cliente:
              cotizacion.email_cliente || "",
            direccion_cliente:
              cotizacion.direccion_cliente || "",
            rut_cliente:
              cotizacion.rut_cliente || "",
            cotizacion_id: cotizacion.id,
            cotizacion_numero: cotizacion.numero,
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

      await importarVentasLocalesSiVacio();
      await registrarVentaRemota({
        ventaId: grupoVentaId,
        ventas: nuevasVentas,
      });

      await guardarCotizacionRemota(
        cotizacionConvertida
      );

      saveCotizaciones(cotizacionesActualizadas);

      registrarActividad({
        accion: "convertir_venta",
        modulo: "Cotizaciones",
        entidadId: cotizacion.id,
        entidadNombre: `Cotización N° ${String(
          cotizacion.numero
        ).padStart(4, "0")}`,
        descripcion: `Convirtió la Cotización N° ${String(
          cotizacion.numero
        ).padStart(4, "0")} de ${
          cotizacion.nombre_cliente
        } en venta`,
        datosAntes: resumirCotizacion(cotizacion),
        datosDespues: {
          ...resumirCotizacion(cotizacionConvertida),
          ventas_generadas: nuevasVentas.length,
        },
      });

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

  const descargarPDF = async () => {
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

    const obtenerImagenComoDataURL = async (
      origen
    ) => {
      if (!origen) return null;

      if (
        String(origen).startsWith(
          "data:image/"
        )
      ) {
        return origen;
      }

      try {
        const respuesta = await fetch(
          origen
        );

        if (!respuesta.ok) {
          return null;
        }

        const blob =
          await respuesta.blob();

        return await new Promise(
          (resolve, reject) => {
            const lector =
              new FileReader();

            lector.onload = () =>
              resolve(lector.result);

            lector.onerror =
              reject;

            lector.readAsDataURL(
              blob
            );
          }
        );
      } catch (error) {
        console.warn(
          "No se pudo cargar el logo:",
          error
        );

        return null;
      }
    };

    try {
      const doc = new jsPDF({
        unit: "mm",
        format: "a4",
      });

      const numero = String(
        cotizacion.numero
      ).padStart(4, "0");

      const empresa = {
        nombre:
          configuracionEmpresa.nombre ||
          "Maderas M&M",
        rut: "",
        telefono: "+569 97666003",
        correo: "maderasmym@gmail.com",
        direccion: "Longitudinal Sur km 5",
        sitioWeb: "www.maderasmym.cl",
        mensaje:
          configuracionEmpresa.mensaje_pie ||
          "Gracias por preferirnos.",
        logo: "/logo-transparent.png",
      };

      const colores = {
        oscuro: [43, 38, 34],
        nogal: [91, 68, 50],
        arena: [178, 145, 101],
        crema: [249, 247, 243],
        gris: [91, 88, 84],
        linea: [190, 185, 178],
        verde: [31, 122, 87],
        blanco: [255, 255, 255],
        suave: [239, 236, 231],
      };

      const margen = 15;
      const anchoPagina = 210;
      const anchoContenido =
        anchoPagina - margen * 2;

      const logoData =
        await obtenerImagenComoDataURL(
          empresa.logo
        );

      const dibujarEncabezado = () => {
        doc.setFillColor(...colores.blanco);
        doc.setDrawColor(...colores.linea);
        doc.setLineWidth(0.35);
        doc.roundedRect(margen, 10, anchoContenido, 38, 2.5, 2.5, "FD");

        doc.setFillColor(...colores.nogal);
        doc.roundedRect(margen, 10, 3.2, 38, 1.6, 1.6, "F");

        if (logoData) {
          try {
            doc.addImage(
              logoData,
              "PNG",
              margen + 7,
              14,
              30,
              30,
              undefined,
              "FAST"
            );
          } catch {
            try {
              doc.addImage(
                logoData,
                "JPEG",
                margen + 7,
                14,
                30,
                30,
                undefined,
                "FAST"
              );
            } catch (error) {
              console.warn(
                "No se pudo insertar el logo:",
                error
              );
            }
          }
        }

        const xTexto =
          logoData
            ? margen + 42
            : margen + 9;

        doc.setTextColor(
          ...colores.oscuro
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(18);

        doc.text(
          empresa.nombre,
          xTexto,
          24
        );

        doc.setDrawColor(...colores.arena);
        doc.setLineWidth(0.7);
        doc.line(xTexto, 27, 139, 27);

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.setTextColor(...colores.gris);

        const lineaContacto = [
          empresa.telefono,
          empresa.correo,
        ]
          .filter(Boolean)
          .join("     |     ");

        if (lineaContacto) {
          doc.text(
            lineaContacto,
            xTexto,
            31
          );
        }

        if (empresa.sitioWeb) {
          doc.text(
            empresa.sitioWeb,
            xTexto,
            37
          );
        }

        if (empresa.direccion) {
          const anchoWeb = empresa.sitioWeb
            ? doc.getTextWidth(empresa.sitioWeb)
            : 0;

          const pinX = xTexto + anchoWeb + 7;
          const pinY = 35.4;

          if (empresa.sitioWeb) {
            doc.setDrawColor(...colores.linea);
            doc.setLineWidth(0.35);
            doc.line(
              xTexto + anchoWeb + 3,
              33.5,
              xTexto + anchoWeb + 3,
              38
            );
          }

          doc.setDrawColor(...colores.nogal);
          doc.setLineWidth(0.45);
          doc.circle(pinX, pinY, 1.35, "S");
          doc.circle(pinX, pinY, 0.42, "F");
          doc.line(pinX - 0.95, pinY + 0.95, pinX, pinY + 2.4);
          doc.line(pinX + 0.95, pinY + 0.95, pinX, pinY + 2.4);

          doc.setTextColor(...colores.gris);
          doc.text(
            empresa.direccion,
            pinX + 3.2,
            37
          );
        }

        doc.setFillColor(...colores.crema);
        doc.setDrawColor(...colores.nogal);
        doc.setLineWidth(0.45);
        doc.roundedRect(150, 15, 40, 28, 2, 2, "FD");

        doc.setTextColor(
          ...colores.oscuro
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(9);

        doc.text(
          "COTIZACIÓN",
          170,
          23,
          {
            align: "center",
          }
        );

        doc.setFontSize(16);

        doc.text(
          `N° ${numero}`,
          170,
          32,
          {
            align: "center",
          }
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(7.5);

        doc.text(
          cotizacion.estado ||
            "Borrador",
          170,
          39,
          {
            align: "center",
          }
        );

        doc.setDrawColor(...colores.arena);
        doc.setLineWidth(0.8);
        doc.line(156, 35.5, 184, 35.5);
      };

      const dibujarPiePagina = (
        numeroPagina,
        totalPaginas
      ) => {
        doc.setDrawColor(
          ...colores.linea
        );

        doc.line(
          margen,
          278,
          anchoPagina - margen,
          278
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          ...colores.gris
        );

        doc.text(
          empresa.nombre,
          margen,
          284
        );

        const contactoPie = [
          empresa.telefono,
          empresa.correo,
          empresa.sitioWeb,
        ]
          .filter(Boolean)
          .join("  |  ");

        if (contactoPie) {
          doc.text(
            contactoPie,
            margen,
            289
          );
        }

        doc.text(
          `Página ${numeroPagina} de ${totalPaginas}`,
          anchoPagina - margen,
          287,
          {
            align: "right",
          }
        );
      };

      const dibujarCabeceraTabla = (
        y
      ) => {
        doc.setFillColor(
          ...colores.nogal
        );

        doc.roundedRect(
          margen,
          y,
          anchoContenido,
          9,
          2,
          2,
          "F"
        );

        doc.setTextColor(
          ...colores.blanco
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(8.5);

        doc.text(
          "PRODUCTO",
          margen + 4,
          y + 6
        );

        doc.text(
          "CANT.",
          132,
          y + 6,
          {
            align: "center",
          }
        );

        doc.text(
          "PRECIO",
          163,
          y + 6,
          {
            align: "right",
          }
        );

        doc.text(
          "TOTAL",
          anchoPagina -
            margen -
            4,
          y + 6,
          {
            align: "right",
          }
        );

        return y + 13;
      };

      dibujarEncabezado();

      let y = 56;

      const gap = 4;
      const anchoColumna =
        (anchoContenido - gap) / 2;

      const clienteDatos = [
        cotizacion.rut_cliente
          ? `RUT: ${cotizacion.rut_cliente}`
          : "",
        cotizacion.telefono_cliente
          ? `Teléfono: ${cotizacion.telefono_cliente}`
          : "",
        cotizacion.email_cliente
          ? `Correo: ${cotizacion.email_cliente}`
          : "",
        cotizacion.direccion_cliente
          ? `Dirección: ${cotizacion.direccion_cliente}`
          : "",
      ].filter(Boolean);

      const empresaDatos = [
        empresa.rut
          ? `RUT: ${empresa.rut}`
          : "",
        empresa.telefono
          ? `Teléfono: ${empresa.telefono}`
          : "",
        empresa.correo
          ? `Correo: ${empresa.correo}`
          : "",
        empresa.direccion
          ? `Dirección: ${empresa.direccion}`
          : "",
      ].filter(Boolean);

      const cantidadLineas =
        Math.max(
          clienteDatos.length,
          empresaDatos.length
        );

      const altoTarjetas =
        Math.max(
          38,
          24 +
            cantidadLineas * 5.2
        );

      doc.setFillColor(
        ...colores.crema
      );

      doc.roundedRect(
        margen,
        y,
        anchoColumna,
        altoTarjetas,
        3,
        3,
        "F"
      );

      doc.roundedRect(
        margen +
          anchoColumna +
          gap,
        y,
        anchoColumna,
        altoTarjetas,
        3,
        3,
        "F"
      );

      doc.setTextColor(
        ...colores.oscuro
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(9);

      doc.text(
        "CLIENTE",
        margen + 5,
        y + 8
      );

      doc.text(
        "EMPRESA",
        margen +
          anchoColumna +
          gap +
          5,
        y + 8
      );

      doc.setFontSize(12);

      doc.text(
        cotizacion.nombre_cliente,
        margen + 5,
        y + 17
      );

      doc.text(
        empresa.nombre,
        margen +
          anchoColumna +
          gap +
          5,
        y + 17
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(8);

      doc.setTextColor(
        ...colores.gris
      );

      let clienteY = y + 24;

      clienteDatos.forEach(
        (dato) => {
          const lineas =
            doc.splitTextToSize(
              dato,
              anchoColumna - 10
            );

          doc.text(
            lineas,
            margen + 5,
            clienteY
          );

          clienteY +=
            lineas.length * 4.1 +
            1;
        }
      );

      let empresaY = y + 24;

      empresaDatos.forEach(
        (dato) => {
          const lineas =
            doc.splitTextToSize(
              dato,
              anchoColumna - 10
            );

          doc.text(
            lineas,
            margen +
              anchoColumna +
              gap +
              5,
            empresaY
          );

          empresaY +=
            lineas.length * 4.1 +
            1;
        }
      );

      y += altoTarjetas + 5;

      doc.setFillColor(
        ...colores.suave
      );

      doc.roundedRect(
        margen,
        y,
        anchoContenido,
        16,
        3,
        3,
        "F"
      );

      doc.setTextColor(
        ...colores.oscuro
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(8);

      doc.text(
        "FECHA",
        margen + 6,
        y + 6
      );

      doc.text(
        "VALIDEZ",
        75,
        y + 6
      );

      doc.text(
        "ESTADO",
        125,
        y + 6
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      doc.text(
        String(
          cotizacion.fecha || ""
        ),
        margen + 6,
        y + 12
      );

      doc.text(
        `${cotizacion.validez_dias} días`,
        75,
        y + 12
      );

      doc.text(
        cotizacion.estado ||
          "Borrador",
        125,
        y + 12
      );

      y += 22;

      y = dibujarCabeceraTabla(y);

      for (
        const [indiceItem, item] of cotizacion.items.entries()
      ) {
        const productoOriginal =
          productos.find(
            (productoInventario) =>
              String(
                productoInventario.id
              ) ===
              String(
                item.producto_id
              )
          );

        const descripcion =
          String(item.desc || "");

        const detalleProducto = [
          productoOriginal?.subcategoria ||
            "",
          productoOriginal?.categoria ||
            "",
        ]
          .filter(Boolean)
          .join("  ·  ");

        const lineasNombre =
          doc.splitTextToSize(
            descripcion,
            94
          );

        const lineasDetalle =
          detalleProducto
            ? doc.splitTextToSize(
                detalleProducto,
                94
              )
            : [];

        const alturaNombre =
          lineasNombre.length * 4.2;

        const alturaDetalle =
          lineasDetalle.length > 0
            ? lineasDetalle.length *
                3.7 +
              1
            : 0;

        const alturaFila =
          Math.max(
            12,
            alturaNombre +
              alturaDetalle +
              5
          );

        if (
          y + alturaFila >
          250
        ) {
          doc.addPage();

          dibujarEncabezado();

          y = 56;

          y =
            dibujarCabeceraTabla(
              y
            );
        }

        if (indiceItem % 2 === 1) {
          doc.setFillColor(...colores.crema);
          doc.rect(
            margen,
            y,
            anchoContenido,
            alturaFila,
            "F"
          );
        }

        doc.setDrawColor(
          ...colores.linea
        );

        doc.line(
          margen,
          y + alturaFila,
          anchoPagina - margen,
          y + alturaFila
        );

        doc.setTextColor(
          ...colores.oscuro
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(8.8);

        doc.text(
          lineasNombre,
          margen + 4,
          y + 5
        );

        if (
          lineasDetalle.length > 0
        ) {
          doc.setTextColor(
            ...colores.gris
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(7.7);

          doc.text(
            lineasDetalle,
            margen + 4,
            y +
              5 +
              alturaNombre +
              0.8
          );
        }

        doc.setTextColor(
          ...colores.oscuro
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8.7);

        doc.text(
          String(
            Number(
              item.cant || 0
            )
          ),
          132,
          y + 6,
          {
            align: "center",
          }
        );

        doc.text(
          fmtMoney(
            Number(
              item.precio || 0
            )
          ),
          163,
          y + 6,
          {
            align: "right",
          }
        );

        const totalItem =
          Number(
            item.cant || 0
          ) *
          Number(
            item.precio || 0
          );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          fmtMoney(totalItem),
          anchoPagina -
            margen -
            4,
          y + 6,
          {
            align: "right",
          }
        );

        y += alturaFila;
      }

      y += 7;

      if (y > 205) {
        doc.addPage();

        dibujarEncabezado();

        y = 58;
      }

      const anchoTotales = 82;
      const altoTotales = 54;
      const xTotales =
        anchoPagina -
        margen -
        anchoTotales;

      doc.setFillColor(
        ...colores.blanco
      );

      doc.setDrawColor(...colores.linea);
      doc.setLineWidth(0.35);

      doc.roundedRect(
        xTotales,
        y,
        anchoTotales,
        altoTotales,
        3,
        3,
        "FD"
      );

      const filaTotal = (
        etiqueta,
        valor,
        posicionY,
        negrita = false,
        color = colores.oscuro
      ) => {
        doc.setTextColor(
          ...color
        );

        doc.setFont(
          "helvetica",
          negrita
            ? "bold"
            : "normal"
        );

        doc.setFontSize(
          negrita ? 12 : 8.8
        );

        doc.text(
          etiqueta,
          xTotales + 6,
          posicionY
        );

        doc.text(
          valor,
          xTotales +
            anchoTotales -
            6,
          posicionY,
          {
            align: "right",
          }
        );
      };

      filaTotal(
        "Subtotal",
        fmtMoney(
          cotizacion.subtotal
        ),
        y + 10
      );

      filaTotal(
        `Descuento (${Number(
          cotizacion.descuento ||
            0
        )}%)`,
        `-${fmtMoney(
          cotizacion.monto_descuento
        )}`,
        y + 20
      );

      filaTotal(
        `IVA (${Number(
          cotizacion.iva_porcentaje ||
            0
        )}%)`,
        fmtMoney(
          cotizacion.iva
        ),
        y + 30
      );

      doc.setDrawColor(
        ...colores.linea
      );

      doc.line(
        xTotales + 6,
        y + 36,
        xTotales +
          anchoTotales -
          6,
        y + 36
      );

      doc.setFillColor(
        ...colores.nogal
      );

      doc.roundedRect(
        xTotales + 4,
        y + 39,
        anchoTotales - 8,
        11,
        2,
        2,
        "F"
      );

      filaTotal(
        "TOTAL",
        fmtMoney(
          cotizacion.total
        ),
        y + 47,
        true,
        colores.blanco
      );

      doc.setFillColor(
        ...colores.crema
      );

      doc.setDrawColor(...colores.linea);
      doc.setLineWidth(0.35);

      doc.roundedRect(
        margen,
        y,
        88,
        altoTotales,
        3,
        3,
        "FD"
      );

      doc.setTextColor(
        ...colores.oscuro
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(9);

      doc.text(
        "OBSERVACIONES",
        margen + 6,
        y + 9
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(8.5);

      doc.setTextColor(
        ...colores.gris
      );

      const textoMensaje =
        empresa.mensaje ||
        "Gracias por preferirnos.";

      const lineasMensaje =
        doc.splitTextToSize(
          textoMensaje,
          76
        );

      doc.text(
        lineasMensaje,
        margen + 6,
        y + 18
      );

      doc.setFontSize(7.5);

      doc.text(
        "Esta cotización está sujeta a disponibilidad de stock.",
        margen + 6,
        y + 41
      );

      doc.text(
        "Valores expresados en pesos chilenos.",
        margen + 6,
        y + 47
      );

      const totalPaginas =
        doc.getNumberOfPages();

      for (
        let pagina = 1;
        pagina <= totalPaginas;
        pagina++
      ) {
        doc.setPage(pagina);

        dibujarPiePagina(
          pagina,
          totalPaginas
        );
      }

      doc.save(
        `cotizacion-maderas-mm-${numero}.pdf`
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto text-foreground">
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
                ? "bg-muted text-foreground/70 cursor-not-allowed"
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
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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

      <Card
        className="p-6 border space-y-6 text-foreground shadow-sm"
        style={themedSurfaceStyle}
      >
        <div className="space-y-4">
          <div
            ref={buscadorClienteRef}
            className="relative"
          >
            <Label>
              Cliente{" "}
              <span className="text-red-400">*</span>
            </Label>

            <div className="relative mt-1">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <Input
                id="nombre-cliente"
                ref={inputClienteRef}
                required
                disabled={esConvertida}
                value={busquedaCliente}
                onFocus={() =>
                  setBuscadorClienteAbierto(true)
                }
                onChange={(event) => {
                  const valor = event.target.value;

                  setBusquedaCliente(valor);
                  setBuscadorClienteAbierto(true);

                  actualizarCotizacion({
                    cliente_id: "",
                    nombre_cliente: valor,
                    telefono_cliente: "",
                    email_cliente: "",
                    direccion_cliente: "",
                    rut_cliente: "",
                  });
                }}
                placeholder="Buscar o escribir cliente..."
                className="bg-background/80 border-border pl-10 pr-10"
              />

              {busquedaCliente && !esConvertida && (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaCliente("");

                    actualizarCotizacion({
                      cliente_id: "",
                      nombre_cliente: "",
                      telefono_cliente: "",
                      email_cliente: "",
                      direccion_cliente: "",
                      rut_cliente: "",
                    });

                    inputClienteRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {!esConvertida && buscadorClienteAbierto && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-background/80 shadow-2xl">
                {clientesFiltrados.length > 0 ? (
                  clientesFiltrados.map((cliente) => (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() =>
                        seleccionarCliente(cliente)
                      }
                      className="w-full flex items-center gap-3 px-3 py-2 text-left border-b border-border last:border-b-0 hover:bg-secondary/70 transition"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                        {cliente.nombre
                          ?.charAt(0)
                          .toUpperCase() || "?"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {cliente.nombre}
                        </p>

                        <p className="text-xs text-muted-foreground truncate">
                          {cliente.telefono_whatsapp ||
                            "Sin teléfono"}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No hay coincidencias. Puedes seguir escribiendo para usar un cliente nuevo.
                  </div>
                )}
              </div>
            )}

            {(cotizacion.telefono_cliente ||
              cotizacion.rut_cliente ||
              cotizacion.direccion_cliente ||
              cotizacion.email_cliente) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {cotizacion.telefono_cliente && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-foreground/70">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {cotizacion.telefono_cliente}
                  </span>
                )}

                {cotizacion.rut_cliente && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-foreground/70">
                    <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                    {cotizacion.rut_cliente}
                  </span>
                )}

                {cotizacion.email_cliente && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-foreground/70">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    {cotizacion.email_cliente}
                  </span>
                )}

                {cotizacion.direccion_cliente && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-foreground/70">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    {cotizacion.direccion_cliente}
                  </span>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              Selecciona un cliente guardado o escribe uno nuevo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Estado</Label>

              <select
                className="w-full h-10 bg-background/80 border border-border rounded-md px-3 mt-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className="bg-background/80 border-border"
                />

                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  días
                </span>
              </div>
            </div>
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
              className="bg-background/80 border-border mt-1"
            />
          </div>
        </div>

        {!esConvertida && (
        <div
          ref={buscadorRef}
          className="relative p-4 rounded-lg border"
          style={themedInsetStyle}
        >
          <Label>
            Buscar producto del inventario
          </Label>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

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
              className="bg-background/80 border-border pl-10 pr-10"
            />

            {busquedaProducto && (
              <button
                type="button"
                onClick={() =>
                  setBusquedaProducto("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {buscadorAbierto && (
            <div className="absolute left-4 right-4 top-full mt-1 z-30 max-h-72 overflow-y-auto rounded-xl border border-border bg-background/80 shadow-2xl">
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
                      className="group w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border last:border-b-0 hover:bg-primary/10 transition"
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-primary/10 shrink-0">
                        {producto.foto_url ? (
                          <img
                            src={producto.foto_url}
                            alt={producto.nombre}
                            className="w-full h-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {producto.nombre}
                        </p>

                        <p className="text-xs text-muted-foreground truncate">
                          {producto.categoria ||
                            "Sin categoría"}
                          {producto.subcategoria
                            ? ` · ${producto.subcategoria}`
                            : ""}
                          {" · "}
                          {producto.unidad_medida ||
                            "Unidad"}
                          {" · "}
                          Stock:{" "}
                          {Number(
                            producto.stock_actual ||
                              0
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-semibold text-primary">
                          {fmtMoney(
                            Number(
                              producto.precio_unitario ||
                                0
                            )
                          )}
                        </p>

                        <p className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition">
                          Agregar
                        </p>
                      </div>
                    </button>
                  )
                )
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
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
                className="text-primary hover:text-primary hover:bg-primary/10"
              >
                <Plus className="w-4 h-4 mr-1" />
                Ítem manual
              </Button>
            )}
          </div>

          {subtotalItems.length ===
          0 ? (
            <div className="py-10 text-center rounded-lg border border-dashed border-border text-muted-foreground">
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
                      className="p-4 border text-foreground"
                      style={themedInsetStyle}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-primary/10 shrink-0">
                            {(item.foto_url ||
                              productoOriginal?.foto_url) ? (
                              <img
                                src={
                                  item.foto_url ||
                                  productoOriginal?.foto_url
                                }
                                alt={item.desc}
                                className="w-full h-full object-cover"
                                onError={(event) => {
                                  event.currentTarget.style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-primary" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <Input
                              disabled={esConvertida}
                              className="bg-transparent border-border font-medium"
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

                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                              <span>
                                Unidad:{" "}
                                <span className="text-foreground/80">
                                  {item.unidad ||
                                    "Unidad"}
                                </span>
                              </span>

                              {stockDisponible !==
                                undefined && (
                                <span>
                                  Stock:{" "}
                                  <span className="text-foreground/80">
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
                            <Label className="text-xs text-foreground/70">
                              Cantidad
                            </Label>

                            <NumericInput
                              disabled={esConvertida}
                              className="mt-1 bg-secondary/70 border-border"
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
                            <Label className="text-xs text-foreground/70">
                              Precio unitario
                            </Label>

                            <NumericInput
                              disabled={esConvertida}
                              className="mt-1 bg-secondary/70 border-border"
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
                            <Label className="text-xs text-foreground/70">
                              Subtotal
                            </Label>

                            <div className="mt-1 h-10 flex items-center justify-end rounded-md border border-border bg-secondary/70 px-3 font-semibold text-emerald-400">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
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
                className="bg-background/80 border-border mt-1"
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
                className="bg-background/80 border-border mt-1"
              />
            </div>
          </div>

          <div className="space-y-2 text-right">
            <div className="flex justify-between gap-6 text-sm">
              <span className="text-foreground/70">
                Subtotal
              </span>

              <span>
                {fmtMoney(
                  cotizacion.subtotal
                )}
              </span>
            </div>

            <div className="flex justify-between gap-6 text-sm">
              <span className="text-foreground/70">
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
              <span className="text-foreground/70">
                Neto
              </span>

              <span>
                {fmtMoney(
                  cotizacion.neto
                )}
              </span>
            </div>

            <div className="flex justify-between gap-6 text-sm">
              <span className="text-foreground/70">
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

            <div className="flex justify-between gap-6 pt-3 border-t border-border">
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