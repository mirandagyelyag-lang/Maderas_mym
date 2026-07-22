import { registrarActividad } from "@/lib/database";

const MOVIMIENTOS_KEY =
  "movimientos_inventario";

const SESSION_KEY = "user";

export const TIPOS_MOVIMIENTO = {
  ENTRADA: "entrada",
  VENTA: "venta",
  DEVOLUCION: "devolucion",
  AJUSTE_POSITIVO: "ajuste_positivo",
  AJUSTE_NEGATIVO: "ajuste_negativo",
  CREACION: "creacion",
};

function readJSON(key, fallback) {
  try {
    return JSON.parse(
      localStorage.getItem(key) || JSON.stringify(fallback)
    );
  } catch (error) {
    console.error(`Error leyendo ${key}:`, error);
    return fallback;
  }
}

function obtenerUsuarioActual() {
  return readJSON(SESSION_KEY, null);
}

function obtenerTodosLosMovimientos() {
  const movimientos = readJSON(MOVIMIENTOS_KEY, []);
  return Array.isArray(movimientos) ? movimientos : [];
}

export const obtenerMovimientosInventario = () =>
  obtenerTodosLosMovimientos();

export const registrarMovimientoInventario =
  ({
    productoId,
    productoNombre,
    tipo,
    cantidad,
    stockAnterior,
    stockNuevo,
    motivo = "",
    referenciaId = "",
    referenciaTipo = "",
    usuario = "",
    usuarioId = "",
    empresaId = "",
    fecha = new Date().toISOString(),
  }) => {
    const cantidadNumero = Number(cantidad || 0);
    const sesion = obtenerUsuarioActual();

    if (!productoId || !tipo) {
      return null;
    }

    const movimiento = {
      id: `${Date.now()}-${Math.random()}`,
      producto_id: productoId,
      producto_nombre: productoNombre || "Producto",
      tipo,
      cantidad: cantidadNumero,
      stock_anterior: Number(stockAnterior || 0),
      stock_nuevo: Number(stockNuevo || 0),
      motivo: String(motivo || "").trim(),
      referencia_id: referenciaId || "",
      referencia_tipo: referenciaTipo || "",
      usuario:
        usuario ||
        sesion?.name ||
        sesion?.nombre ||
        "Usuario del sistema",
      usuario_id: usuarioId || sesion?.id || "",
      fecha,
    };

    if (empresaId || sesion?.empresaId) {
      movimiento.empresaId = empresaId || sesion.empresaId;
    }

    const todos = obtenerTodosLosMovimientos();

    localStorage.setItem(
      MOVIMIENTOS_KEY,
      JSON.stringify([...todos, movimiento])
    );

    registrarActividad({
      accion:
        tipo === TIPOS_MOVIMIENTO.CREACION
          ? "crear"
          : "ajustar_stock",
      modulo: "Inventario",
      entidadId: productoId,
      entidadNombre: productoNombre || "Producto",
      descripcion: `${etiquetaMovimiento(tipo)} de ${cantidadNumero} ${
        cantidadNumero === 1 ? "unidad" : "unidades"
      } en ${productoNombre || "Producto"}${
        motivo ? ` · ${String(motivo).trim()}` : ""
      }`,
      datosAntes: {
        stock: Number(stockAnterior || 0),
      },
      datosDespues: {
        stock: Number(stockNuevo || 0),
      },
    });

    window.dispatchEvent(
      new Event("movimientos-inventario-actualizados")
    );

    return movimiento;
  };

export const movimientosDeProducto =
  (productoId) =>
    obtenerMovimientosInventario()
      .filter(
        (movimiento) =>
          String(movimiento.producto_id) === String(productoId)
      )
      .sort(
        (a, b) => new Date(b.fecha) - new Date(a.fecha)
      );

export const etiquetaMovimiento = (tipo) => {
  const etiquetas = {
    entrada: "Entrada",
    venta: "Venta",
    devolucion: "Devolución",
    ajuste_positivo: "Ajuste positivo",
    ajuste_negativo: "Ajuste negativo",
    creacion: "Stock inicial",
  };

  return etiquetas[tipo] || tipo;
};

export const movimientoEsEntrada = (tipo) =>
  [
    TIPOS_MOVIMIENTO.ENTRADA,
    TIPOS_MOVIMIENTO.DEVOLUCION,
    TIPOS_MOVIMIENTO.AJUSTE_POSITIVO,
    TIPOS_MOVIMIENTO.CREACION,
  ].includes(tipo);