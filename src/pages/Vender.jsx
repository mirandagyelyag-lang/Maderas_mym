import React, { useMemo, useState } from "react";

import {
  Package,
  Search,
  ShoppingCart,
  Boxes,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ProductCard from "@/components/ProductCard";
import SaleModal from "@/components/SaleModal";

const categorias = [
  "Todos",
  "Madera Bruta",
  "Madera Impregnada",
  "Planchas",
  "Accesorios",
];

export default function Vender({
  productos = [],
  actualizarProductos,
  actualizarVentas,
}) {
  const [categoria, setCategoria] =
    useState("Todos");

  const [search, setSearch] =
    useState("");

  const [selected, setSelected] =
    useState(null);

  const productosActivos = useMemo(
    () =>
      productos.filter(
        (producto) =>
          producto.activo !== false
      ),
    [productos]
  );

  const productosFiltrados = useMemo(
    () =>
      productosActivos.filter(
        (producto) => {
          const coincideCategoria =
            categoria === "Todos" ||
            producto.categoria ===
              categoria;

          const texto = search
            .trim()
            .toLowerCase();

          const campos = [
            producto.nombre,
            producto.subcategoria,
            producto.categoria,
            producto.unidad_medida,
          ].map((campo) =>
            String(campo || "")
              .toLowerCase()
          );

          const coincideBusqueda =
            texto === "" ||
            campos.some((campo) =>
              campo.includes(texto)
            );

          return (
            coincideCategoria &&
            coincideBusqueda
          );
        }
      ),
    [
      productosActivos,
      categoria,
      search,
    ]
  );

  const productosConStock =
    productosActivos.filter(
      (producto) =>
        Number(
          producto.stock_actual || 0
        ) > 0
    ).length;

  const productosAgotados =
    productosActivos.length -
    productosConStock;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>

            <div>
              <h1 className="text-3xl font-bold">
                Vender
              </h1>

              <p className="text-muted-foreground text-sm mt-0.5">
                Selecciona un producto para registrar la venta
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Card className="px-4 py-3 bg-card border-border">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />

              <div>
                <p className="text-[11px] text-muted-foreground">
                  Disponibles
                </p>

                <p className="font-semibold text-sm">
                  {productosConStock}
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-4 py-3 bg-card border-border">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-destructive" />

              <div>
                <p className="text-[11px] text-muted-foreground">
                  Agotados
                </p>

                <p className="font-semibold text-sm">
                  {productosAgotados}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4 md:p-5 bg-card border-border mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            className="pl-10 h-11"
            placeholder="Buscar por nombre, categoría o medida..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>

        <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
          {categorias.map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  setCategoria(cat)
                }
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                  categoria === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {productosFiltrados.length} producto
          {productosFiltrados.length === 1
            ? ""
            : "s"}
        </p>

        {search && (
          <button
            type="button"
            onClick={() =>
              setSearch("")
            }
            className="text-xs text-primary hover:underline"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>

      {productosFiltrados.length === 0 ? (
        <Card className="flex flex-col items-center py-16 bg-card border-border text-muted-foreground">
          <Package className="w-12 h-12 mb-3 opacity-40" />

          <p className="font-medium">
            No hay productos disponibles
          </p>

          <p className="text-xs mt-1">
            Prueba otra búsqueda o categoría
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {productosFiltrados.map(
            (producto) => (
              <ProductCard
                key={producto.id}
                product={producto}
                onClick={() =>
                  setSelected(
                    producto
                  )
                }
              />
            )
          )}
        </div>
      )}

      {selected && (
        <SaleModal
          product={selected}
          actualizarProductos={
            actualizarProductos
          }
          actualizarVentas={
            actualizarVentas
          }
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

