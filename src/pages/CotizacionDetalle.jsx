import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";

export default function CotizacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cotizacion, setCotizacion] = useState(null);

  useEffect(() => {
    const todas = JSON.parse(localStorage.getItem("cotizaciones") || "[]");
    const encontrada = todas.find((c) => c.id === id);
    if (encontrada) {
      // Nos aseguramos de que siempre tenga un array de items
      setCotizacion({ ...encontrada, items: encontrada.items || [] });
    } else {
      toast.error("Cotización no encontrada");
      navigate("/cotizaciones");
    }
  }, [id, navigate]);

  // Función para agregar un ítem nuevo
  const addItem = () => {
    setCotizacion({
      ...cotizacion,
      items: [...cotizacion.items, { desc: "", cant: 1, precio: 0 }]
    });
  };

  // Función para eliminar un ítem
  const removeItem = (index) => {
    const newItems = cotizacion.items.filter((_, i) => i !== index);
    setCotizacion({ ...cotizacion, items: newItems });
  };

  // Función para actualizar un ítem
  const updateItem = (index, field, value) => {
    const newItems = [...cotizacion.items];
    newItems[index][field] = value;
    // Recalculamos el total automáticamente
    const total = newItems.reduce((acc, item) => acc + (item.cant * item.precio), 0);
    setCotizacion({ ...cotizacion, items: newItems, total: total });
  };

  const handleSave = () => {
    const todas = JSON.parse(localStorage.getItem("cotizaciones") || "[]");
    const index = todas.findIndex((c) => c.id === id);
    if (index !== -1) {
      todas[index] = cotizacion;
      localStorage.setItem("cotizaciones", JSON.stringify(todas));
      toast.success("¡Cotización guardada exitosamente!");
    }
  };

  if (!cotizacion) return <div className="p-6 text-white">Cargando...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cotización N° {String(cotizacion.numero).padStart(4, "0")}</h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/cotizaciones")}><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Button>
            <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-700"><Save className="w-4 h-4 mr-2" /> Guardar</Button>
        </div>
      </div>

      <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-6">
        {/* Datos Generales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Cliente</Label>
            <Input value={cotizacion.nombre_cliente || ""} onChange={(e) => setCotizacion({...cotizacion, nombre_cliente: e.target.value})} className="bg-zinc-950 border-zinc-800" />
          </div>
          <div>
            <Label>Estado</Label>
            <select className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2" value={cotizacion.estado} onChange={(e) => setCotizacion({...cotizacion, estado: e.target.value})}>
                <option value="Borrador">Borrador</option>
                <option value="Enviada">Enviada</option>
                <option value="Aceptada">Aceptada</option>
                <option value="Rechazada">Rechazada</option>
            </select>
          </div>
        </div>

        {/* Tabla de Ítems */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Items / Productos</Label>
            <Button variant="ghost" size="sm" onClick={addItem} className="text-amber-500"><Plus className="w-4 h-4 mr-1" /> Agregar ítem</Button>
          </div>
          
          <div className="space-y-2">
            {cotizacion.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                <Input className="col-span-6 bg-transparent border-none" placeholder="Descripción" value={item.desc} onChange={(e) => updateItem(index, 'desc', e.target.value)} />
                <Input className="col-span-2 bg-transparent border-none" type="number" placeholder="Cant" value={item.cant} onChange={(e) => updateItem(index, 'cant', Number(e.target.value))} />
                <Input className="col-span-3 bg-transparent border-none" type="number" placeholder="Precio" value={item.precio} onChange={(e) => updateItem(index, 'precio', Number(e.target.value))} />
                <Button variant="ghost" className="col-span-1 text-red-500" onClick={() => removeItem(index)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-end pt-4 border-t border-zinc-800">
          <div className="text-right">
            <p className="text-sm text-zinc-400">Total</p>
            <p className="text-3xl font-bold text-emerald-400">${cotizacion.total.toLocaleString()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}