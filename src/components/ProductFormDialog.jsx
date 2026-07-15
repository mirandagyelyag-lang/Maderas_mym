import React, { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const categorias = [
  "Madera Bruta",
  "Madera Impregnada",
  "Planchas",
  "Accesorios",
];

const unidades = [
  "Unidad",
  "Metro",
  "Pie",
  "Placa",
];

export default function ProductFormDialog({
  product,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(product);

  const [form, setForm] = useState({
    nombre: "",
    categoria: "Madera Bruta",
    subcategoria: "",
    unidad_medida: "Unidad",
    precio_unitario: "",
    costo_unitario: "",
    stock_actual: "",
    stock_minimo: "",
    foto_url: "",
    activo: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        nombre: product.nombre || "",
        categoria:
          product.categoria || "Madera Bruta",
        subcategoria:
          product.subcategoria || "",
        unidad_medida:
          product.unidad_medida || "Unidad",
        precio_unitario:
          product.precio_unitario ?? "",
        costo_unitario:
          product.costo_unitario ?? "",
        stock_actual:
          product.stock_actual ?? "",
        stock_minimo:
          product.stock_minimo ?? "",
        foto_url:
          product.foto_url || "",
        activo:
          product.activo !== false,
      });
    }
  }, [product]);

  const set = (campo, valor) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return;

    setLoading(true);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 300)
      );

      const productosGuardados = JSON.parse(
        localStorage.getItem("inventario") || "[]"
      );

      let nuevaLista;

      const datosProducto = {
        ...form,
        nombre: form.nombre.trim(),
        precio_unitario: Number(
          form.precio_unitario || 0
        ),
        costo_unitario: Number(
          form.costo_unitario || 0
        ),
        stock_actual: Number(
          form.stock_actual || 0
        ),
        stock_minimo: Number(
          form.stock_minimo || 0
        ),
      };

      if (isEdit) {
        nuevaLista = productosGuardados.map(
          (productoGuardado) =>
            String(productoGuardado.id) ===
            String(product.id)
              ? {
                  ...productoGuardado,
                  ...datosProducto,
                }
              : productoGuardado
        );
      } else {
        const nuevoProducto = {
          id: Date.now(),
          ...datosProducto,
        };

        nuevaLista = [
          ...productosGuardados,
          nuevoProducto,
        ];
      }

      localStorage.setItem(
        "inventario",
        JSON.stringify(nuevaLista)
      );

      toast({
        title: isEdit
          ? "Producto actualizado"
          : "Producto creado",
      });

      onSaved?.();
      onClose();
    } catch (error) {
      console.error(
        "Error guardando producto:",
        error
      );

      toast({
        title: "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Editar producto"
              : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Nombre</Label>

            <Input
              value={form.nombre}
              onChange={(event) =>
                set("nombre", event.target.value)
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label>Categoría</Label>

            <Select
              value={form.categoria}
              onValueChange={(valor) =>
                set("categoria", valor)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {categorias.map((categoria) => (
                  <SelectItem
                    key={categoria}
                    value={categoria}
                  >
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Unidad</Label>

            <Select
              value={form.unidad_medida}
              onValueChange={(valor) =>
                set("unidad_medida", valor)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {unidades.map((unidad) => (
                  <SelectItem
                    key={unidad}
                    value={unidad}
                  >
                    {unidad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>
              Subcategoría / Medida
            </Label>

            <Input
              value={form.subcategoria}
              onChange={(event) =>
                set(
                  "subcategoria",
                  event.target.value
                )
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label>Precio venta</Label>

            <NumericInput
              min={0}
              value={form.precio_unitario}
              onValueChange={(valor) =>
                set("precio_unitario", valor)
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label>Costo</Label>

            <NumericInput
              min={0}
              value={form.costo_unitario}
              onValueChange={(valor) =>
                set("costo_unitario", valor)
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label>Stock actual</Label>

            <NumericInput
              min={0}
              value={form.stock_actual}
              onValueChange={(valor) =>
                set("stock_actual", valor)
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label>Stock mínimo</Label>

            <NumericInput
              min={0}
              value={form.stock_minimo}
              onValueChange={(valor) =>
                set("stock_minimo", valor)
              }
              className="mt-1"
            />
          </div>

          <div className="col-span-2">
            <Label>URL de foto</Label>

            <Input
              value={form.foto_url}
              onChange={(event) =>
                set("foto_url", event.target.value)
              }
              className="mt-1"
            />
          </div>

          {isEdit && (
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                checked={form.activo}
                onCheckedChange={(valor) =>
                  set("activo", valor)
                }
              />

              <Label>Producto activo</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              !form.nombre.trim()
            }
          >
            {loading && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}

            {isEdit
              ? "Guardar"
              : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
