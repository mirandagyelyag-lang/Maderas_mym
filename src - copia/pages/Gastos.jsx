import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wallet, Trash2, Plus, ChevronDown, Check } from "lucide-react";
import { fmtMoney, fmtDateTime } from "@/lib/format";

export default function Gastos() {
  const [gastos, setGastos] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [formData, setFormData] = useState({
    concepto: "",
    categoria: "Insumos",
    monto: "",
    comentario: ""
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const cargados = JSON.parse(localStorage.getItem("gastos") || "[]");
    setGastos(cargados);
  }, []);

  const handleAdd = () => {
    if (!formData.concepto || !formData.monto) return;
    const nuevoGasto = { id: Date.now(), ...formData, monto: parseFloat(formData.monto), fecha: new Date().toISOString() };
    const nuevosGastos = [...gastos, nuevoGasto];
    setGastos(nuevosGastos);
    localStorage.setItem("gastos", JSON.stringify(nuevosGastos));
    setFormData({ concepto: "", categoria: "Insumos", monto: "", comentario: "" });
  };

  const deleteGasto = (id) => {
    const filtrados = gastos.filter(g => g.id !== id);
    setGastos(filtrados);
    localStorage.setItem("gastos", JSON.stringify(filtrados));
  };

  const totalHoy = gastos
    .filter(g => new Date(g.fecha).toDateString() === new Date().toDateString())
    .reduce((s, g) => s + g.monto, 0);

  const categorias = ["Insumos", "Combustible", "Sueldos", "Mantenimiento", "Otros"];
  
  // Estilo aplicado a todos por igual
  const fieldStyle = "flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gastos</h1>
        <p className="text-muted-foreground">Registrar y revisar gastos diarios</p>
      </div>

      <Card className="p-6 bg-card border-border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Nuevo gasto</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Campo 1: Concepto */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Concepto</label>
            <Input 
              placeholder="Ej: Compra de clavos" 
              value={formData.concepto}
              onChange={(e) => setFormData({...formData, concepto: e.target.value})}
            />
          </div>

          {/* Campo 2: Categoría */}
          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="text-sm font-medium">Categoría</label>
            <div 
              className={`${fieldStyle} cursor-pointer justify-between`}
              onClick={() => setIsOpen(!isOpen)}
            >
              <span className="font-medium">{formData.categoria}</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </div>
            
            {isOpen && (
              <div className="absolute top-[70px] left-0 w-full z-50 bg-background border border-input rounded-md shadow-md overflow-hidden">
                {categorias.map((cat) => (
                  <div
                    key={cat}
                    className={`flex items-center justify-between px-4 py-2 cursor-pointer text-sm hover:bg-muted ${
                      formData.categoria === cat ? "bg-muted font-semibold" : ""
                    }`}
                    onClick={() => {
                      setFormData({...formData, categoria: cat});
                      setIsOpen(false);
                    }}
                  >
                    {cat}
                    {formData.categoria === cat && <Check className="h-4 w-4" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campo 3: Monto */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Monto</label>
            <Input 
              type="number"
              placeholder="0" 
              value={formData.monto}
              onChange={(e) => setFormData({...formData, monto: e.target.value})}
            />
          </div>
          
          {/* Campo 4: Comentario */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Comentario (opcional)</label>
            <Input 
              placeholder="..." 
              value={formData.comentario}
              onChange={(e) => setFormData({...formData, comentario: e.target.value})}
            />
          </div>
        </div>
        
        <Button 
          className="w-full mt-6 bg-[#C3A579] hover:bg-[#b0936a] text-zinc-900 font-bold"
          onClick={handleAdd}
        >
          <Plus className="mr-2 h-4 w-4" /> Registrar gasto
        </Button>
      </Card>

      <Card className="overflow-hidden border-border bg-card">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="font-semibold">Gastos de hoy</h2>
          <span className="font-bold text-[#C3A579]">{fmtMoney(totalHoy)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="p-4">Fecha</th>
                <th className="p-4">Concepto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4 text-right">Monto</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gastos.length > 0 ? (
                gastos.map((g) => (
                  <tr key={g.id} className="hover:bg-muted/30">
                    <td className="p-4 text-[#C3A579] font-medium">{fmtDateTime(g.fecha)}</td>
                    <td className="p-4 font-medium">{g.concepto}</td>
                    <td className="p-4 text-muted-foreground">{g.categoria}</td>
                    <td className="p-4 text-right font-bold">{fmtMoney(g.monto)}</td>
                    <td className="p-4 text-center">
                      <Button variant="ghost" size="icon" onClick={() => deleteGasto(g.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-muted-foreground">
                    <Wallet className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No hay gastos registrados hoy</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}