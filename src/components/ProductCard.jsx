import React, {
  useState,
} from "react";

import {
  AlertTriangle,
  ImageOff,
  Package,
  Plus,
} from "lucide-react";

import { fmtMoney } from "@/lib/format";

export default function ProductCard({
  product,
  onClick,
}) {
  const [
    imagenError,
    setImagenError,
  ] = useState(false);

  const stockActual = Number(
    product?.stock_actual || 0
  );

  const stockMinimo = Number(
    product?.stock_minimo || 0
  );

  const stockBajo =
    stockActual > 0 &&
    stockActual <= stockMinimo;

  const sinStock = stockActual <= 0;

  const productoInactivo =
    product?.activo === false;

  const deshabilitado =
    sinStock || productoInactivo;

  const mostrarImagen =
    Boolean(product?.foto_url) &&
    !imagenError;

  const precioFormateado = fmtMoney(
    product?.precio_unitario
  );

  const clasePrecio =
    precioFormateado.length > 12
      ? "text-xs"
      : precioFormateado.length > 9
        ? "text-sm"
        : "text-base";

  const manejarClick = () => {
    if (
      deshabilitado ||
      typeof onClick !== "function"
    ) {
      return;
    }

    onClick(product);
  };

  return (
    <button
      type="button"
      onClick={manejarClick}
      disabled={deshabilitado}
      className={`group relative w-full self-start overflow-hidden rounded-2xl border bg-card text-left transition-all duration-200 animate-fade-in ${
        deshabilitado
          ? "cursor-not-allowed border-border opacity-55"
          : "cursor-pointer border-border hover:-translate-y-1 hover:border-primary/45 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      }`}
      aria-label={
        sinStock
          ? `${product?.nombre || "Producto"}, sin stock`
          : `Agregar ${product?.nombre || "producto"} a la venta`
      }
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-muted/30">
        {mostrarImagen ? (
          <img
            src={product.foto_url}
            alt={product.nombre || "Producto"}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.04]"
            onError={() =>
              setImagenError(true)
            }
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8 opacity-45" />

            <span className="text-[11px] opacity-70">
              Sin imagen
            </span>
          </div>
        )}

        <div
          className={`absolute left-2 top-2 inline-flex max-w-[calc(100%-3.75rem)] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-md ${
            sinStock
              ? "border-red-500/30 bg-red-500/85 text-white"
              : stockBajo
                ? "border-amber-500/30 bg-amber-500/90 text-white"
                : "border-white/20 bg-background/80 text-foreground"
          }`}
        >
          {sinStock ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <Package className="h-3 w-3 shrink-0" />
          )}

          <span className="truncate">
            {sinStock
              ? "Sin stock"
              : `${stockActual} disponibles`}
          </span>
        </div>

        {!deshabilitado && (
          <span className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-xl border border-white/20 bg-primary text-primary-foreground shadow-lg transition-transform duration-200 group-hover:scale-105">
            <Plus className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="p-3.5">
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-foreground">
            {product?.nombre ||
              "Producto sin nombre"}
          </p>

          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {[
              product?.categoria,
              product?.subcategoria,
            ]
              .filter(Boolean)
              .join(" · ") ||
              "Sin categoría"}
          </p>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Precio
          </p>

          <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
            <p
              className={`min-w-0 whitespace-nowrap font-bold leading-tight text-primary ${clasePrecio}`}
              title={precioFormateado}
            >
              {precioFormateado}
            </p>

            {product?.unidad_medida && (
              <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {product.unidad_medida}
              </span>
            )}
          </div>
        </div>

        {stockBajo && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] font-medium text-amber-600 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Stock mínimo alcanzado</span>
          </div>
        )}

        {productoInactivo && (
          <div className="mt-3 rounded-lg border border-border bg-muted/50 px-2.5 py-2 text-center text-[10px] font-medium text-muted-foreground">
            Producto inactivo
          </div>
        )}
      </div>
    </button>
  );
}
