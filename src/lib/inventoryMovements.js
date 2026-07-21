const MOVIMIENTOS_KEY =
  "movimientos_inventario";

export const TIPOS_MOVIMIENTO = {
  ENTRADA: "entrada",
  VENTA: "venta",
  DEVOLUCION: "devolucion",
  AJUSTE_POSITIVO: "ajuste_positivo",
  AJUSTE_NEGATIVO: "ajuste_negativo",
  CREACION: "creacion",
};

export const obtenerMovimientosInventario =
  () => {
    try {
      return JSON.parse(
        localStorage.getItem(
          MOVIMIENTOS_KEY
        ) || "[]"
      );
    } catch (error) {
      console.error(
        "Error leyendo movimientos de inventario:",
        error
      );

      return [];
    }
  };

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
    usuario = "Administrador",
    fecha = new Date().toISOString(),
  }) => {
    const cantidadNumero = Number(
      cantidad || 0
    );

    if (!productoId || !tipo) {
      return null;
    }

    const movimiento = {
      id: `${Date.now()}-${Math.random()}`,
      producto_id: productoId,
      producto_nombre:
        productoNombre || "Producto",
      tipo,
      cantidad: cantidadNumero,
      stock_anterior: Number(
        stockAnterior || 0
      ),
      stock_nuevo: Number(
        stockNuevo || 0
      ),
      motivo: String(
        motivo || ""
      ).trim(),
      referencia_id:
        referenciaId || "",
      referencia_tipo:
        referenciaTipo || "",
      usuario,
      fecha,
    };

    const actuales =
      obtenerMovimientosInventario();

    localStorage.setItem(
      MOVIMIENTOS_KEY,
      JSON.stringify([
        ...actuales,
        movimiento,
      ])
    );

    window.dispatchEvent(
      new Event(
        "movimientos-inventario-actualizados"
      )
    );

    return movimiento;
  };

export const movimientosDeProducto =
  (productoId) =>
    obtenerMovimientosInventario()
      .filter(
        (movimiento) =>
          String(
            movimiento.producto_id
          ) ===
          String(productoId)
      )
      .sort(
        (a, b) =>
          new Date(b.fecha) -
          new Date(a.fecha)
      );

export const etiquetaMovimiento = (
  tipo
) => {
  const etiquetas = {
    entrada: "Entrada",
    venta: "Venta",
    devolucion: "Devolución",
    ajuste_positivo:
      "Ajuste positivo",
    ajuste_negativo:
      "Ajuste negativo",
    creacion: "Stock inicial",
  };

  return etiquetas[tipo] || tipo;
};

export const movimientoEsEntrada = (
  tipo
) =>
  [
    TIPOS_MOVIMIENTO.ENTRADA,
    TIPOS_MOVIMIENTO.DEVOLUCION,
    TIPOS_MOVIMIENTO.AJUSTE_POSITIVO,
    TIPOS_MOVIMIENTO.CREACION,
  ].includes(tipo);