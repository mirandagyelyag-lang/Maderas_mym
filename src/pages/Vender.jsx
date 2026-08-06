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
  CloudOff,
  X,
  Minus,
  Plus,
  Trash2,
  UserRound,
  CreditCard,
  Check,
  Loader2,
  ReceiptText,
  FileText,
  Printer,
  ExternalLink,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import ProductCard from "@/components/ProductCard";
import { fmtMoney } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";

import {
  generarId,
  registrarActividad,
} from "@/lib/database";
import {
  getClientesLocalesRespaldo,
  getClientesRemotos,
  importarClientesLocalesSiVacio,
  subscribeClientes,
} from "@/lib/clientRepository";

import {
  getProductosLocalesRespaldo,
  getProductosRemotos,
  importarInventarioLocalSiVacio,
  subscribeInventario,
} from "@/lib/inventoryRepository";

import {
  importarVentasLocalesSiVacio,
  registrarVentaConRespaldo,
} from "@/lib/salesRepository";

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

const tiposDocumento = [
  {
    id: "recibo_interno",
    nombre: "Recibo interno",
    descripcion: "Comprobante no tributario",
    icono: ReceiptText,
  },
  {
    id: "boleta_electronica",
    nombre: "Boleta electrónica",
    descripcion: "Emitir en e-Boleta SII",
    icono: FileText,
  },
  {
    id: "factura_electronica",
    nombre: "Factura electrónica",
    descripcion: "Emitir en Facturación SII",
    icono: FileText,
  },
];

const SII_DOCUMENT_URLS = {
  boleta_electronica: "https://eboleta.sii.cl/",
  factura_electronica:
    "https://www1.sii.cl/cgi-bin/Portal001/mipeLaunchPage.cgi?OPCION=33&TIPO=4",
};

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

const escaparHtml = (valor) =>
  String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function obtenerConfiguracionEmpresa() {
  try {
    const guardada = JSON.parse(
      localStorage.getItem("configuracion_empresa") || "{}"
    );

    return {
      nombre: guardada.nombre || "Maderas M&M",
      telefono:
        guardada.telefono ||
        guardada.phone ||
        "+56 9 97666003",
      correo:
        guardada.correo ||
        guardada.email ||
        "maderasmym@gmail.com",
      direccion:
        guardada.direccion ||
        guardada.address ||
        "Longitudinal sur km 5",
      logo:
        guardada.logo ||
        "/logo.png",
    };
  } catch {
    return {
      nombre: "Maderas M&M",
      telefono: "+56 9 97666003",
      correo: "maderasmym@gmail.com",
      direccion: "Longitudinal sur km 5",
      logo: "/logo.png",
    };
  }
}

