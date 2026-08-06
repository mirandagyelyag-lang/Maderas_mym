import { supabase } from "@/lib/supabase";

import {
  actualizarPendiente,
  agregarPendiente,
  eliminarPendiente,
  esErrorDeConexion,
  guardarCache,
  leerCache,
  listarPendientes,
} from "@/lib/offlineDb";

const LEGACY_SALES_KEY = "ventas";
const SALES_CACHE_KEY = "ventas";
const INVENTORY_CACHE_KEY = "inventario";
const OUTBOX_TYPE = "venta";
const SALES_DOCUMENTS_CACHE_KEY = "documentos_venta";
const OUTBOX_DOCUMENT_TYPE = "documento_venta";

const normalizeSale = (sale) => ({
  id: String(sale.id || crypto.randomUUID()),
  venta_grupo_id: String(
    sale.venta_grupo_id || sale.id || crypto.randomUUID()
  ),
  fecha: sale.fecha || new Date().toISOString(),
  producto_id: sale.producto_id ? String(sale.producto_id) : null,
  nombre_producto: sale.nombre_producto || "Producto",
  categoria: sale.categoria || "",
  cantidad: Number(sale.cantidad || 0),
  precio_unitario: Number(sale.precio_unitario || 0),
  costo_unitario: Number(sale.costo_unitario || 0),
  total: Number(sale.total || 0),
  total_venta: Number(sale.total_venta || sale.total || 0),
  metodo_pago: sale.metodo_pago || "Sin especificar",
  cliente: sale.cliente || "",
  cliente_id: sale.cliente_id ? String(sale.cliente_id) : null,
  telefono_cliente: sale.telefono_cliente || "",
  email_cliente: sale.email_cliente || "",
  direccion_cliente: sale.direccion_cliente || "",
  rut_cliente: sale.rut_cliente || "",
  observaciones: sale.observaciones || "",
  cotizacion_id: sale.cotizacion_id ? String(sale.cotizacion_id) : null,
  cotizacion_numero: sale.cotizacion_numero
    ? String(sale.cotizacion_numero)
    : null,
  usuario_id: sale.usuario_id || null,
  usuario_nombre: sale.usuario_nombre || "Usuario del sistema",
  usuario_email: sale.usuario_email || "",
  usuario_rol: sale.usuario_rol || "",
});

function writeLegacySales(sales) {
  localStorage.setItem(LEGACY_SALES_KEY, JSON.stringify(sales));
}

async function cacheSales(sales) {
  const normalized = (sales || []).map(normalizeSale);
  writeLegacySales(normalized);
  await guardarCache(SALES_CACHE_KEY, normalized);
  return normalized;
}

async function addSaleToLocalCache(sales) {
  const current = await getVentasLocalesRespaldoAsync();
  const ids = new Set();
  const merged = [...sales.map(normalizeSale), ...current].filter((item) => {
    const id = String(item.id);
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });

  await cacheSales(merged);
}

async function applyOptimisticStock(sales) {
  const cachedInventory =
    (await leerCache(INVENTORY_CACHE_KEY, null)) ||
    JSON.parse(localStorage.getItem(INVENTORY_CACHE_KEY) || "[]");

  if (!Array.isArray(cachedInventory)) return;

  const quantities = sales.reduce((result, sale) => {
    const productId = String(sale.producto_id || "");
    result[productId] =
      Number(result[productId] || 0) + Number(sale.cantidad || 0);
    return result;
  }, {});

  const updated = cachedInventory.map((product) => {
    const quantity = Number(quantities[String(product.id)] || 0);

    return quantity > 0
      ? {
          ...product,
          stock_actual: Math.max(
            0,
            Number(product.stock_actual || 0) - quantity
          ),
        }
      : product;
  });

  localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(updated));
  await guardarCache(INVENTORY_CACHE_KEY, updated);
}

const normalizeSalesDocument = (document) => ({
  venta_id: String(document.venta_id || document.ventaId),
  tipo: document.tipo || "recibo_interno",
  estado:
    document.estado ||
    (document.tipo === "recibo_interno"
      ? "interno_emitido"
      : "pendiente_sii"),
  folio: document.folio ? String(document.folio) : null,
  proveedor: document.proveedor || "",
  proveedor_documento_id: document.proveedor_documento_id || "",
  track_id: document.track_id || "",
  pdf_url: document.pdf_url || "",
  xml_url: document.xml_url || "",
  error_mensaje: document.error_mensaje || "",
  receptor: document.receptor || {},
  datos_documento: document.datos_documento || {},
  fecha_emision:
    document.fecha_emision ||
    (document.tipo === "recibo_interno"
      ? new Date().toISOString()
      : null),
});

