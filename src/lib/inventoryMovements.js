import { supabase } from "@/lib/supabase";
import {
  ajustarStockRemoto,
  getMovimientosRemotos,
} from "@/lib/inventoryRepository";

export const TIPOS_MOVIMIENTO = {
  ENTRADA: "entrada",
  VENTA: "venta",
  DEVOLUCION: "devolucion",
  AJUSTE_POSITIVO: "ajuste_positivo",
  AJUSTE_NEGATIVO: "ajuste_negativo",
  CREACION: "creacion",
};

export async function obtenerMovimientosInventario() {
  const { data, error } = await supabase
    .from("movimientos_inventario")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function registrarMovimientoInventario({
  productoId,
  tipo,
  cantidad,
  motivo = "",
  referenciaId = "",
  referenciaTipo = "",
}) {
  return ajustarStockRemoto({
    productoId,
    tipo,
    cantidad,
    motivo,
    referenciaId,
    referenciaTipo,
  });
}

export const movimientosDeProducto = (productoId) =>
  getMovimientosRemotos(productoId);

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
