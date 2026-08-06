import { supabase } from "@/lib/supabase";
import { esErrorDeConexion, guardarCache, leerCache } from "@/lib/offlineDb";

const CACHE_KEY = "cubicaciones_mm";

const normalize = (item = {}) => ({
  id: String(item.id || crypto.randomUUID()),
  tipo: item.tipo || "tablas",
  tipoNombre: item.tipo_nombre || item.tipoNombre || "Tablas y vigas",
  medidas: item.medidas || {},
  volumen: Number(item.volumen_m3 ?? item.volumen ?? 0),
  origen: item.origen || "manual",
  confianza: item.confianza == null ? null : Number(item.confianza),
  observaciones: item.observaciones || "",
  fecha: item.created_at || item.fecha || new Date().toISOString(),
  usuario: item.usuario_nombre || item.usuario || "Usuario",
});

async function cache(items) {
  const normalized = (items || []).map(normalize);
  localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
  await guardarCache(CACHE_KEY, normalized);
  return normalized;
}

export function getCubicacionesLocales() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    return Array.isArray(value) ? value.map(normalize) : [];
  } catch {
    return [];
  }
}

export async function getCubicaciones() {
  try {
    const { data, error } = await supabase.from("cubicaciones").select("*")
      .order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return cache(data || []);
  } catch (error) {
    if (!esErrorDeConexion(error) && error?.code !== "42P01") throw error;
    const indexed = await leerCache(CACHE_KEY, null);
    return Array.isArray(indexed) ? indexed.map(normalize) : getCubicacionesLocales();
  }
}

export async function guardarCubicacion(item) {
  const normalized = normalize(item);
  const current = getCubicacionesLocales();
  await cache([normalized, ...current.filter((row) => row.id !== normalized.id)].slice(0, 500));
  const payload = {
    id: normalized.id, tipo: normalized.tipo, tipo_nombre: normalized.tipoNombre,
    medidas: normalized.medidas, volumen_m3: normalized.volumen,
    origen: normalized.origen, confianza: normalized.confianza,
    observaciones: normalized.observaciones, usuario_nombre: normalized.usuario,
    created_at: normalized.fecha,
  };
  const { data, error } = await supabase.from("cubicaciones")
    .upsert(payload, { onConflict: "id" }).select("*").single();
  if (error) {
    if (esErrorDeConexion(error) || error.code === "42P01") return { data: normalized, pendiente: true };
    throw error;
  }
  return { data: normalize(data), pendiente: false };
}

export async function eliminarCubicacion(id) {
  await cache(getCubicacionesLocales().filter((item) => item.id !== String(id)));
  const { error } = await supabase.from("cubicaciones").delete().eq("id", String(id));
  if (error && !esErrorDeConexion(error) && error.code !== "42P01") throw error;
}

export function subscribeCubicaciones(onChange) {
  const channel = supabase.channel(`cubicaciones-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "cubicaciones" }, () => onChange?.())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
