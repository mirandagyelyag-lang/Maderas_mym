import { supabase } from "@/lib/supabase";

const CLIENTS_KEY = "mis_clientes_data";
const DEBTS_KEY = "deudas_clientes_barraca";

const normalizeClient = (client) => ({
  id: String(client.id || crypto.randomUUID()),
  nombre: String(client.nombre || "").trim(),
  telefono_whatsapp: String(client.telefono_whatsapp || "").trim(),
  email: String(client.email || "").trim(),
  direccion: String(client.direccion || "").trim(),
  rut_dni: String(client.rut_dni || "").trim(),
  notas: String(client.notas || "").trim(),
  activo: client.activo !== false,
});

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    console.error(`No se pudo leer ${key}:`, error);
    return fallback;
  }
}

export function getClientesLocalesRespaldo() {
  const clients = readLocal(CLIENTS_KEY, []);
  return Array.isArray(clients) ? clients : [];
}

export function getDeudasLocalesRespaldo() {
  const debts = readLocal(DEBTS_KEY, {});
  return debts && typeof debts === "object" && !Array.isArray(debts)
    ? debts
    : {};
}

export async function getClientesRemotos() {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("activo", true)
    .is("deleted_at", null)
    .order("nombre", { ascending: true });

  if (error) throw error;

  const clients = (data || []).map(normalizeClient);
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  return clients;
}

export async function getMovimientosClientesRemotos() {
  const { data, error } = await supabase
    .from("movimientos_clientes")
    .select("id, cliente_id, tipo, monto, fecha, nota")
    .order("fecha", { ascending: true });

  if (error) throw error;

  const grouped = (data || []).reduce((result, movement) => {
    const clientId = String(movement.cliente_id);
    if (!result[clientId]) result[clientId] = [];
    result[clientId].push({
      id: movement.id,
      tipo: movement.tipo,
      monto: Number(movement.monto || 0),
      fecha: movement.fecha,
      nota: movement.nota || "",
    });
    return result;
  }, {});

  localStorage.setItem(DEBTS_KEY, JSON.stringify(grouped));
  return grouped;
}

export async function importarClientesLocalesSiVacio() {
  const { count, error: countError } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true });

  if (countError) throw countError;
  if (Number(count || 0) > 0) return false;

  const localClients = getClientesLocalesRespaldo();
  if (localClients.length === 0) return false;

  const clients = localClients.map(normalizeClient);
  const { error } = await supabase.from("clientes").upsert(clients, {
    onConflict: "id",
  });
  if (error) throw error;

  const validIds = new Set(clients.map((client) => client.id));
  const localDebts = getDeudasLocalesRespaldo();
  const movements = Object.entries(localDebts).flatMap(
    ([clientId, entries]) =>
      validIds.has(String(clientId)) && Array.isArray(entries)
        ? entries.map((movement) => ({
            id: String(movement.id || crypto.randomUUID()),
            cliente_id: String(clientId),
            tipo: movement.tipo,
            monto: Number(movement.monto || 0),
            fecha: movement.fecha || new Date().toISOString(),
            nota: movement.nota || "",
          }))
        : []
  );

  if (movements.length > 0) {
    const validMovements = movements.filter(
      (movement) =>
        ["fiado", "abono"].includes(movement.tipo) && movement.monto > 0
    );
    const { error: movementsError } = await supabase
      .from("movimientos_clientes")
      .insert(validMovements);
    if (movementsError) throw movementsError;
  }

  return true;
}

export async function guardarClienteRemoto(client) {
  const normalized = normalizeClient(client);
  const { data, error } = await supabase
    .from("clientes")
    .upsert(
      {
        ...normalized,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw error;
  return normalizeClient(data);
}

export async function eliminarClienteRemoto(clientId) {
  const { error } = await supabase
    .from("clientes")
    .update({
      activo: false,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(clientId));

  if (error) throw error;
}

export async function restaurarClienteRemoto(client) {
  return guardarClienteRemoto({ ...client, activo: true });
}

export async function registrarMovimientoClienteRemoto(clientId, movement) {
  const record = {
    id: String(movement.id || crypto.randomUUID()),
    cliente_id: String(clientId),
    tipo: movement.tipo,
    monto: Number(movement.monto || 0),
    fecha: movement.fecha || new Date().toISOString(),
    nota: movement.nota || "",
  };

  const { data, error } = await supabase
    .from("movimientos_clientes")
    .insert(record)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function subscribeClientes(onChange) {
  const channel = supabase
    .channel(`clientes-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clientes" },
      () => onChange?.()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "movimientos_clientes" },
      () => onChange?.()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}