import React, { useState, useEffect } from "react";
import { Loader2, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import ProductCard from "@/components/ProductCard";
import SaleModal from "@/components/SaleModal";

const categorias = ["Todos", "Madera Bruta", "Madera Impregnada", "Planchas", "Accesorios"];

export default function Vender() {
  const [productos, setProductos] = useState(null);
  const [categoria, setCategoria] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const load = () => base44.entities.Producto.filter({ activo: true }, "-categoria", 500).then(setProductos).catch(() => setProductos([]));
  useEffect(() => { load(); }, []);

  const filtered = (productos || []).filter((p) => {
    const matchCat = categoria === "Todos" || p.categoria === categoria;
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.subcategoria || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (!productos)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold font-heading">Vender</h1>
        <p className="text-muted-foreground text-sm mt-1">Toca un producto para registrar la venta</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." className="pl-10 h-11" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoria(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${categoria === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mb-3 opacity-50" />
          <p>No hay productos en esta categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onClick={setSelected} />
          ))}
        </div>
      )}

      {selected && <SaleModal product={selected} onClose={() => { setSelected(null); load(); }} />}
    </div>
  );
}