async function cacheSalesDocument(document) {
  const normalized = normalizeSalesDocument(document);
  const current = await leerCache(SALES_DOCUMENTS_CACHE_KEY, []);
  const documents = Array.isArray(current) ? current : [];
  const updated = [
    normalized,
    ...documents.filter(
      (item) => String(item.venta_id) !== normalized.venta_id
    ),
  ];

  await guardarCache(SALES_DOCUMENTS_CACHE_KEY, updated);
  return normalized;
}

export async function guardarDocumentoVentaRemoto(document) {
  const normalized = normalizeSalesDocument(document);
  await cacheSalesDocument(normalized);

  const { data, error } = await supabase
    .from("documentos_venta")
    .upsert(normalized, { onConflict: "venta_id" })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeSalesDocument(data);
}

export async function getDocumentoVentaLocal(ventaId) {
  const documents = await leerCache(SALES_DOCUMENTS_CACHE_KEY, []);

  return (
    (Array.isArray(documents) ? documents : []).find(
      (item) => String(item.venta_id) === String(ventaId)
    ) || null
  );
}

export async function getDocumentosVentaLocales() {
  const documents = await leerCache(SALES_DOCUMENTS_CACHE_KEY, []);
  return Array.isArray(documents)
    ? documents.map(normalizeSalesDocument)
    : [];
}

export async function getDocumentosVentaRemotos() {
  try {
    const { data, error } = await supabase
      .from("documentos_venta")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const documents = (data || []).map(normalizeSalesDocument);
    await guardarCache(SALES_DOCUMENTS_CACHE_KEY, documents);
    return documents;
  } catch (error) {
    if (!esErrorDeConexion(error)) throw error;
    return getDocumentosVentaLocales();
  }
}

export async function guardarDocumentoVentaConRespaldo(document) {
  const normalized = normalizeSalesDocument(document);

  try {
    const data = await guardarDocumentoVentaRemoto(normalized);
    await eliminarPendiente(`documento:${normalized.venta_id}`);
    window.dispatchEvent(new Event("documentos-venta-actualizados"));

    return {
      data,
      pendiente: false,
    };
  } catch (error) {
    if (!esErrorDeConexion(error)) throw error;

    await cacheSalesDocument(normalized);
    await agregarPendiente({
      id: `documento:${normalized.venta_id}`,
      tipo: OUTBOX_DOCUMENT_TYPE,
      ventaId: normalized.venta_id,
      documento: normalized,
      ultimoError: String(error?.message || "Sin conexión"),
    });

    window.dispatchEvent(new Event("documentos-venta-actualizados"));

    return {
      data: normalized,
      pendiente: true,
    };
  }
}

export function getVentasLocalesRespaldo() {
  try {
    const sales = JSON.parse(
      localStorage.getItem(LEGACY_SALES_KEY) || "[]"
    );
    return Array.isArray(sales) ? sales.map(normalizeSale) : [];
  } catch (error) {
    console.error("No se pudo leer el respaldo local de ventas:", error);
    return [];
  }
}

export async function getVentasLocalesRespaldoAsync() {
  const indexedSales = await leerCache(SALES_CACHE_KEY, null);

  return Array.isArray(indexedSales)
    ? indexedSales.map(normalizeSale)
    : getVentasLocalesRespaldo();
}

export async function getVentasRemotas() {
  try {
    const { data, error } = await supabase
      .from("ventas")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) throw error;
    return cacheSales(data || []);
  } catch (error) {
    if (!esErrorDeConexion(error)) throw error;

    return getVentasLocalesRespaldoAsync();
  }
}

export async function importarVentasLocalesSiVacio() {
  if (!navigator.onLine) return false;

  const { count, error: countError } = await supabase
    .from("ventas")
    .select("id", { count: "exact", head: true });

  if (countError) throw countError;
  if (Number(count || 0) > 0) return false;

  const legacySales = getVentasLocalesRespaldo();
  if (legacySales.length === 0) return false;

  const usedIds = new Set();
  const normalized = legacySales.map((sale) => {
    const item = normalizeSale(sale);
    if (usedIds.has(item.id)) item.id = crypto.randomUUID();
    usedIds.add(item.id);
    return item;
  });

  const { error } = await supabase
    .from("ventas")
    .upsert(normalized, { onConflict: "id" });

  if (error?.code === "42501") return false;
  if (error) throw error;
  return true;
}

export async function registrarVentaRemota({ ventaId, ventas }) {
  const lineas = ventas.map(normalizeSale);
  const { data, error } = await supabase.rpc("registrar_venta_completa", {
    p_venta_id: String(ventaId),
    p_lineas: lineas,
  });

  if (error) throw error;

  const saved = (data || lineas).map(normalizeSale);
  await addSaleToLocalCache(saved);
  return saved;
}

