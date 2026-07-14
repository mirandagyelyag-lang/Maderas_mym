import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Loader2, Plus, FileText, ChevronRight } from "lucide-react";

const estadoColors = {
  Borrador: "bg-secondary text-muted-foreground",
  Enviada: "bg-chart-4/15 text-chart-4",
  Aceptada: "bg-chart-2/15 text-chart-2",
  Rechazada: "bg-destructive/15 text-destructive",
};

export default function Cotizaciones() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState(null); // Empezamos en null
  const [creating, setCreating] = useState(false);

  // --- CORRECCIÓN AQUÍ: Cargar datos al abrir la página ---
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("cotizaciones") || "[]");
    setCotizaciones(data);
  }, []); 

  // Si aún está en null (cargando), mostramos el loader
  if (!cotizaciones) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const handleNew = () => {
    setCreating(true);
    
    // Obtenemos cotizaciones actuales desde el estado (que ya tiene los datos)
    const maxNum = cotizaciones.reduce((max, c) => Math.max(max, c.numero || 0), 0);
    
    const nuevaCotizacion = {
      id: Date.now().toString(),
      numero: maxNum + 1,
      fecha: new Date().toISOString().split("T")[0],
      subtotal: 0,
      descuento: 0,
      total: 0,
      validez_dias: 15,
      estado: "Borrador",
      items: [] 
    };

    // Actualizamos localStorage y también el estado local para que se vea inmediato
    const nuevasCotizaciones = [...cotizaciones, nuevaCotizacion];
    localStorage.setItem("cotizaciones", JSON.stringify(nuevasCotizaciones));
    setCotizaciones(nuevasCotizaciones); 

    navigate(`/cotizaciones/${nuevaCotizacion.id}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading">Cotizaciones</h1>
          <p className="text-muted-foreground text-sm mt-1">{cotizaciones.length} cotizaciones</p>
        </div>
        <Button onClick={handleNew} disabled={creating} className="h-11">
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Nueva cotización
        </Button>
      </div>

      {cotizaciones.length === 0 ? (
        <Card className="p-12 bg-card border-border text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay cotizaciones</p>
          <p className="text-xs mt-1">Crea una nueva para comenzar</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {cotizaciones.map((c) => (
            <Card key={c.id} className="p-4 bg-card border-border hover:border-primary/40 cursor-pointer transition-all" onClick={() => navigate(`/cotizaciones/${c.id}`)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Cotización N° {String(c.numero).padStart(4, "0")}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColors[c.estado] || estadoColors.Borrador}`}>{c.estado}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.nombre_cliente || "Sin cliente"} · {fmtDate(c.fecha)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{fmtMoney(c.total)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}