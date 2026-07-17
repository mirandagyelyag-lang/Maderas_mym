import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  WalletCards, LockKeyhole, UnlockKeyhole, Banknote, CreditCard,
  ArrowDownToLine, ArrowUpFromLine, Scale, History,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import { fmtMoney, fmtDateTime } from "@/lib/format";

const CAJA_ACTUAL_KEY = "caja_actual";
const CIERRES_KEY = "cierres_caja";

const leerJSON = (clave, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(clave) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const mismoDia = (fechaA, fechaB = new Date()) => {
  const a = new Date(fechaA);
  const b = new Date(fechaB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export default function Caja({ ventas = [], gastos = [] }) {
  const [cajaActual, setCajaActual] = useState(() =>
    leerJSON(CAJA_ACTUAL_KEY, null)
  );
  const [cierres, setCierres] = useState(() =>
    leerJSON(CIERRES_KEY, [])
  );
  const [abrirDialogo, setAbrirDialogo] = useState(false);
  const [cerrarDialogo, setCerrarDialogo] = useState(false);

  const cajaAbierta =
    cajaActual?.estado === "abierta" &&
    mismoDia(cajaActual.fecha_apertura);

  const ventasHoy = useMemo(
    () => ventas.filter((venta) => mismoDia(venta.fecha)),
    [ventas]
  );

  const gastosHoy = useMemo(
    () => gastos.filter((gasto) => mismoDia(gasto.fecha)),
    [gastos]
  );

  const sumarVentas = (metodo) =>
    ventasHoy
      .filter((venta) => venta.metodo_pago === metodo)
      .reduce((suma, venta) => suma + Number(venta.total || 0), 0);

  const efectivo = sumarVentas("Efectivo");
  const transferencia = sumarVentas("Transferencia");
  const tarjeta = sumarVentas("Tarjeta");

  const gastosEfectivo = gastosHoy
    .filter((gasto) => gasto.metodo_pago === "Efectivo")
    .reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0);

  const apertura = Number(cajaActual?.monto_apertura || 0);
  const esperado = apertura + efectivo - gastosEfectivo;

  const abrirCaja = (monto) => {
    const nueva = {
      id: Date.now(),
      estado: "abierta",
      fecha_apertura: new Date().toISOString(),
      monto_apertura: Number(monto || 0),
    };

    localStorage.setItem(CAJA_ACTUAL_KEY, JSON.stringify(nueva));
    setCajaActual(nueva);
    setAbrirDialogo(false);
  };

  const cerrarCaja = ({ contado, observaciones }) => {
    const contadoNumero = Number(contado || 0);

    const cierre = {
      id: Date.now(),
      fecha_apertura: cajaActual.fecha_apertura,
      fecha_cierre: new Date().toISOString(),
      monto_apertura: apertura,
      ventas_efectivo: efectivo,
      ventas_transferencia: transferencia,
      ventas_tarjeta: tarjeta,
      gastos_efectivo: gastosEfectivo,
      caja_esperada: esperado,
      monto_contado: contadoNumero,
      diferencia: contadoNumero - esperado,
      observaciones: observaciones.trim(),
    };

    const nuevos = [cierre, ...cierres];

    localStorage.setItem(CIERRES_KEY, JSON.stringify(nuevos));
    localStorage.removeItem(CAJA_ACTUAL_KEY);

    setCierres(nuevos);
    setCajaActual(null);
    setCerrarDialogo(false);
  };

  const totalVentas = ventasHoy.reduce(
    (suma, venta) => suma + Number(venta.total || 0),
    0
  );

  const totalGastos = gastosHoy.reduce(
    (suma, gasto) => suma + Number(gasto.monto || 0),
    0
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Caja diaria</h1>
          <p className="text-muted-foreground">
            Apertura, efectivo y cierre del día
          </p>
        </div>

        {cajaAbierta ? (
          <Button className="h-11" onClick={() => setCerrarDialogo(true)}>
            <LockKeyhole className="w-4 h-4 mr-2" />
            Cerrar caja
          </Button>
        ) : (
          <Button className="h-11" onClick={() => setAbrirDialogo(true)}>
            <UnlockKeyhole className="w-4 h-4 mr-2" />
            Abrir caja
          </Button>
        )}
      </div>

      <Card className={`p-5 ${cajaAbierta ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cajaAbierta ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
            {cajaAbierta ? (
              <UnlockKeyhole className="w-6 h-6 text-emerald-400" />
            ) : (
              <LockKeyhole className="w-6 h-6 text-amber-400" />
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="text-xl font-bold mt-1">
              {cajaAbierta ? "Caja abierta" : "Caja cerrada"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {cajaAbierta
                ? `Abierta ${fmtDateTime(cajaActual.fecha_apertura)}`
                : "Abre la caja antes de comenzar el turno."}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Resumen icon={Banknote} titulo="Caja inicial" valor={apertura} clase="bg-primary/10 text-primary" />
        <Resumen icon={ArrowDownToLine} titulo="Ventas en efectivo" valor={efectivo} clase="bg-emerald-500/10 text-emerald-400" />
        <Resumen icon={ArrowUpFromLine} titulo="Gastos en efectivo" valor={gastosEfectivo} clase="bg-red-500/10 text-red-400" />
        <Resumen icon={WalletCards} titulo="Caja esperada" valor={esperado} clase="bg-blue-500/10 text-blue-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold">Ventas por método</h2>
              <p className="text-xs text-muted-foreground">
                Solo efectivo entra físicamente en caja
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Fila nombre="Efectivo" valor={efectivo} activo />
            <Fila nombre="Transferencia" valor={transferencia} />
            <Fila nombre="Tarjeta" valor={tarjeta} />
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Resumen del día</h2>
          </div>

          <div className="space-y-3">
            <Linea label="Ventas totales" valor={totalVentas} />
            <Linea label="Gastos totales" valor={totalGastos} negativo />
            <div className="pt-4 mt-4 border-t border-border">
              <Linea
                label="Resultado del día"
                valor={totalVentas - totalGastos}
                destacado
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <History className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Historial de cierres</h2>
            <p className="text-xs text-muted-foreground">
              Arqueos registrados
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 text-left">Fecha</th>
                <th className="p-4 text-right">Esperado</th>
                <th className="p-4 text-right">Contado</th>
                <th className="p-4 text-right">Diferencia</th>
                <th className="p-4 text-left">Observaciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {cierres.length ? (
                cierres.map((cierre) => (
                  <tr key={cierre.id} className="hover:bg-muted/30">
                    <td className="p-4 text-primary font-medium whitespace-nowrap">
                      {fmtDateTime(cierre.fecha_cierre)}
                    </td>
                    <td className="p-4 text-right">{fmtMoney(cierre.caja_esperada)}</td>
                    <td className="p-4 text-right font-semibold">{fmtMoney(cierre.monto_contado)}</td>
                    <td className={`p-4 text-right font-bold ${
                      cierre.diferencia === 0
                        ? "text-emerald-400"
                        : cierre.diferencia > 0
                        ? "text-blue-400"
                        : "text-red-400"
                    }`}>
                      {cierre.diferencia > 0 ? "+" : ""}
                      {fmtMoney(cierre.diferencia)}
                    </td>
                    <td className="p-4 text-muted-foreground max-w-[260px] truncate">
                      {cierre.observaciones || "Sin observaciones"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No hay cierres registrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {abrirDialogo && (
        <AperturaDialog
          onClose={() => setAbrirDialogo(false)}
          onSave={abrirCaja}
        />
      )}

      {cerrarDialogo && (
        <CierreDialog
          esperado={esperado}
          onClose={() => setCerrarDialogo(false)}
          onSave={cerrarCaja}
        />
      )}
    </div>
  );
}

function Resumen({ icon: Icon, titulo, valor, clase }) {
  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${clase}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{titulo}</p>
          <p className="text-xl font-bold mt-0.5">{fmtMoney(valor)}</p>
        </div>
      </div>
    </Card>
  );
}

function Fila({ nombre, valor, activo = false }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
      activo ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-muted/10"
    }`}>
      <span className="text-sm text-muted-foreground">{nombre}</span>
      <span className={activo ? "font-semibold text-emerald-400" : "font-semibold"}>
        {fmtMoney(valor)}
      </span>
    </div>
  );
}

function Linea({ label, valor, negativo = false, destacado = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={destacado ? "font-semibold" : "text-sm text-muted-foreground"}>
        {label}
      </span>
      <span className={`font-bold ${
        negativo
          ? "text-red-400"
          : destacado
          ? valor >= 0
            ? "text-xl text-emerald-400"
            : "text-xl text-red-400"
          : ""
      }`}>
        {negativo ? "-" : ""}
        {fmtMoney(Math.abs(valor))}
      </span>
    </div>
  );
}

function AperturaDialog({ onClose, onSave }) {
  const [monto, setMonto] = useState("");
  const [error, setError] = useState("");

  const guardar = () => {
    const valor = Number(monto || 0);
    if (valor < 0) {
      setError("El monto no puede ser negativo.");
      return;
    }
    onSave(valor);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="font-medium">Monto inicial</p>
          <p className="text-sm text-muted-foreground mt-1">
            Efectivo disponible antes de comenzar las ventas.
          </p>
        </div>

        <div>
          <Label>Efectivo de apertura</Label>
          <NumericInput
            min={0}
            value={monto}
            onValueChange={(valor) => {
              setMonto(valor);
              setError("");
            }}
            className="mt-1 h-12 text-lg"
            placeholder="0"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar}>Abrir caja</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CierreDialog({ esperado, onClose, onSave }) {
  const [contado, setContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");

  const contadoNumero = Number(contado || 0);
  const diferencia = contadoNumero - esperado;

  const guardar = () => {
    if (contado === "") {
      setError("Ingresa el dinero contado.");
      return;
    }
    if (contadoNumero < 0) {
      setError("El monto no puede ser negativo.");
      return;
    }
    onSave({ contado: contadoNumero, observaciones });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
        </DialogHeader>

        <div className="rounded-2xl border border-border bg-muted/20 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Caja esperada
          </p>
          <p className="text-4xl font-bold text-primary mt-2">
            {fmtMoney(esperado)}
          </p>
        </div>

        <div>
          <Label>Dinero contado</Label>
          <NumericInput
            min={0}
            value={contado}
            onValueChange={(valor) => {
              setContado(valor);
              setError("");
            }}
            className="mt-1 h-12 text-lg"
            placeholder="0"
          />
        </div>

        {contado !== "" && (
          <div className={`rounded-xl border px-4 py-4 ${
            diferencia === 0
              ? "border-emerald-500/30 bg-emerald-500/10"
              : diferencia > 0
              ? "border-blue-500/30 bg-blue-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}>
            <div className="flex items-center gap-3">
              {diferencia === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${
                  diferencia > 0 ? "text-blue-400" : "text-red-400"
                }`} />
              )}
              <div>
                <p className="text-sm font-medium">
                  {diferencia === 0 ? "Caja cuadrada" : diferencia > 0 ? "Sobrante" : "Faltante"}
                </p>
                <p className="text-xl font-bold mt-1">
                  {diferencia > 0 ? "+" : ""}
                  {fmtMoney(diferencia)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <Label>Observaciones</Label>
          <textarea
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ej: Se dejó sencillo para mañana..."
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar}>Confirmar cierre</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
