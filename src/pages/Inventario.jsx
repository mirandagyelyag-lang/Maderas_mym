import React, { useState } from "react";
// Importaciones de tu librería de UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus } from "lucide-react";
import ProductFormDialog from "@/components/ProductFormDialog"; 

const productosIniciales = [
  { 
    id: 1,
    nombre: "Melamina Blanca 15mm",
    categoria: "Planchas",
    subcategoria: "2440x1220mm",
    precio_unitario: 12000,
    costo_unitario: 8500,
    stock_actual: 3,
    stock_minimo: 10
  },
  {
    id: 2,
    nombre: "Plywood 15mm",
    categoria: "Planchas",
    subcategoria: "2440x1220mm",
    precio_unitario: 9800,
    costo_unitario: 7000,
    stock_actual: 22,
    stock_minimo: 10
  },
];

export default function Inventario({ onDataChange }) {
  const [dialog, setDialog] = useState(null);
  const [search, setSearch] = useState("");

  const [productos, setProductos] = useState(() => {
    const guardados = localStorage.getItem("inventario");

    if (guardados) {
      return JSON.parse(guardados);
    }

    localStorage.setItem(
      "inventario",
      JSON.stringify(productosIniciales)
    );

    return productosIniciales;
  });

  const deleteProduct = (id) => {
    if (window.confirm("¿Estás seguro de eliminar este producto?")) {
      const nuevaLista = productos.filter((p) => p.id !== id);
      setProductos(nuevaLista);
      localStorage.setItem("inventario", JSON.stringify(nuevaLista));
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  const handleSaved = () => {
    const guardados = localStorage.getItem("inventario");
    if (guardados) {
      setProductos(JSON.parse(guardados));
    }
    setDialog(null);
    if (onDataChange) {
      onDataChange();
    }
  };

  const filtered = productos.filter((p) => 
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventario</h1>
          <p className="text-muted-foreground">{productos.length} productos registrados</p>
        </div>
        <Button onClick={() => setDialog({ product: null })}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo
        </Button>
      </div>

      <Input 
        placeholder="Buscar..." 
        className="mb-4 max-w-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-4 text-left">Producto</th>
              <th className="p-4 text-left">Categoría</th>
              <th className="p-4 text-right">Precio</th>
              <th className="p-4 text-right">Costo</th>
              <th className="p-4 text-right">Stock</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isCritical = p.stock_actual <= p.stock_minimo;
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-4 font-medium">{p.nombre}</td>
                  <td className="p-4">{p.categoria}</td>
                  <td className="p-4 text-right">${p.precio_unitario}</td>
                  <td className="p-4 text-right">${p.costo_unitario}</td>
                  
                  {/* CELDA DE STOCK EXACTAMENTE COMO TU FOTO */}
                  <td className={`p-4 text-right font-medium ${isCritical ? "text-red-500 font-bold" : ""}`}>
                    <div className="flex items-center justify-end gap-1.5">
                      <span>
                        {p.stock_actual} / <span className={`${isCritical ? "text-red-500" : "text-muted-foreground"} text-xs`}>mín {p.stock_minimo}</span>
                      </span>
                    </div>
                  </td>

                  <td className="p-4 flex justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setDialog({ product: p })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => deleteProduct(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {dialog && (
        <ProductFormDialog 
          product={dialog.product} 
          onClose={() => setDialog(null)} 
          onSaved={handleSaved} 
        />
      )}
    </div>
  );
}