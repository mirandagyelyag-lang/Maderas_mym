import { supabase } from "@/lib/supabase";

const LEGACY_INVENTORY_KEY = "inventario";

const normalizeProduct = (product) => ({
  id: String(product.id),
  nombre: product.nombre || "",
  categoria: product.categoria || "",
  subcategoria: product.subcategoria || "",
  unidad_medida: product.unidad_medida || "Unidad",
  precio_unitario: Number(product.precio_unitario || 0),
  costo_unitario: Number(product.costo_unitario || 0),
  stock_actual: Number(product.stock_actual || 0),
  stock_minimo: Number(product.stock_minimo || 0),
  foto_url: product.foto_url || "",
  codigo_barras: product.codigo_barras || "",
  activo: product.activo !== false,
});

export function getProductosLocalesRespaldo() {
  try {
    const products = JSON.parse(
      localStorage.getItem(LEGACY_INVENTORY_KEY) || "[]"
    );
    return Array.isArray(products) ? products : [];
  } catch (error) {
    console.error("No se pudo leer el inventario anterior:", error);
    return [];
  }
}

function prepareLegacyProducts(products) {
  const usedIds = new Set();
  const usedBarcodes = new Set();

  return products.map((product) => {
    const normalized = normalizeProduct({
      ...product,
      id: product?.id || crypto.randomUUID(),
    });

    if (!normalized.id || usedIds.has(normalized.id)) {
      normalized.id = crypto.randomUUID();
    }
    usedIds.add(normalized.id);

    const barcode = String(normalized.codigo_barras || "")
      .trim()
      .replace(/\s+/g, "");

    if (barcode && usedBarcodes.has(barcode)) {
      normalized.codigo_barras = "";
    } else {
      normalized.codigo_barras = barcode;
      if (barcode) usedBarcodes.add(barcode);
    }

    return normalized;
  });
}

export async function getProductosRemotos() {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeProduct);
}

export async function importarInventarioLocalSiVacio(defaultProducts = []) {
  const { count, error: countError } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true });

  if (countError) throw countError;
  if (Number(count || 0) > 0) return false;

  const legacyProducts = getProductosLocalesRespaldo();
  const productsToImport =
    legacyProducts.length > 0 ? legacyProducts : defaultProducts;

  if (productsToImport.length === 0) return false;

  const { error } = await supabase
    .from("productos")
    .upsert(prepareLegacyProducts(productsToImport), {
      onConflict: "id",
    });

  if (error) throw error;
  return true;
}

export async function guardarProductoRemoto(product) {
  const normalized = normalizeProduct({
    ...product,
    id: product.id || crypto.randomUUID(),
  });

  const { data, error } = await supabase
    .from("productos")
    .upsert(normalized, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeProduct(data);
}

export async function eliminarProductoRemoto(productId) {
  const { error } = await supabase
    .from("productos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", String(productId));

  if (error) throw error;
}

export async function restaurarProductoRemoto(productId) {
  const { error } = await supabase
    .from("productos")
    .update({ deleted_at: null })
    .eq("id", String(productId));

  if (error) throw error;
}

export async function ajustarStockRemoto({
  productoId,
  tipo,
  cantidad,
  motivo = "",
  referenciaId = "",
  referenciaTipo = "",
}) {
  const { data, error } = await supabase.rpc(
    "ajustar_stock_inventario",
    {
      p_producto_id: String(productoId),
      p_tipo: tipo,
      p_cantidad: Number(cantidad),
      p_motivo: motivo,
      p_referencia_id: String(referenciaId || ""),
      p_referencia_tipo: referenciaTipo,
    }
  );

  if (error) throw error;
  return normalizeProduct(data);
}

export async function descontarStockVentaRemoto({ ventaId, items }) {
  const { data, error } = await supabase.rpc(
    "descontar_stock_venta",
    {
      p_venta_id: String(ventaId),
      p_items: items.map((item) => ({
        producto_id: String(item.producto.id),
        cantidad: Number(item.cantidad),
      })),
    }
  );

  if (error) throw error;
  return (data || []).map(normalizeProduct);
}

export function subscribeInventario(onChange) {
  const channel = supabase
    .channel(`productos-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "productos" },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getMovimientosRemotos(productId) {
  const { data, error } = await supabase
    .from("movimientos_inventario")
    .select("*")
    .eq("producto_id", String(productId))
    .order("fecha", { ascending: false });

  if (error) throw error;
  return data || [];
}