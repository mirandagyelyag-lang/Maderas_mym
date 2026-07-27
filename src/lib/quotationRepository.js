import { supabase } from "@/lib/supabase";

const QUOTATIONS_KEY = "cotizaciones";

function readLocalQuotations() {
  try {
    const quotations = JSON.parse(
      localStorage.getItem(QUOTATIONS_KEY) || "[]"
    );

    return Array.isArray(quotations) ? quotations : [];
  } catch (error) {
    console.error("No se pudo leer el respaldo local de cotizaciones:", error);
    return [];
  }
}

function normalizeQuotation(quotation) {
  return {
    ...quotation,
    id: String(quotation.id || crypto.randomUUID()),
    numero: Number(quotation.numero || 0),
    fecha:
      quotation.fecha ||
      new Date().toISOString().split("T")[0],
    estado: quotation.estado || "Borrador",
    cliente_id: quotation.cliente_id
      ? String(quotation.cliente_id)
      : "",
    nombre_cliente: quotation.nombre_cliente || "",
    total: Number(quotation.total || 0),
    convertida_en_venta:
      quotation.convertida_en_venta === true,
    items: Array.isArray(quotation.items)
      ? quotation.items
      : [],
  };
}

function quotationToRow(quotation) {
  const normalized = normalizeQuotation(quotation);

  return {
    id: normalized.id,
    numero: normalized.numero,
    fecha: normalized.fecha,
    estado: normalized.estado,
    cliente_id: normalized.cliente_id || null,
    nombre_cliente: normalized.nombre_cliente,
    total: normalized.total,
    convertida_en_venta: normalized.convertida_en_venta,
    datos: normalized,
    activo: true,
    deleted_at: null,
    updated_at: new Date().toISOString(),
  };
}

function rowToQuotation(row) {
  return normalizeQuotation({
    ...(row.datos || {}),
    id: row.id,
    numero: row.numero,
    fecha: row.fecha,
    estado: row.estado,
    cliente_id: row.cliente_id || row.datos?.cliente_id || "",
    nombre_cliente: row.nombre_cliente,
    total: Number(row.total || 0),
    convertida_en_venta: row.convertida_en_venta === true,
  });
}

function saveLocalBackup(quotations) {
  localStorage.setItem(
    QUOTATIONS_KEY,
    JSON.stringify(Array.isArray(quotations) ? quotations : [])
  );
}

export function getCotizacionesLocalesRespaldo() {
  return readLocalQuotations().map(normalizeQuotation);
}

export async function getCotizacionesRemotas() {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("activo", true)
    .is("deleted_at", null)
    .order("numero", { ascending: false });

  if (error) throw error;

  const quotations = (data || []).map(rowToQuotation);
  saveLocalBackup(quotations);
  return quotations;
}

export async function importarCotizacionesLocalesSiVacio() {
  const { count, error: countError } = await supabase
    .from("cotizaciones")
    .select("id", { count: "exact", head: true });

  if (countError) throw countError;
  if (Number(count || 0) > 0) return false;

  const localQuotations = getCotizacionesLocalesRespaldo();
  if (localQuotations.length === 0) return false;

  const usedIds = new Set();
  const usedNumbers = new Set();
  let nextNumber = localQuotations.reduce(
    (maximum, quotation) =>
      Math.max(maximum, Number(quotation.numero || 0)),
    0
  );

  const rows = localQuotations.map((quotation) => {
    const normalized = normalizeQuotation(quotation);

    if (usedIds.has(normalized.id)) {
      normalized.id = crypto.randomUUID();
    }
    usedIds.add(normalized.id);

    if (
      normalized.numero <= 0 ||
      usedNumbers.has(normalized.numero)
    ) {
      nextNumber += 1;
      normalized.numero = nextNumber;
    }
    usedNumbers.add(normalized.numero);

    return quotationToRow(normalized);
  });

  const { error } = await supabase
    .from("cotizaciones")
    .upsert(rows, { onConflict: "id" });

  if (error) throw error;
  return true;
}

export async function guardarCotizacionRemota(quotation) {
  const { data, error } = await supabase
    .from("cotizaciones")
    .upsert(quotationToRow(quotation), {
      onConflict: "id",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToQuotation(data);
}

export async function eliminarCotizacionRemota(quotationId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("cotizaciones")
    .update({
      activo: false,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", String(quotationId));

  if (error) throw error;
}

export async function restaurarCotizacionRemota(quotation) {
  return guardarCotizacionRemota(quotation);
}

export function subscribeCotizaciones(onChange) {
  const channel = supabase
    .channel(`cotizaciones-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cotizaciones",
      },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}