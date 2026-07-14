import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { fmtMoney } from "@/lib/format";
import { Minus, Plus, Check, Loader2 } from "lucide-react";

const paymentMethods = ["Efectivo", "Transferencia", "Tarjeta", "Cuenta Corriente"];

export default function SaleModal({ product, onClose }) {
  const { user } = useAuth();
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [cliente, setCliente] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const total = cantidad * product.precio_unitario;

  const handleConfirm = () => {
    console.log("BOTÓN CONFIRMAR PRESIONADO");
    setLoading(true);
    try {
      // OBTENER DATOS ACTUALES PARA EVITAR QUE CASQUE EL CÓDIGO
      const ventasActuales = JSON.parse(localStorage.getItem("ventas")) || [];
      const productosActuales = JSON.parse(localStorage.getItem("inventario")) || [];

      // 2. Crear nueva venta
      const nuevaVenta = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        producto_id: product.id,
        nombre_producto: product.nombre,
        categoria: product.categoria,
        cantidad,
        precio_unitario: product.precio_unitario,
        costo_unitario: product.costo_unitario || 0,
        total,
        metodo_pago: metodoPago,
        cliente: cliente || "",
      };

      // 3. Actualizar stock del producto
      const nuevosProductos = productosActuales.map(p => 
        p.id === product.id 
          ? { ...p, stock_actual: Math.max(0, p.stock_actual - cantidad) } 
          : p
      );

      // 4. Tus Console Logs de pruebas y Guardado
      console.log("ESTOY GUARDANDO:", nuevaVenta);
      
      localStorage.setItem("ventas", JSON.stringify([...ventasActuales, nuevaVenta]));
      
      console.log("LOCAL STORAGE AHORA:", localStorage.getItem("ventas"));

      localStorage.setItem("inventario", JSON.stringify(nuevosProductos));

      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo procesar la venta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        {success ? (
          <div className="flex flex-col items-center justify-center py-12 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-chart-2/20 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-chart-2" />
            </div>
            <p className="text-lg font-semibold text-foreground">¡Venta registrada!</p>
            <p className="text-sm text-muted-foreground mt-1">Stock actualizado</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">{product.nombre}</DialogTitle>
              {product.subcategoria && <p className="text-sm text-muted-foreground">{product.subcategoria}</p>}
            </DialogHeader>

            {product.foto_url && (
              <img src={product.foto_url} alt={product.nombre} className="w-full h-32 object-cover rounded-xl" />
            )}

            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Cantidad ({product.unidad_medida})</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Button variant="outline" size="icon" onClick={() => setCantidad(Math.max(1, cantidad - 1))} className="h-12 w-12 rounded-xl">
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input type="number" value={cantidad} onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))} className="h-12 text-center text-xl font-bold" />
                  <Button variant="outline" size="icon" onClick={() => setCantidad(cantidad + 1)} className="h-12 w-12 rounded-xl">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Método de pago</Label>
                <Select value={metodoPago} onValueChange={setMetodoPago}>
                  <SelectTrigger className="h-12 mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-muted-foreground">Cliente (opcional)</Label>
                <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" className="h-12 mt-2" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="text-2xl font-bold text-primary">{fmtMoney(total)}</span>
              </div>

              <Button onClick={handleConfirm} disabled={loading} className="w-full h-12 text-base font-semibold">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registrando...</> : "Confirmar venta"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}