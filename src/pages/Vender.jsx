import React, { useState } from "react";
import { Package, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
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
  const [categoria, setCategoria] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const productosActivos = productos.filter(
    (producto) => producto.activo !== false
  );

  const productosFiltrados = productosActivos.filter(
    (producto) => {
      const coincideCategoria =
        categoria === "Todos" ||
        producto.categoria === categoria;

      const texto = search.trim().toLowerCase();

      const nombre = String(
        producto.nombre || ""
      ).toLowerCase();

      const subcategoria = String(
        producto.subcategoria || ""
      ).toLowerCase();

      const coincideBusqueda =
        texto === "" ||
        nombre.includes(texto) ||
        subcategoria.includes(texto);

      return coincideCategoria && coincideBusqueda;
    }
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">
        Vender
      </h1>

      <p className="text-muted-foreground mb-6">
        Selecciona un producto para registrar una venta
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

        <Input
          className="pl-10"
          placeholder="Buscar producto..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />
      </div>

      <div className="flex gap-2 overflow-x-auto mb-6">
        {categorias.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoria(cat)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
              categoria === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {productosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mb-3 opacity-50" />

          <p>No hay productos disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {productosFiltrados.map((producto) => (
            <ProductCard
              key={producto.id}
              product={producto}
              onClick={() => setSelected(producto)}
            />
          ))}
        </div>
      )}

      {selected && (
        <SaleModal
          product={selected}
          actualizarProductos={actualizarProductos}
          actualizarVentas={actualizarVentas}
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}