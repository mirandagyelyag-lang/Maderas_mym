import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { fmtMoney, fmtDate } from "@/lib/format";

import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Search,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShoppingCart,
  CalendarDays,
  RotateCcw,
  UserRound,
  NotebookText,
} from "lucide-react";

const normalizar = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

const limpiarTelefono = (telefono) =>
  String(telefono || "").replace(/\D/g, "");

const calcularSaldo = (movimientos) =>
  movimientos.reduce(
    (total, movimiento) =>
      movimiento.tipo === "fiado"
        ? total + Number(movimiento.monto || 0)
        : total - Number(movimiento.monto || 0),
    0
  );

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const [dialog, setDialog] = useState(null);
  const [dialogAbono, setDialogAbono] =
    useState(null);
  const [clienteDetalle, setClienteDetalle] =
    useState(null);

  const [
    clienteEliminado,
    setClienteEliminado,
  ] = useState(null);

  const temporizadorRef = useRef(null);

  const [deudasLocales, setDeudasLocales] =
    useState(() => {
      const local = localStorage.getItem(
        "deudas_clientes_barraca"
      );

      return local
        ? JSON.parse(local)
        : {};
    });

  const cargarDatos = () => {
    try {
      setClientes(
        JSON.parse(
          localStorage.getItem(
            "mis_clientes_data"
          ) || "[]"
        )
      );

      setVentas(
        JSON.parse(
          localStorage.getItem(
            "ventas"
          ) || "[]"
        )
      );

      setCotizaciones(
        JSON.parse(
          localStorage.getItem(
            "cotizaciones"
          ) || "[]"
        )
      );
    } catch (error) {
      console.error(
        "Error cargando clientes:",
        error
      );

      setClientes([]);
      setVentas([]);
      setCotizaciones([]);
    }
  };

  useEffect(() => {
    cargarDatos();

    const manejarStorage = () =>
      cargarDatos();

    window.addEventListener(
      "storage",
      manejarStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        manejarStorage
      );

      if (temporizadorRef.current) {
        window.clearTimeout(
          temporizadorRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "deudas_clientes_barraca",
      JSON.stringify(deudasLocales)
    );
  }, [deudasLocales]);

  const saveClientes = (
    nuevosClientes
  ) => {
    setClientes(nuevosClientes);

    localStorage.setItem(
      "mis_clientes_data",
      JSON.stringify(nuevosClientes)
    );
  };

  const obtenerVentasCliente = (
    cliente
  ) => {
    const nombre = normalizar(
      cliente.nombre
    );

    return ventas
      .filter(
        (venta) =>
          normalizar(venta.cliente) ===
          nombre
      )
      .sort(
        (a, b) =>
          new Date(b.fecha) -
          new Date(a.fecha)
      );
  };

  const obtenerCotizacionesCliente = (
    cliente
  ) => {
    const nombre = normalizar(
      cliente.nombre
    );

    return cotizaciones
      .filter(
        (cotizacion) =>
          normalizar(
            cotizacion.nombre_cliente
          ) === nombre
      )
      .sort(
        (a, b) =>
          new Date(
            b.fecha_actualizacion ||
              b.fecha
          ) -
          new Date(
            a.fecha_actualizacion ||
              a.fecha
          )
      );
  };

  const clientesEnriquecidos =
    useMemo(() => {
      return clientes.map((cliente) => {
        const ventasCliente =
          obtenerVentasCliente(cliente);

        const cotizacionesCliente =
          obtenerCotizacionesCliente(
            cliente
          );

        const totalComprado =
          ventasCliente.reduce(
            (total, venta) =>
              total +
              Number(
                venta.total || 0
              ),
            0
          );

        const ultimaVenta =
          ventasCliente[0] || null;

        const movimientos =
          deudasLocales[cliente.id] ||
          [];

        return {
          ...cliente,
          ventasCliente,
          cotizacionesCliente,
          totalComprado,
          ultimaVenta,
          saldo: calcularSaldo(
            movimientos
          ),
        };
      });
    }, [
      clientes,
      ventas,
      cotizaciones,
      deudasLocales,
    ]);

  const clientesFiltrados =
    useMemo(() => {
      const texto = normalizar(
        busqueda
      );

      if (!texto) {
        return clientesEnriquecidos;
      }

      return clientesEnriquecidos.filter(
        (cliente) =>
          [
            cliente.nombre,
            cliente.telefono_whatsapp,
            cliente.email,
            cliente.direccion,
            cliente.rut_dni,
          ].some((campo) =>
            normalizar(campo).includes(
              texto
            )
          )
      );
    }, [
      clientesEnriquecidos,
      busqueda,
    ]);

  const eliminarCliente = (
    cliente
  ) => {
    if (temporizadorRef.current) {
      window.clearTimeout(
        temporizadorRef.current
      );
    }

    const posicionOriginal =
      clientes.findIndex(
        (item) =>
          String(item.id) ===
          String(cliente.id)
      );

    const actualizados =
      clientes.filter(
        (item) =>
          String(item.id) !==
          String(cliente.id)
      );

    saveClientes(actualizados);

    setClienteEliminado({
      cliente,
      posicionOriginal,
      movimientos:
        deudasLocales[cliente.id] ||
        [],
    });

    setDeudasLocales(
      (actual) => {
        const copia = { ...actual };
        delete copia[cliente.id];
        return copia;
      }
    );

    temporizadorRef.current =
      window.setTimeout(() => {
        setClienteEliminado(null);
        temporizadorRef.current = null;
      }, 5000);
  };

  const deshacerEliminacion = () => {
    if (!clienteEliminado) return;

    if (temporizadorRef.current) {
      window.clearTimeout(
        temporizadorRef.current
      );

      temporizadorRef.current = null;
    }

    const restaurados = [
      ...clientes,
    ];

    const posicion = Math.max(
      0,
      Math.min(
        clienteEliminado.posicionOriginal,
        restaurados.length
      )
    );

    restaurados.splice(
      posicion,
      0,
      clienteEliminado.cliente
    );

    saveClientes(restaurados);

    setDeudasLocales(
      (actual) => ({
        ...actual,
        [clienteEliminado.cliente.id]:
          clienteEliminado.movimientos,
      })
    );

    setClienteEliminado(null);
  };

  const abrirWhatsApp = (
    cliente
  ) => {
    const telefono = limpiarTelefono(
      cliente.telefono_whatsapp
    );

    if (!telefono) return;

    window.open(
      `https://wa.me/${telefono}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto text-white">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Clientes
          </h1>

          <p className="text-zinc-500">
            {clientes.length} cliente
            {clientes.length === 1
              ? ""
              : "s"}{" "}
            registrado
            {clientes.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        <Button
          onClick={() =>
            setDialog({})
          }
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo cliente
        </Button>
      </div>

      {clienteEliminado && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-red-400">
            <Trash2 className="w-5 h-5 shrink-0" />

            <span>
              {clienteEliminado.cliente.nombre} eliminado
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={
              deshacerEliminacion
            }
            className="text-red-300 hover:text-white hover:bg-red-500/20"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Deshacer
          </Button>
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />

        <Input
          placeholder="Buscar por nombre, teléfono, correo, dirección o RUT..."
          value={busqueda}
          onChange={(event) =>
            setBusqueda(
              event.target.value
            )
          }
          className="pl-10 bg-zinc-900 border-zinc-800"
        />
      </div>

      {clientesFiltrados.length ===
      0 ? (
        <Card className="p-12 bg-zinc-900 border-zinc-800 text-center text-zinc-500">
          <UserRound className="w-12 h-12 mx-auto mb-3 opacity-40" />

          <p>
            No se encontraron clientes
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {clientesFiltrados.map(
            (cliente) => (
              <Card
                key={cliente.id}
                className="p-5 bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center font-bold text-xl text-amber-500 shrink-0">
                    {cliente.nombre
                      ?.charAt(0)
                      .toUpperCase() ||
                      "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setClienteDetalle(
                          cliente
                        )
                      }
                      className="text-left"
                    >
                      <h3 className="font-bold text-lg text-white hover:text-amber-400 transition">
                        {cliente.nombre}
                      </h3>
                    </button>

                    <div className="mt-2 space-y-1 text-sm">
                      {cliente.telefono_whatsapp && (
                        <p className="flex items-center gap-2 text-zinc-300">
                          <Phone className="w-3.5 h-3.5 text-zinc-500" />
                          {
                            cliente.telefono_whatsapp
                          }
                        </p>
                      )}

                      {cliente.email && (
                        <p className="flex items-center gap-2 text-zinc-300">
                          <Mail className="w-3.5 h-3.5 text-zinc-500" />
                          {cliente.email}
                        </p>
                      )}

                      {cliente.direccion && (
                        <p className="flex items-center gap-2 text-zinc-500">
                          <MapPin className="w-3.5 h-3.5" />
                          {
                            cliente.direccion
                          }
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="WhatsApp"
                      disabled={
                        !cliente.telefono_whatsapp
                      }
                      className="text-emerald-500 h-8 w-8"
                      onClick={() =>
                        abrirWhatsApp(
                          cliente
                        )
                      }
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar cliente"
                      className="h-8 w-8 text-zinc-400 hover:text-white"
                      onClick={() =>
                        setDialog({
                          cliente,
                        })
                      }
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      title="Eliminar cliente"
                      className="h-8 w-8 text-red-500 hover:text-red-400"
                      onClick={() =>
                        eliminarCliente(
                          cliente
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
                  <MiniStat
                    label="Compras"
                    value={
                      cliente
                        .ventasCliente
                        .length
                    }
                  />

                  <MiniStat
                    label="Total comprado"
                    value={fmtMoney(
                      cliente.totalComprado
                    )}
                  />

                  <MiniStat
                    label="Cotizaciones"
                    value={
                      cliente
                        .cotizacionesCliente
                        .length
                    }
                  />

                  <MiniStat
                    label="Saldo"
                    value={fmtMoney(
                      cliente.saldo
                    )}
                    danger={
                      cliente.saldo > 0
                    }
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">
                      Última compra
                    </p>

                    <p className="text-sm text-zinc-300">
                      {cliente.ultimaVenta
                        ? `${fmtMoney(
                            cliente
                              .ultimaVenta
                              .total
                          )} · ${fmtDate(
                            cliente
                              .ultimaVenta
                              .fecha
                          )}`
                        : "Sin compras registradas"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setClienteDetalle(
                          cliente
                        )
                      }
                    >
                      Ver historial
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDialogAbono({
                          cliente,
                        })
                      }
                      className="text-amber-500 hover:bg-amber-500/10"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Gestionar saldo
                    </Button>
                  </div>
                </div>
              </Card>
            )
          )}
        </div>
      )}

      {dialog && (
        <ClienteFormDialog
          cliente={dialog.cliente}
          clientes={clientes}
          onSave={saveClientes}
          onClose={() =>
            setDialog(null)
          }
        />
      )}

      {dialogAbono && (
        <AbonoDialog
          cliente={
            dialogAbono.cliente
          }
          movimientos={
            deudasLocales[
              dialogAbono.cliente.id
            ] || []
          }
          onGuardar={(nuevos) =>
            setDeudasLocales({
              ...deudasLocales,
              [dialogAbono
                .cliente.id]:
                nuevos,
            })
          }
          onClose={() =>
            setDialogAbono(null)
          }
        />
      )}

      {clienteDetalle && (
        <ClienteDetalleDialog
          cliente={
            clienteDetalle
          }
          movimientos={
            deudasLocales[
              clienteDetalle.id
            ] || []
          }
          onClose={() =>
            setClienteDetalle(null)
          }
        />
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  danger = false,
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="text-[11px] text-zinc-500">
        {label}
      </p>

      <p
        className={`text-sm font-semibold mt-1 ${
          danger
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ClienteFormDialog({
  cliente,
  clientes,
  onSave,
  onClose,
}) {
  const [form, setForm] = useState(
    cliente || {
      nombre: "",
      telefono_whatsapp: "",
      email: "",
      direccion: "",
      rut_dni: "",
      notas: "",
      id: Date.now().toString(),
    }
  );

  const [error, setError] =
    useState("");

  const guardar = () => {
    if (!form.nombre.trim()) {
      setError(
        "El nombre es obligatorio."
      );
      return;
    }

    const datos = {
      ...form,
      nombre: form.nombre.trim(),
      telefono_whatsapp:
        form.telefono_whatsapp.trim(),
      email: form.email.trim(),
      direccion:
        form.direccion.trim(),
      rut_dni: form.rut_dni.trim(),
      notas: form.notas.trim(),
    };

    if (cliente) {
      onSave(
        clientes.map((item) =>
          String(item.id) ===
          String(cliente.id)
            ? datos
            : item
        )
      );
    } else {
      onSave([
        ...clientes,
        datos,
      ]);
    }

    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {cliente
              ? "Editar cliente"
              : "Nuevo cliente"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>
              Nombre{" "}
              <span className="text-red-400">
                *
              </span>
            </Label>

            <Input
              value={form.nombre}
              onChange={(event) => {
                setForm({
                  ...form,
                  nombre:
                    event.target.value,
                });

                setError("");
              }}
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>

          <div>
            <Label>Teléfono</Label>

            <Input
              value={
                form.telefono_whatsapp
              }
              onChange={(event) =>
                setForm({
                  ...form,
                  telefono_whatsapp:
                    event.target.value,
                })
              }
              placeholder="+56 9..."
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>

          <div>
            <Label>Correo</Label>

            <Input
              type="email"
              value={form.email || ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  email:
                    event.target.value,
                })
              }
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>

          <div>
            <Label>RUT / DNI</Label>

            <Input
              value={form.rut_dni}
              onChange={(event) =>
                setForm({
                  ...form,
                  rut_dni:
                    event.target.value,
                })
              }
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>

          <div>
            <Label>Dirección</Label>

            <Input
              value={form.direccion}
              onChange={(event) =>
                setForm({
                  ...form,
                  direccion:
                    event.target.value,
                })
              }
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Observaciones</Label>

            <textarea
              value={form.notas}
              onChange={(event) =>
                setForm({
                  ...form,
                  notas:
                    event.target.value,
                })
              }
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-zinc-700"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            onClick={guardar}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AbonoDialog({
  cliente,
  movimientos,
  onGuardar,
  onClose,
}) {
  const [monto, setMonto] =
    useState("");

  const registrar = (tipo) => {
    const valor = Number(
      monto || 0
    );

    if (valor <= 0) return;

    onGuardar([
      ...movimientos,
      {
        id: Date.now(),
        tipo,
        monto: valor,
        fecha:
          new Date().toISOString(),
      },
    ]);

    onClose();
  };

  const saldo =
    calcularSaldo(movimientos);

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Saldo de {cliente.nombre}
          </DialogTitle>
        </DialogHeader>

        <Card className="p-4 bg-zinc-950 border-zinc-800">
          <p className="text-xs text-zinc-500">
            Saldo actual
          </p>

          <p
            className={`text-2xl font-bold mt-1 ${
              saldo > 0
                ? "text-red-400"
                : "text-emerald-400"
            }`}
          >
            {fmtMoney(saldo)}
          </p>
        </Card>

        <div>
          <Label>Monto</Label>

          <NumericInput
            min={1}
            placeholder="Monto"
            value={monto}
            onValueChange={setMonto}
            className="bg-zinc-950 border-zinc-800 mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() =>
              registrar("fiado")
            }
            className="bg-red-600 hover:bg-red-700"
          >
            Fiado (+)
          </Button>

          <Button
            onClick={() =>
              registrar("abono")
            }
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Abono (-)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClienteDetalleDialog({
  cliente,
  movimientos,
  onClose,
}) {
  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cliente.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat
            label="Compras"
            value={
              cliente.ventasCliente
                .length
            }
          />

          <MiniStat
            label="Total comprado"
            value={fmtMoney(
              cliente.totalComprado
            )}
          />

          <MiniStat
            label="Cotizaciones"
            value={
              cliente
                .cotizacionesCliente
                .length
            }
          />

          <MiniStat
            label="Saldo"
            value={fmtMoney(
              calcularSaldo(
                movimientos
              )
            )}
            danger={
              calcularSaldo(
                movimientos
              ) > 0
            }
          />
        </div>

        {cliente.notas && (
          <Card className="p-4 bg-zinc-950 border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <NotebookText className="w-4 h-4 text-amber-500" />

              <p className="font-medium">
                Observaciones
              </p>
            </div>

            <p className="text-sm text-zinc-400">
              {cliente.notas}
            </p>
          </Card>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-emerald-500" />

            <h3 className="font-semibold">
              Ventas
            </h3>
          </div>

          {cliente.ventasCliente
            .length === 0 ? (
            <p className="text-sm text-zinc-500">
              Sin ventas registradas.
            </p>
          ) : (
            <div className="space-y-2">
              {cliente.ventasCliente.map(
                (venta) => (
                  <Card
                    key={venta.id}
                    className="p-3 bg-zinc-950 border-zinc-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {
                          venta.nombre_producto
                        }
                      </p>

                      <p className="text-xs text-zinc-500">
                        {fmtDate(
                          venta.fecha
                        )}
                        {" · "}
                        {venta.cantidad}{" "}
                        unidad(es)
                      </p>
                    </div>

                    <p className="font-semibold text-emerald-400">
                      {fmtMoney(
                        venta.total
                      )}
                    </p>
                  </Card>
                )
              )}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-amber-500" />

            <h3 className="font-semibold">
              Cotizaciones
            </h3>
          </div>

          {cliente
            .cotizacionesCliente
            .length === 0 ? (
            <p className="text-sm text-zinc-500">
              Sin cotizaciones registradas.
            </p>
          ) : (
            <div className="space-y-2">
              {cliente.cotizacionesCliente.map(
                (cotizacion) => (
                  <Card
                    key={
                      cotizacion.id
                    }
                    className="p-3 bg-zinc-950 border-zinc-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        Cotización N°{" "}
                        {String(
                          cotizacion.numero ||
                            0
                        ).padStart(
                          4,
                          "0"
                        )}
                      </p>

                      <p className="text-xs text-zinc-500">
                        {cotizacion.estado ||
                          "Borrador"}
                        {" · "}
                        {fmtDate(
                          cotizacion.fecha
                        )}
                      </p>
                    </div>

                    <p className="font-semibold text-amber-400">
                      {fmtMoney(
                        cotizacion.total
                      )}
                    </p>
                  </Card>
                )
              )}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-blue-400" />

            <h3 className="font-semibold">
              Movimientos de saldo
            </h3>
          </div>

          {movimientos.length ===
          0 ? (
            <p className="text-sm text-zinc-500">
              Sin movimientos registrados.
            </p>
          ) : (
            <div className="space-y-2">
              {[...movimientos]
                .reverse()
                .map(
                  (movimiento) => (
                    <Card
                      key={
                        movimiento.id ||
                        `${movimiento.fecha}-${movimiento.monto}`
                      }
                      className="p-3 bg-zinc-950 border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {
                            movimiento.tipo
                          }
                        </p>

                        <p className="text-xs text-zinc-500">
                          {fmtDate(
                            movimiento.fecha
                          )}
                        </p>
                      </div>

                      <p
                        className={`font-semibold ${
                          movimiento.tipo ===
                          "fiado"
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {movimiento.tipo ===
                        "fiado"
                          ? "+"
                          : "-"}
                        {fmtMoney(
                          movimiento.monto
                        )}
                      </p>
                    </Card>
                  )
                )}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}