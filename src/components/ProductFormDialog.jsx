import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const categorias = ["Madera Bruta", "Madera Impregnada", "Planchas", "Accesorios"];
const unidades = ["Unidad", "Metro", "Pie", "Placa"];

export default function ProductFormDialog({ product, onClose, onSaved }) {
  const isEdit = !!product;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    categoria: "Madera Bruta",
    subcategoria: "",
    unidad_medida: "Unidad",
    precio_unitario: 0,
    costo_unitario: 0,
    stock_actual: 0,
    stock_minimo: 0,
    foto_url: "",
    activo: true,
  });

  useEffect(() => {
    if (product) {
      setForm({
        nombre: product.nombre || "",
        categoria: product.categoria || "Madera Bruta",
        subcategoria: product.subcategoria || "",
        unidad_medida: product.unidad_medida || "Unidad",
        precio_unitario: Number(product.precio_unitario || 0),
        costo_unitario: Number(product.costo_unitario || 0),
        stock_actual: Number(product.stock_actual || 0),
        stock_minimo: Number(product.stock_minimo || 0),
        foto_url: product.foto_url || "",
        activo: product.activo !== false,
      });
    }
  }, [product]);

  const set = (campo, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: valor
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const productos = JSON.parse(localStorage.getItem("inventario")) || [];
    let nuevaLista;

    if (isEdit) {
      nuevaLista = productos.map((p) => {
        if (p.id === product.id) {
          return {
            ...p,
            ...form,
            precio_unitario: Number(form.precio_unitario),
            costo_unitario: Number(form.costo_unitario),
            stock_actual: Number(form.stock_actual),
            stock_minimo: Number(form.stock_minimo),
          };
        }
        return p;
      });
    } else {
      const nuevoProducto = {
        id: Date.now(),
        ...form,
        precio_unitario: Number(form.precio_unitario),
        costo_unitario: Number(form.costo_unitario),
        stock_actual: Number(form.stock_actual),
        stock_minimo: Number(form.stock_minimo),
      };
      nuevaLista = [...productos, nuevoProducto];
    }

    localStorage.setItem("inventario", JSON.stringify(nuevaLista));

    toast({
      title: isEdit ? "Producto actualizado" : "Producto creado"
    });

    onSaved();
    onClose();
    setLoading(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
          </div>

          <div>
            <Label>Categoría</Label>
            <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Unidad</Label>
            <Select value={form.unidad_medida} onValueChange={(v) => set("unidad_medida", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Subcategoría / Medida</Label>
            <Input
              value={form.subcategoria}
              onChange={(e) => set("subcategoria", e.target.value)}
            />
          </div>

          <div>
            <Label>Precio venta</Label>
            <Input
              type="number"
              value={form.precio_unitario}
              onChange={(e) => set("precio_unitario", e.target.value)}
            />
          </div>

          <div>
            <Label>Costo</Label>
            <Input
              type="number"
              value={form.costo_unitario}
              onChange={(e) => set("costo_unitario", e.target.value)}
            />
          </div>

          <div>
            <Label>Stock actual</Label>
            <Input
              type="number"
              value={form.stock_actual}
              onChange={(e) => set("stock_actual", e.target.value)}
            />
          </div>

          <div>
            <Label>Stock mínimo</Label>
            <Input
              type="number"
              value={form.stock_minimo}
              onChange={(e) => set("stock_minimo", e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <Label>URL de foto</Label>
            <Input
              value={form.foto_url}
              onChange={(e) => set("foto_url", e.target.value)}
            />
          </div>

          {isEdit && (
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                checked={form.activo}
                onCheckedChange={(v) => set("activo", v)}
              />
              <Label>Producto activo</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !form.nombre}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}