function imprimirReciboInterno({
  ventaId,
  fecha,
  items,
  cliente,
  metodoPago,
  observaciones,
  total,
  usuario,
}) {
  const empresa = obtenerConfiguracionEmpresa();
  const iframe = document.createElement("iframe");

  iframe.setAttribute("title", "Impresión recibo interno");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";

  document.body.appendChild(iframe);

  const filas = items
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escaparHtml(item.producto.nombre)}</strong>
            ${
              item.producto.unidad_medida
                ? `<div class="muted">${escaparHtml(
                    item.producto.unidad_medida
                  )}</div>`
                : ""
            }
          </td>
          <td class="center">${Number(item.cantidad)}</td>
          <td class="right">${escaparHtml(
            fmtMoney(item.producto.precio_unitario)
          )}</td>
          <td class="right">${escaparHtml(
            fmtMoney(
              Number(item.cantidad) *
                Number(item.producto.precio_unitario || 0)
            )
          )}</td>
        </tr>
      `
    )
    .join("");

  const documentHtml = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Recibo interno ${escaparHtml(ventaId)}</title>
        <style>
          @page { size: letter; margin: 16mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #211d1a;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.45;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 18px;
            border-bottom: 2px solid #9b7951;
          }
          .brand { display: flex; align-items: center; gap: 14px; }
          .logo {
            width: 76px;
            height: 76px;
            object-fit: contain;
          }
          h1 { margin: 0 0 4px; font-size: 24px; }
          .company-data { color: #665d56; }
          .document-box {
            min-width: 220px;
            padding: 14px 16px;
            border: 1px solid #9b7951;
            border-radius: 12px;
            text-align: center;
          }
          .document-box strong {
            display: block;
            font-size: 16px;
            letter-spacing: .08em;
          }
          .notice {
            margin: 18px 0;
            padding: 10px 14px;
            border: 1px solid #c7b8a6;
            border-radius: 10px;
            background: #f7f3ee;
            text-align: center;
            font-weight: 700;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 24px;
            margin-bottom: 18px;
          }
          .label {
            color: #756b63;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th {
            padding: 10px 8px;
            color: #fff;
            background: #3a3029;
            text-align: left;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #ded6ce;
            vertical-align: top;
          }
          .right { text-align: right; }
          .center { text-align: center; }
          .muted { color: #796f67; font-size: 10px; }
          .total {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 36px;
            margin-top: 18px;
            padding: 14px 16px;
            border: 2px solid #3a3029;
            border-radius: 10px;
            font-size: 17px;
            font-weight: 700;
          }
          .notes {
            margin-top: 18px;
            padding: 12px 14px;
            border: 1px solid #ded6ce;
            border-radius: 10px;
          }
          .footer {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #ded6ce;
            color: #796f67;
            text-align: center;
            font-size: 10px;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <header class="header">
          <div class="brand">
            <img
              class="logo"
              src="/logo-transparent.png"
              alt="Maderas M&M"
              onerror="this.onerror=null;this.src='/logo.png';"
            />
            <div>
              <h1>${escaparHtml(empresa.nombre)}</h1>
              <div class="company-data">
                ${escaparHtml(empresa.telefono)} ·
                ${escaparHtml(empresa.correo)}<br />
                ${escaparHtml(empresa.direccion)}
              </div>
            </div>
          </div>

          <div class="document-box">
            <strong>RECIBO INTERNO</strong>
            <span>${escaparHtml(
              new Date(fecha).toLocaleString("es-CL")
            )}</span>
          </div>
        </header>

        <div class="notice">
          DOCUMENTO INTERNO NO VÁLIDO COMO BOLETA O FACTURA
        </div>

        <section class="info-grid">
          <div>
            <div class="label">Referencia</div>
            <div>${escaparHtml(ventaId)}</div>
          </div>
          <div>
            <div class="label">Cliente</div>
            <div>${escaparHtml(cliente || "Venta sin cliente")}</div>
          </div>
          <div>
            <div class="label">Método de pago</div>
            <div>${escaparHtml(metodoPago)}</div>
          </div>
          <div>
            <div class="label">Atendido por</div>
            <div>${escaparHtml(usuario || "Usuario del sistema")}</div>
          </div>
        </section>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="center">Cantidad</th>
              <th class="right">Precio</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>

        <div class="total">
          <span>TOTAL</span>
          <span>${escaparHtml(fmtMoney(total))}</span>
        </div>

        ${
          observaciones
            ? `
              <div class="notes">
                <div class="label">Observaciones</div>
                <div>${escaparHtml(observaciones)}</div>
              </div>
            `
            : ""
        }

        <footer class="footer">
          Comprobante de control interno generado por Maderas M&M.
        </footer>
      </body>
    </html>
  `;

  const iframeDocument =
    iframe.contentDocument || iframe.contentWindow?.document;

  if (!iframeDocument) {
    iframe.remove();
    throw new Error("No se pudo preparar la impresión del recibo.");
  }

  iframeDocument.open();
  iframeDocument.write(documentHtml);
  iframeDocument.close();

  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    window.setTimeout(() => iframe.remove(), 1200);
  }, 350);
}

