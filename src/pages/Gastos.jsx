import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Wallet,
  Trash2,
  Plus,
  Pencil,
  Search,
  RotateCcw,
  ReceiptText,
  CalendarDays,
  TrendingDown,
} from "lucide-react";

import {
  fmtMoney,
  fmtDateTime,
} from "@/lib/format";

const categorias = [
  "Todas",
  "Insumos",
  "Combustible",
  "Sueldos",
  "Mantenimiento",
  "Otros",
];

const formularioInicial = {
  concepto: "",
  categoria: "Insumos",
  monto: "",
  comentario: "",
  fecha: new Date()
    .toISOString()
    .slice(0, 10),
};

const normalizar = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

export default function Gastos({
  actualizarGastos,
}) {
  const temporizadorRef = useRef(null);

  const [gastos, setGastos] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [
    categoriaSeleccionada,
    setCategoriaSeleccionada,
  ] = useState("Todas");

  const [
    periodoSeleccionado,
    setPeriodoSeleccionado,
  ] = useState("mes");

  const [dialogo, setDialogo] =
    useState(null);

  const [
    gastoEliminado,
    setGastoEliminado,
  ] = useState(null);

  const cargarGastos = () => {
    try {
      const guardados = JSON.parse(
        localStorage.getItem(
          "gastos"
        ) || "[]"
      );

      setGastos(
        [...guardados].sort(
          (a, b) =>
            new Date(b.fecha) -
            new Date(a.fecha)
        )
      );
    } catch (error) {
      console.error(
        "Error cargando gastos:",
        error
      );

      setGastos([]);
    }
  };

  useEffect(() => {
    cargarGastos();

    return () => {
      if (
        temporizadorRef.current
      ) {
        window.clearTimeout(
          temporizadorRef.current
        );
      }
    };
  }, []);

  const guardarGastos = (
    nuevosGastos
  ) => {
    const ordenados = [
      ...nuevosGastos,
    ].sort(
      (a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
    );

    setGastos(ordenados);

    localStorage.setItem(
      "gastos",
      JSON.stringify(ordenados)
    );

    actualizarGastos?.();
  };

  const guardarGasto = (
    gasto
  ) => {
    if (dialogo?.gasto) {
      guardarGastos(
        gastos.map((item) =>
          String(item.id) ===
          String(dialogo.gasto.id)
            ? gasto
            : item
        )
      );
    } else {
      guardarGastos([
        gasto,
        ...gastos,
      ]);
    }

    setDialogo(null);
  };

  const eliminarGasto = (
    gasto
  ) => {
    if (
      temporizadorRef.current
    ) {
      window.clearTimeout(
        temporizadorRef.current
      );
    }

    const posicionOriginal =
      gastos.findIndex(
        (item) =>
          String(item.id) ===
          String(gasto.id)
      );

    guardarGastos(
      gastos.filter(
        (item) =>
          String(item.id) !==
          String(gasto.id)
      )
    );

    setGastoEliminado({
      gasto,
      posicionOriginal,
    });

    temporizadorRef.current =
      window.setTimeout(() => {
        setGastoEliminado(null);
        temporizadorRef.current =
          null;
      }, 5000);
  };

  const deshacerEliminacion =
    () => {
      if (!gastoEliminado) {
        return;
      }

      if (
        temporizadorRef.current
      ) {
        window.clearTimeout(
          temporizadorRef.current
        );

        temporizadorRef.current =
          null;
      }

      const restaurados = [
        ...gastos,
      ];

      const posicion = Math.max(
        0,
        Math.min(
          gastoEliminado
            .posicionOriginal,
          restaurados.length
        )
      );

      restaurados.splice(
        posicion,
        0,
        gastoEliminado.gasto
      );

      guardarGastos(
        restaurados
      );

      setGastoEliminado(null);
    };

  const gastosPeriodo =
    useMemo(() => {
      const ahora = new Date();

      return gastos.filter(
        (gasto) => {
          const fecha =
            new Date(gasto.fecha);

          if (
            periodoSeleccionado ===
            "hoy"
          ) {
            return (
              fecha.toDateString() ===
              ahora.toDateString()
            );
          }

          if (
            periodoSeleccionado ===
            "semana"
          ) {
            const limite =
              new Date();

            limite.setDate(
              ahora.getDate() - 6
            );

            limite.setHours(
              0,
              0,
              0,
              0
            );

            return fecha >= limite;
          }

          return (
            fecha.getMonth() ===
              ahora.getMonth() &&
            fecha.getFullYear() ===
              ahora.getFullYear()
          );
        }
      );
    }, [
      gastos,
      periodoSeleccionado,
    ]);

  const gastosFiltrados =
    useMemo(() => {
      const texto =
        normalizar(busqueda);

      return gastosPeriodo.filter(
        (gasto) => {
          const coincideCategoria =
            categoriaSeleccionada ===
              "Todas" ||
            gasto.categoria ===
              categoriaSeleccionada;

          const coincideBusqueda =
            !texto ||
            [
              gasto.concepto,
              gasto.comentario,
              gasto.categoria,
            ].some((campo) =>
              normalizar(campo).includes(
                texto
              )
            );

          return (
            coincideCategoria &&
            coincideBusqueda
          );
        }
      );
    }, [
      gastosPeriodo,
      busqueda,
      categoriaSeleccionada,
    ]);

  const totalPeriodo =
    gastosPeriodo.reduce(
      (total, gasto) =>
        total +
        Number(gasto.monto || 0),
      0
    );

  const gastoMayor =
    gastosPeriodo.reduce(
      (mayor, gasto) =>
        !mayor ||
        Number(gasto.monto || 0) >
          Number(
            mayor.monto || 0
          )
          ? gasto
          : mayor,
      null
    );

  const promedio =
    gastosPeriodo.length > 0
      ? totalPeriodo /
        gastosPeriodo.length
      : 0;

  const etiquetaPeriodo = {
    hoy: "Hoy",
    semana: "Últimos 7 días",
    mes: "Este mes",
  }[periodoSeleccionado];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gastos
          </h1>

          <p className="text-muted-foreground">
            Registrar y revisar los gastos del negocio
          </p>
        </div>

        <Button
          type="button"
          onClick={() =>
            setDialogo({})
          }
          className="h-11"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo gasto
        </Button>
      </div>

      {gastoEliminado && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-red-400">
            <Trash2 className="w-5 h-5 shrink-0" />

            <span>
              Gasto “
              {
                gastoEliminado
                  .gasto.concepto
              }
              ” eliminado
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-red-500" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Total
              </p>

              <p className="text-xl font-bold">
                {fmtMoney(
                  totalPeriodo
                )}
              </p>

              <p className="text-[11px] text-muted-foreground mt-0.5">
                {etiquetaPeriodo}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ReceiptText className="w-5 h-5 text-primary" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">
                Registros
              </p>

              <p className="text-xl font-bold">
                {
                  gastosPeriodo.length
                }
              </p>

              <p className="text-[11px] text-muted-foreground mt-0.5">
                Promedio{" "}
                {fmtMoney(promedio)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-amber-500" />
            </div>

            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Gasto más alto
              </p>

              <p className="text-xl font-bold">
                {fmtMoney(
                  gastoMayor?.monto ||
                    0
                )}
              </p>

              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {gastoMayor?.concepto ||
                  "Sin gastos"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-card border-border">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              value={busqueda}
              onChange={(event) =>
                setBusqueda(
                  event.target.value
                )
              }
              placeholder="Buscar concepto, comentario o categoría..."
              className="pl-10 h-11"
            />
          </div>

          <select
            value={
              categoriaSeleccionada
            }
            onChange={(event) =>
              setCategoriaSeleccionada(
                event.target.value
              )
            }
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            {categorias.map(
              (categoria) => (
                <option
                  key={categoria}
                  value={categoria}
                >
                  {categoria}
                </option>
              )
            )}
          </select>

          <select
            value={
              periodoSeleccionado
            }
            onChange={(event) =>
              setPeriodoSeleccionado(
                event.target.value
              )
            }
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="hoy">
              Hoy
            </option>

            <option value="semana">
              Últimos 7 días
            </option>

            <option value="mes">
              Este mes
            </option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden border-border bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-semibold">
              Historial de gastos
            </h2>

            <p className="text-xs text-muted-foreground mt-0.5">
              {
                gastosFiltrados.length
              }{" "}
              resultado
              {gastosFiltrados.length ===
              1
                ? ""
                : "s"}
            </p>
          </div>

          <span className="font-bold text-primary">
            {fmtMoney(
              gastosFiltrados.reduce(
                (total, gasto) =>
                  total +
                  Number(
                    gasto.monto || 0
                  ),
                0
              )
            )}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-muted-foreground">
                <th className="p-4">
                  Fecha
                </th>

                <th className="p-4">
                  Concepto
                </th>

                <th className="p-4">
                  Categoría
                </th>

                <th className="p-4">
                  Comentario
                </th>

                <th className="p-4 text-right">
                  Monto
                </th>

                <th className="p-4 text-center">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {gastosFiltrados.length >
              0 ? (
                gastosFiltrados.map(
                  (gasto) => (
                    <tr
                      key={gasto.id}
                      className="hover:bg-muted/30 transition"
                    >
                      <td className="p-4 text-primary font-medium whitespace-nowrap">
                        {fmtDateTime(
                          gasto.fecha
                        )}
                      </td>

                      <td className="p-4 font-medium">
                        {
                          gasto.concepto
                        }
                      </td>

                      <td className="p-4">
                        <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                          {
                            gasto.categoria
                          }
                        </span>
                      </td>

                      <td className="p-4 text-muted-foreground max-w-[240px] truncate">
                        {gasto.comentario ||
                          "Sin comentario"}
                      </td>

                      <td className="p-4 text-right font-bold">
                        {fmtMoney(
                          gasto.monto
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Editar gasto"
                            onClick={() =>
                              setDialogo({
                                gasto,
                              })
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Eliminar gasto"
                            onClick={() =>
                              eliminarGasto(
                                gasto
                              )
                            }
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="p-16 text-center text-muted-foreground"
                  >
                    <Wallet className="w-12 h-12 mx-auto mb-4 opacity-20" />

                    <p className="font-medium">
                      No hay gastos para mostrar
                    </p>

                    <p className="text-xs mt-1">
                      Cambia los filtros o registra un nuevo gasto
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {dialogo && (
        <GastoDialog
          gasto={dialogo.gasto}
          onSave={guardarGasto}
          onClose={() =>
            setDialogo(null)
          }
        />
      )}
    </div>
  );
}

function GastoDialog({
  gasto,
  onSave,
  onClose,
}) {
  const [form, setForm] =
    useState(() => {
      if (!gasto) {
        return {
          ...formularioInicial,
          fecha: new Date()
            .toISOString()
            .slice(0, 10),
        };
      }

      return {
        concepto:
          gasto.concepto || "",
        categoria:
          gasto.categoria ||
          "Insumos",
        monto:
          gasto.monto ===
          undefined
            ? ""
            : String(
                gasto.monto
              ),
        comentario:
          gasto.comentario || "",
        fecha: new Date(
          gasto.fecha
        )
          .toISOString()
          .slice(0, 10),
      };
    });

  const [error, setError] =
    useState("");

  const guardar = () => {
    if (!form.concepto.trim()) {
      setError(
        "El concepto es obligatorio."
      );
      return;
    }

    if (
      Number(form.monto || 0) <=
      0
    ) {
      setError(
        "El monto debe ser mayor que cero."
      );
      return;
    }

    const fechaBase = new Date(
      `${form.fecha}T12:00:00`
    );

    onSave({
      id:
        gasto?.id ||
        Date.now(),
      concepto:
        form.concepto.trim(),
      categoria:
        form.categoria,
      monto: Number(
        form.monto || 0
      ),
      comentario:
        form.comentario.trim(),
      fecha:
        fechaBase.toISOString(),
    });
  };

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {gasto
              ? "Editar gasto"
              : "Nuevo gasto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>
              Concepto{" "}
              <span className="text-red-400">
                *
              </span>
            </Label>

            <Input
              value={form.concepto}
              onChange={(event) => {
                setForm({
                  ...form,
                  concepto:
                    event.target.value,
                });

                setError("");
              }}
              placeholder="Ej: Compra de clavos"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Categoría</Label>

            <select
              value={form.categoria}
              onChange={(event) =>
                setForm({
                  ...form,
                  categoria:
                    event.target.value,
                })
              }
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {categorias
                .filter(
                  (categoria) =>
                    categoria !==
                    "Todas"
                )
                .map(
                  (categoria) => (
                    <option
                      key={categoria}
                      value={categoria}
                    >
                      {categoria}
                    </option>
                  )
                )}
            </select>
          </div>

          <div>
            <Label>Fecha</Label>

            <Input
              type="date"
              value={form.fecha}
              onChange={(event) =>
                setForm({
                  ...form,
                  fecha:
                    event.target.value,
                })
              }
              className="mt-1 [color-scheme:dark]"
            />
          </div>

          <div className="md:col-span-2">
            <Label>
              Monto{" "}
              <span className="text-red-400">
                *
              </span>
            </Label>

            <NumericInput
              min={1}
              value={form.monto}
              onValueChange={(valor) => {
                setForm({
                  ...form,
                  monto: valor,
                });

                setError("");
              }}
              placeholder="0"
              className="mt-1"
            />
          </div>

          <div className="md:col-span-2">
            <Label>
              Comentario
            </Label>

            <textarea
              value={
                form.comentario
              }
              onChange={(event) =>
                setForm({
                  ...form,
                  comentario:
                    event.target.value,
                })
              }
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Información adicional..."
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={guardar}
          >
            {gasto
              ? "Guardar cambios"
              : "Registrar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