export async function registrarVentaConRespaldo({
  ventaId,
  ventas,
  documento = null,
}) {
  const lineas = ventas.map(normalizeSale);

  try {
    const data = await registrarVentaRemota({
      ventaId,
      ventas: lineas,
    });

    let documentoPendiente = false;
    let advertenciaDocumento = "";

    if (documento) {
      try {
        await guardarDocumentoVentaRemoto({
          ...documento,
          venta_id: String(ventaId),
        });
      } catch (documentError) {
        await cacheSalesDocument({
          ...documento,
          venta_id: String(ventaId),
        });

        documentoPendiente = true;
        advertenciaDocumento = String(
          documentError?.message ||
            "No se pudo guardar la información del documento."
        );

        await agregarPendiente({
          id: `documento:${String(ventaId)}`,
          tipo: OUTBOX_DOCUMENT_TYPE,
          ventaId: String(ventaId),
          documento: {
            ...documento,
            venta_id: String(ventaId),
          },
          ultimoError: advertenciaDocumento,
        });
      }
    }

    return {
      data,
      pendiente: false,
      documentoPendiente,
      advertenciaDocumento,
    };
  } catch (error) {
    if (!esErrorDeConexion(error)) throw error;

    await agregarPendiente({
      id: `venta:${String(ventaId)}`,
      tipo: OUTBOX_TYPE,
      ventaId: String(ventaId),
      ventas: lineas,
      documento: documento
        ? {
            ...documento,
            venta_id: String(ventaId),
          }
        : null,
      ultimoError: String(error?.message || "Sin conexión"),
    });

    await addSaleToLocalCache(lineas);
    await applyOptimisticStock(lineas);

    if (documento) {
      await cacheSalesDocument({
        ...documento,
        venta_id: String(ventaId),
      });
    }

    window.dispatchEvent(new Event("inventario-actualizado"));
    window.dispatchEvent(new Event("ventas-actualizadas"));

    return {
      data: lineas,
      pendiente: true,
      documentoPendiente: Boolean(documento),
      advertenciaDocumento: "",
    };
  }
}

export async function getVentasPendientes() {
  return listarPendientes(OUTBOX_TYPE);
}

export async function sincronizarVentasPendientes() {
  if (!navigator.onLine) {
    return {
      sincronizadas: 0,
      fallidas: 0,
    };
  }

  const pending = await listarPendientes(OUTBOX_TYPE);
  let sincronizadas = 0;
  let fallidas = 0;

  for (const operation of pending) {
    try {
      await actualizarPendiente(operation.id, {
        estado: "sincronizando",
        intentos: Number(operation.intentos || 0) + 1,
      });

      await registrarVentaRemota({
        ventaId: operation.ventaId,
        ventas: operation.ventas,
      });

      if (operation.documento) {
        await guardarDocumentoVentaRemoto(operation.documento);
      }

      await eliminarPendiente(operation.id);
      sincronizadas += 1;
    } catch (error) {
      fallidas += 1;

      await actualizarPendiente(operation.id, {
        estado: esErrorDeConexion(error) ? "pendiente" : "requiere_revision",
        ultimoError: String(error?.message || "No se pudo sincronizar"),
      });

      if (esErrorDeConexion(error)) break;
    }
  }

  if (sincronizadas > 0) {
    window.dispatchEvent(new Event("inventario-actualizado"));
    window.dispatchEvent(new Event("ventas-actualizadas"));
  }

  return {
    sincronizadas,
    fallidas,
  };
}

export async function sincronizarDocumentosPendientes() {
  if (!navigator.onLine) return;

  const pending = await listarPendientes(OUTBOX_DOCUMENT_TYPE);

  for (const operation of pending) {
    try {
      await guardarDocumentoVentaRemoto(operation.documento);
      await eliminarPendiente(operation.id);
    } catch (error) {
      await actualizarPendiente(operation.id, {
        estado: esErrorDeConexion(error)
          ? "pendiente"
          : "requiere_revision",
        intentos: Number(operation.intentos || 0) + 1,
        ultimoError: String(
          error?.message || "No se pudo sincronizar el documento"
        ),
      });

      if (esErrorDeConexion(error)) break;
    }
  }
}

export function iniciarSincronizacionVentas() {
  const sync = () => {
    Promise.all([
      sincronizarVentasPendientes(),
      sincronizarDocumentosPendientes(),
    ]).catch((error) => {
      console.error(
        "No se pudieron sincronizar las operaciones pendientes:",
        error
      );
    });
  };

  window.addEventListener("online", sync);

  if (navigator.onLine) {
    window.setTimeout(sync, 1500);
  }

  return () => window.removeEventListener("online", sync);
}

export function subscribeVentas(onChange) {
  const channel = supabase
    .channel(`ventas-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ventas" },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeDocumentosVenta(onChange) {
  const channel = supabase
    .channel(`documentos-venta-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "documentos_venta",
      },
      () => onChange?.()
    )
    .subscribe();

  const handleLocalChange = () => onChange?.();
  window.addEventListener(
    "documentos-venta-actualizados",
    handleLocalChange
  );

  return () => {
    window.removeEventListener(
      "documentos-venta-actualizados",
      handleLocalChange
    );
    supabase.removeChannel(channel);
  };
}
