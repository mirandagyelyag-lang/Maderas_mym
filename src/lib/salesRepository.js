import { supabase } from "@/lib/supabase";

const LEGACY_SALES_KEY = "ventas";

const normalizeSale = (sale) => ({
  id: String(sale.id || crypto.randomUUID()),
  venta_grupo_id: String(sale.venta_grupo_id || sale.id || crypto.randomUUID()),
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

export function getVentasLocalesRespaldo() {
  try {
    const sales = JSON.parse(localStorage.getItem(LEGACY_SALES_KEY) || "[]");
    return Array.isArray(sales) ? sales : [];
  } catch (error) {
    console.error("No se pudo leer el respaldo local de ventas:", error);
    return [];
  }
}

export async function getVentasRemotas() {
  const { data, error } = await supabase
    .from("ventas")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeSale);
}

export async function importarVentasLocalesSiVacio() {
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

  if (error?.code === "42501") {
    return false;
  }
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
  return (data || []).map(normalizeSale);
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