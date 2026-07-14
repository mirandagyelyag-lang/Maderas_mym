import React, { useState, useEffect } from "react";
// Importaciones de tu librería de UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus } from "lucide-react";
import ProductFormDialog from "@/components/ProductFormDialog"; 

export default function Inventario() {
  const [dialog, setDialog] = useState(null); 
  
  // Estado inicial: cargamos desde localStorage o usamos un array vacío si no hay nada
  const [productos, setProductos] = useState(() => {
    const guardados = localStorage.getItem("inventario");
    return guardados ? JSON.parse(guardados) : [
      { id: 1, nombre: "Melamina Blanca 15mm", categoria: "Planchas", subcategoria: "2440x1220mm", precio_unitario: 12000, costo_unitario: 8500, stock_actual: 3, stock_minimo: 10 },
      { id: 2, nombre: "Plywood 15mm", categoria: "Planchas", subcategoria: "2440x1220mm", precio_unitario: 9800, costo_unitario: 7000, stock_actual: 22, stock_minimo: 10 },
    ];
  });
  
  const [search, setSearch] = useState("");

  // FUNCIÓN DE BORRADO CORREGIDA
  const deleteProduct = (id) => {
    if (window.confirm("¿Estás seguro de eliminar este producto?")) {
      // 1. Creamos la nueva lista
      const nuevaLista = productos.filter((p) => p.id !== id);
      
      // 2. Actualizamos el estado de la pantalla
      setProductos(nuevaLista);
      
      // 3. ¡IMPORTANTE! Guardamos la nueva lista en localStorage
      localStorage.setItem("inventario", JSON.stringify(nuevaLista));
    }
  };

  const load = () => { console.log("Datos cargados correctamente"); };

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
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">{p.nombre}</td>
                <td className="p-4">{p.categoria}</td>
                <td className="p-4 text-right">${p.precio_unitario}</td>
                <td className="p-4 text-right">${p.costo_unitario}</td>
                <td className="p-4 text-right">{p.stock_actual} / min {p.stock_minimo}</td>
                <td className="p-4 flex justify-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setDialog({ product: p })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-500"
                    onClick={() => deleteProduct(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {dialog && (
        <ProductFormDialog 
          product={dialog.product} 
          onClose={() => setDialog(null)} 
          onSaved={load} 
        />
      )}
    </div>
  );
}