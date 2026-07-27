import { supabase } from "@/lib/supabase";

const CAJA_ACTUAL_KEY = "caja_actual";
const CIERRES_KEY = "cierres_caja";

function readJSON(key, fallback) {
  try {
    return JSON.parse(
      localStorage.getItem(key) ||
        JSON.stringify(fallback)
    );
  } catch (error) {
    console.error(
      `No se pudo leer ${key}:`,
      error
    );

    return fallback;
  }
}

function guardarCajaActualLocal(caja) {
  if (caja) {
    localStorage.setItem(
      CAJA_ACTUAL_KEY,
      JSON.stringify(caja)
    );
  } else {
    localStorage.removeItem(
      CAJA_ACTUAL_KEY
    );
  }
}

function guardarCierresLocales(cierres) {
  localStorage.setItem(
    CIERRES_KEY,
    JSON.stringify(
      Array.isArray(cierres)
        ? cierres
        : []
    )
  );
}

function normalizarCaja(caja) {
  if (!caja) return null;

  return {
    ...caja,
    id: String(caja.id),
    estado:
      caja.estado || "abierta",
    monto_apertura: Number(
      caja.monto_apertura || 0
    ),
    ventas_efectivo: Number(
      caja.ventas_efectivo || 0
    ),
    ventas_transferencia: Number(
      caja.ventas_transferencia || 0
    ),
    ventas_tarjeta: Number(
      caja.ventas_tarjeta || 0
    ),
    gastos_efectivo: Number(
      caja.gastos_efectivo || 0
    ),
    caja_esperada: Number(
      caja.caja_esperada || 0
    ),
    monto_contado: Number(
      caja.monto_contado || 0
    ),
    diferencia: Number(
      caja.diferencia || 0
    ),
    observaciones:
      caja.observaciones || "",
    usuario_id:
      caja.usuario_id ||
      caja.usuario_apertura_id ||
      caja.usuario_cierre_id ||
      "",
    usuario_nombre:
      caja.usuario_nombre ||
      caja.usuario_apertura_nombre ||
      caja.usuario_cierre_nombre ||
      "Usuario",
  };
}

function cajaARow(caja) {
  const normalizada =
    normalizarCaja(caja);

  return {
    id: normalizada.id,
    estado: normalizada.estado,
    fecha_apertura:
      normalizada.fecha_apertura,
    monto_apertura:
      normalizada.monto_apertura,
    fecha_cierre:
      normalizada.fecha_cierre ||
      null,
    ventas_efectivo:
      normalizada.ventas_efectivo,
    ventas_transferencia:
      normalizada
        .ventas_transferencia,
    ventas_tarjeta:
      normalizada.ventas_tarjeta,
    gastos_efectivo:
      normalizada.gastos_efectivo,
    caja_esperada:
      normalizada.caja_esperada,
    monto_contado:
      normalizada.monto_contado,
    diferencia:
      normalizada.diferencia,
    observaciones:
      normalizada.observaciones,
    usuario_apertura_id:
      normalizada
        .usuario_apertura_id ||
      normalizada.usuario_id ||
      null,
    usuario_apertura_nombre:
      normalizada
        .usuario_apertura_nombre ||
      normalizada.usuario_nombre,
    usuario_cierre_id:
      normalizada
        .usuario_cierre_id ||
      null,
    usuario_cierre_nombre:
      normalizada
        .usuario_cierre_nombre ||
      "",
    updated_at:
      new Date().toISOString(),
  };
}

function rowACaja(row) {
  return normalizarCaja({
    ...row,
    usuario_id:
      row.usuario_cierre_id ||
      row.usuario_apertura_id ||
      "",
    usuario_nombre:
      row.usuario_cierre_nombre ||
      row.usuario_apertura_nombre ||
      "Usuario",
  });
}

export function getCajaActualLocalRespaldo() {
  return normalizarCaja(
    readJSON(
      CAJA_ACTUAL_KEY,
      null
    )
  );
}

export function getCierresCajaLocalesRespaldo() {
  const cierres = readJSON(
    CIERRES_KEY,
    []
  );

  return Array.isArray(cierres)
    ? cierres.map(normalizarCaja)
    : [];
}

export async function getCajaActualRemota() {
  const {
    data,
    error,
  } = await supabase
    .from("cajas")
    .select("*")
    .eq("estado", "abierta")
    .order("fecha_apertura", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const caja = data
    ? rowACaja(data)
    : null;

  guardarCajaActualLocal(caja);

  return caja;
}

export async function getCierresCajaRemotos() {
  const {
    data,
    error,
  } = await supabase
    .from("cajas")
    .select("*")
    .eq("estado", "cerrada")
    .order("fecha_cierre", {
      ascending: false,
    });

  if (error) throw error;

  const cierres = (
    data || []
  ).map(rowACaja);

  guardarCierresLocales(cierres);

  return cierres;
}

export async function importarCajaLocalSiVacio() {
  const {
    count,
    error: countError,
  } = await supabase
    .from("cajas")
    .select("id", {
      count: "exact",
      head: true,
    });

  if (countError) {
    throw countError;
  }

  if (Number(count || 0) > 0) {
    return false;
  }

  const cajaActual =
    getCajaActualLocalRespaldo();

  const cierres =
    getCierresCajaLocalesRespaldo();

  const registros = [
    ...cierres,
    ...(cajaActual
      ? [cajaActual]
      : []),
  ];

  if (registros.length === 0) {
    return false;
  }

  const { error } = await supabase
    .from("cajas")
    .upsert(
      registros.map(cajaARow),
      {
        onConflict: "id",
      }
    );

  if (error) throw error;

  return true;
}

export async function abrirCajaRemota(
  caja
) {
  const fila = cajaARow({
    ...caja,
    estado: "abierta",
  });

  const {
    data,
    error,
  } = await supabase
    .from("cajas")
    .insert(fila)
    .select()
    .single();

  if (error) throw error;

  const guardada =
    rowACaja(data);

  guardarCajaActualLocal(
    guardada
  );

  return guardada;
}

export async function cerrarCajaRemota(
  cierre
) {
  const fila = cajaARow({
    ...cierre,
    estado: "cerrada",
  });

  const {
    data,
    error,
  } = await supabase
    .from("cajas")
    .update(fila)
    .eq(
      "id",
      String(cierre.id)
    )
    .select()
    .single();

  if (error) throw error;

  const guardada =
    rowACaja(data);

  guardarCajaActualLocal(null);

  const cierres =
    getCierresCajaLocalesRespaldo();

  guardarCierresLocales([
    guardada,
    ...cierres.filter(
      (item) =>
        String(item.id) !==
        String(guardada.id)
    ),
  ]);

  return guardada;
}

export function subscribeCaja(
  onChange
) {
  const channel = supabase
    .channel(
      `cajas-${crypto.randomUUID()}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cajas",
      },
      () => onChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(
      channel
    );
  };
}