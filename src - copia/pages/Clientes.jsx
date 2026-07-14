import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, DollarSign, Search, UserPlus, Phone, MessageSquare } from "lucide-react";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [dialog, setDialog] = useState(null);
  const [dialogAbono, setDialogAbono] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem("mis_clientes_data");
    if (data) setClientes(JSON.parse(data));
  }, []);

  const saveClientes = (nuevosClientes) => {
    setClientes(nuevosClientes);
    localStorage.setItem("mis_clientes_data", JSON.stringify(nuevosClientes));
  };

  const [deudasLocales, setDeudasLocales] = useState(() => {
    const local = localStorage.getItem("deudas_clientes_barraca");
    return local ? JSON.parse(local) : {};
  });

  useEffect(() => {
    localStorage.setItem("deudas_clientes_barraca", JSON.stringify(deudasLocales));
  }, [deudasLocales]);

  const clientesFiltrados = clientes.filter(c => 
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-zinc-500">{clientes.length} clientes registrados</p>
        </div>
        <Button onClick={() => setDialog({})} className="bg-amber-600 hover:bg-amber-700">
           + Nuevo
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-10 bg-zinc-900 border-zinc-800" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clientesFiltrados.map((c) => {
          const movimientos = deudasLocales[c.id] || [];
          const deudaActual = movimientos.reduce((total, mov) => mov.tipo === "fiado" ? total + mov.monto : total - mov.monto, 0);

          return (
            <Card key={c.id} className="p-4 bg-zinc-800 border-zinc-700 flex items-start gap-4 hover:border-zinc-600 transition-all">
              <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-xl text-amber-500 shrink-0">
                {c.nombre?.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-lg text-white">{c.nombre}</h3>
                <p className="text-zinc-300 text-sm">{c.telefono_whatsapp}</p>
                <p className="text-zinc-500 text-xs mt-1">{c.direccion}</p>
                
                <div className="mt-3 pt-2 border-t border-zinc-700/50 flex justify-between items-center">
                    <span className={`text-sm font-bold ${deudaActual > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        Saldo: ${deudaActual.toLocaleString()}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setDialogAbono({ cliente: c })} className="h-7 text-xs text-amber-500 hover:bg-amber-950">
                        <DollarSign className="w-3 h-3 mr-1" /> Gestionar
                    </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="ghost" size="icon" className="text-emerald-500 h-8 w-8" onClick={() => window.open(`https://wa.me/${c.telefono_whatsapp.replace(/\D/g, '')}`)}>
                    <MessageSquare className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setDialog({ cliente: c })}>
                    <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-400" onClick={() => { if(confirm("¿Eliminar?")) saveClientes(clientes.filter(item => item.id !== c.id)); }}>
                    <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {dialog && <ClienteFormDialog cliente={dialog.cliente} clientes={clientes} onSave={(lista) => saveClientes(lista)} onClose={() => setDialog(null)} />}
      {dialogAbono && <AbonoDialog cliente={dialogAbono.cliente} movimientos={deudasLocales[dialogAbono.cliente.id] || []} onGuardar={(nuevos) => setDeudasLocales({...deudasLocales, [dialogAbono.cliente.id]: nuevos})} onClose={() => setDialogAbono(null)} />}
    </div>
  );
}

function ClienteFormDialog({ cliente, clientes, onSave, onClose }) {
  const [form, setForm] = useState(cliente || { nombre: "", telefono_whatsapp: "", direccion: "", rut_dni: "", notas: "", id: Date.now().toString() });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
        <DialogHeader><DialogTitle>{cliente ? "Editar" : "Nuevo"} Cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
            <Input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className="bg-zinc-950 border-zinc-800" />
            <Input placeholder="Teléfono" value={form.telefono_whatsapp} onChange={(e) => setForm({...form, telefono_whatsapp: e.target.value})} className="bg-zinc-950 border-zinc-800" />
            <Input placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({...form, direccion: e.target.value})} className="bg-zinc-950 border-zinc-800" />
            <Input placeholder="RUT / DNI" value={form.rut_dni} onChange={(e) => setForm({...form, rut_dni: e.target.value})} className="bg-zinc-950 border-zinc-800" />
            <Input placeholder="Notas" value={form.notas} onChange={(e) => setForm({...form, notas: e.target.value})} className="bg-zinc-950 border-zinc-800" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-zinc-800">Cancelar</Button>
          <Button onClick={() => { if(cliente) onSave(clientes.map(c => c.id === cliente.id ? form : c)); else onSave([...clientes, form]); onClose(); }} className="bg-amber-600 hover:bg-amber-700">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AbonoDialog({ cliente, movimientos, onGuardar, onClose }) {
  const [monto, setMonto] = useState("");
  const registrar = (tipo) => {
    const valor = parseInt(monto);
    if (!valor) return;
    onGuardar([...movimientos, { tipo, monto: valor, fecha: new Date().toLocaleDateString() }]);
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
        <DialogHeader><DialogTitle>Movimientos de {cliente.nombre}</DialogTitle></DialogHeader>
        <Input type="number" placeholder="Monto ($)" value={monto} onChange={(e) => setMonto(e.target.value)} className="bg-zinc-950" />
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => registrar("fiado")} className="bg-red-600">Fiado (+)</Button>
          <Button onClick={() => registrar("abono")} className="bg-emerald-600">Abono (-)</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}