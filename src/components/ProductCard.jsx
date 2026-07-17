import React, {
  useState,
} from "react";

import { fmtMoney } from "@/lib/format";

import {
  Package,
  ImageOff,
  Barcode,
} from "lucide-react";

export default function ProductCard({
  product,
  onClick,
}) {
  const [
    imagenError,
    setImagenError,
  ] = useState(false);

  const stockActual = Number(
    product.stock_actual || 0
  );

  const stockMinimo = Number(
    product.stock_minimo || 0
  );

  const stockBajo =
    stockActual <= stockMinimo;

  const sinStock =
    stockActual <= 0;

  const mostrarImagen =
    Boolean(product.foto_url) &&
    !imagenError;

  return (
    <button
      type="button"
      onClick={() =>
        onClick(product)
      }
      disabled={sinStock}
      className={`group relative overflow-hidden rounded-2xl bg-card border text-left transition-all animate-fade-in ${
        sinStock
          ? "border-border opacity-65 cursor-not-allowed"
          : "border-border hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg"
      }`}
    >
      <div className="aspect-square overflow-hidden bg-secondary relative">
        {mostrarImagen ? (
          <img
            src={product.foto_url}
            alt={product.nombre}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() =>
              setImagenError(true)
            }
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            {imagenError ? (
              <ImageOff className="w-9 h-9 text-muted-foreground/60" />
            ) : (
              <Package className="w-10 h-10 text-muted-foreground/60" />
            )}

            <span className="text-[10px] text-muted-foreground">
              Sin fotografía
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
      </div>

      {sinStock && (
        <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
          SIN STOCK
        </span>
      )}

      {stockBajo &&
        !sinStock && (
          <span className="absolute top-2 right-2 bg-amber-500 text-zinc-950 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
            STOCK BAJO
          </span>
        )}

      <div className="p-3">
        <p className="font-medium text-sm text-foreground line-clamp-1">
          {product.nombre}
        </p>

        {product.subcategoria && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {
              product.subcategoria
            }
          </p>
        )}

        {product.codigo_barras && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
            <Barcode className="w-3.5 h-3.5" />

            <span className="truncate">
              {
                product.codigo_barras
              }
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-3">
          <span className="text-primary font-bold text-sm">
            {fmtMoney(
              product.precio_unitario
            )}
          </span>

          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
              sinStock
                ? "bg-destructive/15 text-destructive"
                : stockBajo
                ? "bg-amber-500/15 text-amber-400"
                : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {stockActual}{" "}
            {product.unidad_medida
              ?.slice(0, 3)
              .toLowerCase() ||
              "u"}
          </span>
        </div>
      </div>
    </button>
  );
}
