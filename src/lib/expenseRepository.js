import { supabase } from "@/lib/supabase";

const EXPENSES_KEY = "gastos";
const SESSION_KEY = "user";

function readJSON(
  key,
  fallback
) {
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

function readSession() {
  return readJSON(
    SESSION_KEY,
    null
  );
}

function normalizeExpense(
  expense
) {
  const session =
    readSession();

  return {
    ...expense,
    id: String(
      expense.id ||
        crypto.randomUUID()
    ),
    concepto: String(
      expense.concepto || ""
    ).trim(),
    categoria:
      expense.categoria ||
      "Otros",
    monto: Number(
      expense.monto || 0
    ),
    comentario:
      expense.comentario || "",
    metodo_pago:
      expense.metodo_pago ||
      "Otro",
    fecha:
      expense.fecha ||
      new Date().toISOString(),
    usuario_id:
      expense.usuario_id ||
      session?.id ||
      "",
    usuario_nombre:
      expense.usuario_nombre ||
      session?.name ||
      session?.nombre ||
      "Usuario",
    activo:
      expense.activo !== false,
    deleted_at:
      expense.deleted_at ||
      null,
  };
}

function expenseToRow(
  expense
) {
  const normalized =
    normalizeExpense(expense);

  return {
    id: normalized.id,
    concepto:
      normalized.concepto,
    categoria:
      normalized.categoria,
    monto: normalized.monto,
    comentario:
      normalized.comentario,
    metodo_pago:
      normalized.metodo_pago,
    fecha: normalized.fecha,
    usuario_id:
      normalized.usuario_id ||
      null,
    usuario_nombre:
      normalized.usuario_nombre,
    activo: normalized.activo,
    deleted_at:
      normalized.deleted_at,
    updated_at:
      new Date().toISOString(),
  };
}

function rowToExpense(row) {
  return normalizeExpense(row);
}

function saveLocalBackup(
  expenses
) {
  localStorage.setItem(
    EXPENSES_KEY,
    JSON.stringify(
      Array.isArray(expenses)
        ? expenses
        : []
    )
  );
}

export function getGastosLocalesRespaldo() {
  const expenses = readJSON(
    EXPENSES_KEY,
    []
  );

  return Array.isArray(
    expenses
  )
    ? expenses.map(
        normalizeExpense
      )
    : [];
}

export async function getGastosRemotos() {
  const {
    data,
    error,
  } = await supabase
    .from("gastos")
    .select("*")
    .eq("activo", true)
    .is("deleted_at", null)
    .order("fecha", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const expenses = (
    data || []
  ).map(rowToExpense);

  saveLocalBackup(expenses);

  return expenses;
}

export async function importarGastosLocalesSiVacio() {
  const {
    count,
    error: countError,
  } = await supabase
    .from("gastos")
    .select("id", {
      count: "exact",
      head: true,
    });

  if (countError) {
    throw countError;
  }

  if (
    Number(count || 0) > 0
  ) {
    return false;
  }

  const localExpenses =
    getGastosLocalesRespaldo();

  if (
    localExpenses.length === 0
  ) {
    return false;
  }

  const usedIds =
    new Set();

  const rows =
    localExpenses.map(
      (expense) => {
        const normalized =
          normalizeExpense(
            expense
          );

        if (
          usedIds.has(
            normalized.id
          )
        ) {
          normalized.id =
            crypto.randomUUID();
        }

        usedIds.add(
          normalized.id
        );

        return expenseToRow(
          normalized
        );
      }
    );

  const { error } =
    await supabase
      .from("gastos")
      .upsert(rows, {
        onConflict: "id",
      });

  if (error) {
    throw error;
  }

  return true;
}

export async function guardarGastoRemoto(
  expense
) {
  const {
    data,
    error,
  } = await supabase
    .from("gastos")
    .upsert(
      expenseToRow(expense),
      {
        onConflict: "id",
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  const saved =
    rowToExpense(data);

  const localExpenses =
    getGastosLocalesRespaldo();

  const index =
    localExpenses.findIndex(
      (item) =>
        String(item.id) ===
        String(saved.id)
    );

  if (index >= 0) {
    localExpenses[index] =
      saved;
  } else {
    localExpenses.unshift(
      saved
    );
  }

  saveLocalBackup(
    localExpenses
  );

  return saved;
}

export async function eliminarGastoRemoto(
  expenseId
) {
  const now =
    new Date().toISOString();

  const { error } =
    await supabase
      .from("gastos")
      .update({
        activo: false,
        deleted_at: now,
        updated_at: now,
      })
      .eq(
        "id",
        String(expenseId)
      );

  if (error) {
    throw error;
  }

  saveLocalBackup(
    getGastosLocalesRespaldo()
      .filter(
        (item) =>
          String(item.id) !==
          String(expenseId)
      )
  );
}

export async function restaurarGastoRemoto(
  expense
) {
  return guardarGastoRemoto({
    ...expense,
    activo: true,
    deleted_at: null,
  });
}

export function subscribeGastos(
  onChange
) {
  const channel = supabase
    .channel(
      `gastos-${crypto.randomUUID()}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "gastos",
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