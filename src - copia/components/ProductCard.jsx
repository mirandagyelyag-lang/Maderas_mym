import React from "react";
import { fmtMoney } from "@/lib/format";
import { Package } from "lucide-react";

export default function ProductCard({ product, onClick }) {
  const stockBajo = product.stock_actual <= product.stock_minimo;
  const sinStock = product.stock_actual <= 0;

  return (
    <button
      onClick={() => onClick(product)}
      className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-primary/50 transition-all text-left animate-fade-in"
    >
      <div className="aspect-square overflow-hidden bg-secondary">
        {product.foto_url ? (
          <img src={product.foto_url} alt={product.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
      </div>
      {sinStock && (
        <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full">SIN STOCK</span>
      )}
      {stockBajo && !sinStock && (
        <span className="absolute top-2 right-2 bg-destructive/90 text-white text-[10px] font-bold px-2 py-1 rounded-full">BAJO</span>
      )}
      <div className="p-3">
        <p className="font-medium text-sm text-foreground line-clamp-1">{product.nombre}</p>
        {product.subcategoria && <p className="text-xs text-muted-foreground line-clamp-1">{product.subcategoria}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="text-primary font-bold text-sm">{fmtMoney(product.precio_unitario)}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stockBajo ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
            {product.stock_actual} {product.unidad_medida?.[0]?.toLowerCase() || 'u'}
          </span>
        </div>
      </div>
    </button>
  );
}