export default function Vender({
  productos,
  actualizarProductos,
  actualizarVentas,
}) {
  const { user } = useAuth();

  const mensajeTimeoutRef = useRef(null);

  const [
    productosLocales,
    setProductosLocales,
  ] = useState([]);

  const [categoria, setCategoria] =
    useState("Todos");

  const [search, setSearch] =
    useState("");

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

  const [tipoDocumento, setTipoDocumento] =
    useState("recibo_interno");

  const [datosFactura, setDatosFactura] =
    useState({
      rut: "",
      razonSocial: "",
      giro: "",
      direccion: "",
      comuna: "",
    });

  const [guardando, setGuardando] =
    useState(false);

  const [ventaGuardada, setVentaGuardada] =
    useState(false);

  const [ventaPendiente, setVentaPendiente] =
    useState(false);

  const [enLinea, setEnLinea] =
    useState(() => navigator.onLine);

  const [mensajeError, setMensajeError] =
    useState("");

  const productosDisponibles = useMemo(
    () => {
      return productosLocales;
    },
    [productosLocales]
  );

  useEffect(() => {
    const conectado = () => setEnLinea(true);
    const desconectado = () => setEnLinea(false);

    window.addEventListener("online", conectado);
    window.addEventListener("offline", desconectado);

    return () => {
      window.removeEventListener("online", conectado);
      window.removeEventListener("offline", desconectado);
    };
  }, []);

  useEffect(() => {
    const recargarProductos = async () => {
      try {
        await importarInventarioLocalSiVacio();
        setProductosLocales(await getProductosRemotos());
      } catch (error) {
        console.error("No se pudo cargar el inventario:", error);
        const respaldo = getProductosLocalesRespaldo();
        setProductosLocales(respaldo);
        setMensajeError(
          respaldo.length > 0
            ? "No se pudo sincronizar con Supabase. Se muestra el inventario guardado en este equipo."
            : "No se pudo cargar el inventario desde Supabase."
        );
      }
    };

    recargarProductos();
    const cancelarSuscripcion = subscribeInventario(recargarProductos);

    return () => {
      cancelarSuscripcion();
    };
  }, []);

  const productosActivos = useMemo(
    () =>
      productosDisponibles.filter(
        (producto) =>
          producto.activo !== false
      ),
    [productosDisponibles]
  );

  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    const cargarClientes = async () => {
      try {
        await importarClientesLocalesSiVacio();
        setClientes(await getClientesRemotos());
      } catch (error) {
        console.error("No se pudieron cargar los clientes:", error);
        setClientes(getClientesLocalesRespaldo());
      }
    };

    cargarClientes();
    const cancelar = subscribeClientes(cargarClientes);
    return () => cancelar();
  }, []);

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

          const cantidadNumero =
            Math.trunc(
              Number(nuevaCantidad)
            );

          if (
            !Number.isFinite(
              cantidadNumero
            )
          ) {
            return item;
          }

          if (
            cantidadNumero >
            maximo
          ) {
            mostrarMensajeCodigo(
              `Solo hay ${maximo} unidades disponibles de ${item.producto.nombre}.`
            );
          }

          return {
            ...item,
            cantidad: Math.max(
              1,
              Math.min(
                maximo,
                cantidadNumero
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
    setTipoDocumento("recibo_interno");
    setDatosFactura({
      rut: "",
      razonSocial: "",
      giro: "",
      direccion: "",
      comuna: "",
    });
    setMensajeError("");
    setVentaGuardada(false);
    setVentaPendiente(false);
  };

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

  const registrarVenta = async () => {
    if (
      guardando ||
      carrito.length === 0
    ) {
      return;
    }

    if (
      tipoDocumento === "factura_electronica" &&
      [
        datosFactura.rut,
        datosFactura.razonSocial,
        datosFactura.giro,
        datosFactura.direccion,
        datosFactura.comuna,
      ].some((value) => !String(value || "").trim())
    ) {
      setMensajeError(
        "Completa todos los datos del receptor para preparar la factura."
      );
      return;
    }

    setMensajeError("");
    setGuardando(true);

    const siiWindow =
      tipoDocumento !== "recibo_interno"
        ? window.open("", "_blank")
        : null;

    if (siiWindow) {
      siiWindow.opener = null;
    }

    try {
      const inventarioActual = await getProductosRemotos();

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
            empresaId:
              user?.empresaId || "",
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
            usuario_id:
              user?.id || "",
            usuario_nombre:
              user?.name || "Usuario",
            usuario_email:
              user?.email || "",
            usuario_rol:
              user?.role || "",
          };
        });

      await importarVentasLocalesSiVacio();
      const resultadoVenta = await registrarVentaConRespaldo({
        ventaId: grupoVentaId,
        ventas: nuevasVentas,
        documento: {
          tipo: tipoDocumento,
          estado:
            tipoDocumento === "recibo_interno"
              ? "interno_emitido"
              : "pendiente_sii",
          receptor:
            tipoDocumento === "factura_electronica"
              ? {
                  rut: datosFactura.rut.trim(),
                  razon_social:
                    datosFactura.razonSocial.trim(),
                  giro: datosFactura.giro.trim(),
                  direccion:
                    datosFactura.direccion.trim(),
                  comuna: datosFactura.comuna.trim(),
                }
              : {
                  nombre:
                    clienteGuardado?.nombre ||
                    cliente.trim(),
                  rut:
                    clienteGuardado?.rut_dni || "",
                },
          datos_documento: {
            total: totalVenta,
            metodo_pago: metodoPago,
            observaciones: observaciones.trim(),
            usuario_id: user?.id || "",
            usuario_nombre: user?.name || "Usuario",
          },
        },
      });

      if (tipoDocumento === "recibo_interno") {
        imprimirReciboInterno({
          ventaId: grupoVentaId,
          fecha,
          items: carrito,
          cliente: cliente.trim(),
          metodoPago,
          observaciones: observaciones.trim(),
          total: totalVenta,
          usuario: user?.name || "Usuario",
        });
      } else {
        const siiUrl = SII_DOCUMENT_URLS[tipoDocumento];

        if (siiWindow) {
          siiWindow.location.replace(siiUrl);
        } else {
          window.open(siiUrl, "_blank", "noopener,noreferrer");
        }
      }

      setProductosLocales(await getProductosRemotos());

      window.dispatchEvent(
        new Event(
          "inventario-actualizado"
        )
      );

      registrarActividad({
        accion: "registrar_venta",
        modulo: "Ventas",
        entidadId: grupoVentaId,
        entidadNombre: `Venta ${grupoVentaId}`,
        descripcion: `Registró una venta por ${fmtMoney(
          totalVenta
        )}${cliente.trim() ? ` para ${cliente.trim()}` : ""}`,
        datosDespues: {
          cliente: cliente.trim() || "Venta sin cliente",
          metodo_pago: metodoPago,
          productos: carrito.length,
          unidades: totalProductos,
          total: totalVenta,
          tipo_documento: tipoDocumento,
        },
      });

      actualizarProductos?.();
      actualizarVentas?.();

      setVentaPendiente(resultadoVenta.pendiente);
      setVentaGuardada(true);

      window.setTimeout(() => {
        limpiarVenta();
      }, 2500);
    } catch (error) {
      siiWindow?.close();

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
                {ventaPendiente
                  ? "Venta guardada en este equipo"
                  : "Venta registrada correctamente"}
              </p>

              <p className="text-sm opacity-80">
                {ventaPendiente
                  ? "Se sincronizará automáticamente cuando vuelva internet."
                  : "El stock y el historial fueron actualizados."}
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

              {!enLinea && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
                  <CloudOff className="w-4 h-4" />
                  <span>Modo sin conexión</span>
                </div>
              )}
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

                          <CantidadEditable
                            item={item}
                            onCommit={
                              cambiarCantidad
                            }
                          />

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

                                  setDatosFactura((actual) => ({
                                    ...actual,
                                    rut:
                                      clienteGuardado.rut_dni ||
                                      actual.rut,
                                    razonSocial:
                                      clienteGuardado.nombre ||
                                      actual.razonSocial,
                                    direccion:
                                      clienteGuardado.direccion ||
                                      actual.direccion,
                                    comuna:
                                      clienteGuardado.comuna ||
                                      actual.comuna,
                                  }));

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
                    <Label>Documento</Label>

                    <div className="grid grid-cols-1 gap-2 mt-2">
                      {tiposDocumento.map((documento) => {
                        const Icono = documento.icono;
                        const activo =
                          tipoDocumento === documento.id;
                        const tributario =
                          documento.id !== "recibo_interno";

                        return (
                          <button
                            key={documento.id}
                            type="button"
                            onClick={() =>
                              setTipoDocumento(documento.id)
                            }
                            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                              activo
                                ? "border-primary bg-primary/10"
                                : "border-border hover:bg-muted/35"
                            }`}
                          >
                            <span
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                                activo
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Icono className="h-4 w-4" />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-foreground">
                                {documento.nombre}
                              </span>
                              <span
                                className={`mt-0.5 block text-[10px] ${
                                  tributario
                                    ? "text-amber-600 dark:text-amber-300"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {documento.descripcion}
                              </span>
                            </span>

                            {activo && (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {tipoDocumento !== "recibo_interno" && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 text-xs text-foreground">
                      <div className="flex items-start gap-2">
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p>
                          Primero guardaremos la venta y luego abriremos el
                          sistema oficial del SII. Cuando termines de emitir,
                          registra el folio desde el historial de Ventas.
                        </p>
                      </div>
                    </div>
                  )}

                  {tipoDocumento === "factura_electronica" && (
                    <div className="space-y-3 rounded-xl border border-border bg-muted/15 p-3">
                      <p className="text-xs font-semibold text-foreground">
                        Datos del receptor
                      </p>

                      <Input
                        value={datosFactura.rut}
                        onChange={(event) =>
                          setDatosFactura((actual) => ({
                            ...actual,
                            rut: event.target.value,
                          }))
                        }
                        placeholder="RUT"
                      />

                      <Input
                        value={datosFactura.razonSocial}
                        onChange={(event) =>
                          setDatosFactura((actual) => ({
                            ...actual,
                            razonSocial: event.target.value,
                          }))
                        }
                        placeholder="Razón social"
                      />

                      <Input
                        value={datosFactura.giro}
                        onChange={(event) =>
                          setDatosFactura((actual) => ({
                            ...actual,
                            giro: event.target.value,
                          }))
                        }
                        placeholder="Giro"
                      />

                      <Input
                        value={datosFactura.direccion}
                        onChange={(event) =>
                          setDatosFactura((actual) => ({
                            ...actual,
                            direccion: event.target.value,
                          }))
                        }
                        placeholder="Dirección"
                      />

                      <Input
                        value={datosFactura.comuna}
                        onChange={(event) =>
                          setDatosFactura((actual) => ({
                            ...actual,
                            comuna: event.target.value,
                          }))
                        }
                        placeholder="Comuna"
                      />
                    </div>
                  )}

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
                      {tipoDocumento === "recibo_interno" ? (
                        <Printer className="w-4 h-4 mr-2" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}

                      {tipoDocumento === "recibo_interno"
                        ? "Registrar e imprimir recibo"
                        : "Registrar y abrir el SII"}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}

function CantidadEditable({
  item,
  onCommit,
}) {
  const [valor, setValor] =
    useState(
      String(item.cantidad)
    );

  useEffect(() => {
    setValor(
      String(item.cantidad)
    );
  }, [item.cantidad]);

  const confirmar = () => {
    const stockMaximo =
      Math.max(
        1,
        Math.trunc(
          Number(
            item.producto
              .stock_actual || 0
          )
        )
      );

    const cantidadIngresada =
      Math.trunc(
        Number(valor)
      );

    const cantidadValida =
      Number.isFinite(
        cantidadIngresada
      )
        ? Math.max(
            1,
            Math.min(
              stockMaximo,
              cantidadIngresada
            )
          )
        : item.cantidad;

    setValor(
      String(cantidadValida)
    );

    onCommit(
      item.producto.id,
      cantidadIngresada
    );
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={valor}
      onFocus={(event) =>
        event.currentTarget.select()
      }
      onChange={(event) =>
        setValor(
          event.target.value.replace(
            /\D/g,
            ""
          )
        )
      }
      onBlur={confirmar}
      onKeyDown={(event) => {
        if (
          event.key === "Enter"
        ) {
          event.preventDefault();
          confirmar();
          event.currentTarget.blur();
        }

        if (
          event.key === "Escape"
        ) {
          setValor(
            String(item.cantidad)
          );
          event.currentTarget.blur();
        }
      }}
      aria-label={`Cantidad de ${item.producto.nombre}`}
      className="h-8 w-14 rounded-md border border-input bg-background px-1 text-center text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}
