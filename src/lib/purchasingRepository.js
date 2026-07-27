import { supabase } from "@/lib/supabase";

const PURCHASES_KEY = "compras";
const SUPPLIERS_KEY = "proveedores";
const SESSION_KEY = "user";

function readJSON(key, fallback) {
  try {
    return JSON.parse(
      localStorage.getItem(key) || JSON.stringify(fallback)
    );
  } catch (error) {
    console.error(`No se pudo leer ${key}:`, error);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readSession() {
  return readJSON(SESSION_KEY, null);
}

function uuidOrNull(value) {
  const candidate = String(value || "").trim();

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    candidate
  )
    ? candidate
    : null;
}

function normalizeSupplier(supplier) {
  return {
    ...supplier,
    id: String(supplier.id || crypto.randomUUID()),
    nombre: String(supplier.nombre || "").trim(),
    rut: supplier.rut || "",
    telefono: supplier.telefono || "",
    correo: supplier.correo || "",
    direccion: supplier.direccion || "",
    contacto: supplier.contacto || "",
    notas: supplier.notas || "",
    activo: supplier.activo !== false,
    deleted_at: supplier.deleted_at || null,
  };
}

function normalizePurchase(purchase) {
  const session = readSession();

  return {
    ...purchase,
    id: String(purchase.id || crypto.randomUUID()),
    fecha: purchase.fecha || new Date().toISOString(),
    proveedor_id: String(purchase.proveedor_id || ""),
    proveedor_nombre: purchase.proveedor_nombre || "",
    numero_documento: purchase.numero_documento || "",
    notas: purchase.notas || "",
    items: Array.isArray(purchase.items)
      ? purchase.items.map((item) => ({
          ...item,
          id: String(item.id || crypto.randomUUID()),
          producto_id: String(item.producto_id || ""),
          nombre: item.nombre || "",
          cantidad: Number(item.cantidad || 0),
          costo_unitario: Number(item.costo_unitario || 0),
        }))
      : [],
    total: Number(purchase.total || 0),
    usuario_id: purchase.usuario_id || session?.id || "",
    usuario_nombre:
      purchase.usuario_nombre ||
      session?.name ||
      session?.nombre ||
      "Usuario",
  };
}

function supplierToRow(supplier) {
  const normalized = normalizeSupplier(supplier);

  return {
    id: normalized.id,
    nombre: normalized.nombre,
    rut: normalized.rut,
    telefono: normalized.telefono,
    correo: normalized.correo,
    direccion: normalized.direccion,
    contacto: normalized.contacto,
    notas: normalized.notas,
    activo: normalized.activo,
    deleted_at: normalized.deleted_at,
    updated_at: new Date().toISOString(),
  };
}

function purchaseToRow(purchase) {
  const normalized = normalizePurchase(purchase);

  return {
    id: normalized.id,
    fecha: normalized.fecha,
    proveedor_id: normalized.proveedor_id,
    proveedor_nombre: normalized.proveedor_nombre,
    numero_documento: normalized.numero_documento,
    notas: normalized.notas,
    items: normalized.items,
    total: normalized.total,
    usuario_id: uuidOrNull(normalized.usuario_id),
    usuario_nombre: normalized.usuario_nombre,
  };
}

export function getProveedoresLocalesRespaldo() {
  const suppliers = readJSON(SUPPLIERS_KEY, []);

  return Array.isArray(suppliers)
    ? suppliers.map(normalizeSupplier)
    : [];
}

export function getComprasLocalesRespaldo() {
  const purchases = readJSON(PURCHASES_KEY, []);

  return Array.isArray(purchases)
    ? purchases.map(normalizePurchase)
    : [];
}

export async function getProveedoresRemotos() {
  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .eq("activo", true)
    .is("deleted_at", null)
    .order("nombre", { ascending: true });

  if (error) throw error;

  const suppliers = (data || []).map(normalizeSupplier);

  saveJSON(SUPPLIERS_KEY, suppliers);

  return suppliers;
}

export async function getComprasRemotas() {
  const { data, error } = await supabase
    .from("compras")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) throw error;

  const purchases = (data || []).map(normalizePurchase);

  saveJSON(PURCHASES_KEY, purchases);

  return purchases;
}

export async function importarComprasYProveedoresLocalesSiVacio() {
  const [
    {
      count: supplierCount,
      error: supplierCountError,
    },
    {
      count: purchaseCount,
      error: purchaseCountError,
    },
  ] = await Promise.all([
    supabase
      .from("proveedores")
      .select("id", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("compras")
      .select("id", {
        count: "exact",
        head: true,
      }),
  ]);

  if (supplierCountError) {
    throw supplierCountError;
  }

  if (purchaseCountError) {
    throw purchaseCountError;
  }

  if (Number(supplierCount || 0) === 0) {
    const localSuppliers =
      getProveedoresLocalesRespaldo();

    if (localSuppliers.length > 0) {
      const { error } = await supabase
        .from("proveedores")
        .upsert(
          localSuppliers.map(supplierToRow),
          {
            onConflict: "id",
          }
        );

      if (error) throw error;
    }
  }

  if (Number(purchaseCount || 0) === 0) {
    const localPurchases =
      getComprasLocalesRespaldo();

    if (localPurchases.length > 0) {
      const { error } = await supabase
        .from("compras")
        .upsert(
          localPurchases.map(purchaseToRow),
          {
            onConflict: "id",
          }
        );

      if (error) throw error;
    }
  }

  return true;
}

export async function guardarProveedorRemoto(supplier) {
  const { data, error } = await supabase
    .from("proveedores")
    .upsert(supplierToRow(supplier), {
      onConflict: "id",
    })
    .select()
    .single();

  if (error) throw error;

  const saved = normalizeSupplier(data);

  const suppliers =
    getProveedoresLocalesRespaldo();

  const index = suppliers.findIndex(
    (item) =>
      String(item.id) === String(saved.id)
  );

  if (index >= 0) {
    suppliers[index] = saved;
  } else {
    suppliers.push(saved);
  }

  saveJSON(SUPPLIERS_KEY, suppliers);

  return saved;
}

export async function eliminarProveedorRemoto(
  supplierId
) {
  const {
    count,
    error: countError,
  } = await supabase
    .from("compras")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "proveedor_id",
      String(supplierId)
    );

  if (countError) throw countError;

  if (Number(count || 0) > 0) {
    throw new Error(
      "No puedes eliminar este proveedor porque tiene compras registradas."
    );
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("proveedores")
    .update({
      activo: false,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", String(supplierId));

  if (error) throw error;

  saveJSON(
    SUPPLIERS_KEY,
    getProveedoresLocalesRespaldo().filter(
      (item) =>
        String(item.id) !==
        String(supplierId)
    )
  );
}

export async function registrarCompraRemota(purchase) {
  const normalized =
    normalizePurchase(purchase);

  const { data, error } = await supabase.rpc(
    "registrar_compra_inventario",
    {
      p_compra: purchaseToRow(normalized),
    }
  );

  if (error) throw error;

  const saved = normalizePurchase(data);

  const purchases =
    getComprasLocalesRespaldo();

  saveJSON(PURCHASES_KEY, [
    saved,
    ...purchases.filter(
      (item) =>
        String(item.id) !==
        String(saved.id)
    ),
  ]);

  return saved;
}

export function subscribeProveedores(onChange) {
  const channel = supabase
    .channel(
      `proveedores-${crypto.randomUUID()}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "proveedores",
      },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeCompras(onChange) {
  const channel = supabase
    .channel(
      `compras-${crypto.randomUUID()}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "compras",
      },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}