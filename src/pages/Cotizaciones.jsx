import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
  getCotizaciones,
  registrarActividad,
  saveCotizaciones,
} from "@/lib/database";

import {
  Loader2,
  Plus,
  FileText,
  ChevronRight,
  Trash2,
  RotateCcw,
} from "lucide-react";

const estadoColors = {
  Borrador:
    "bg-secondary text-muted-foreground",
  Enviada:
    "bg-chart-4/15 text-chart-4",
  Aceptada:
    "bg-chart-2/15 text-chart-2",
  Rechazada:
    "bg-destructive/15 text-destructive",
};

export default function Cotizaciones() {
  const navigate = useNavigate();

  const [cotizaciones, setCotizaciones] =
    useState(null);

  const [creating, setCreating] =
    useState(false);

  const [
    eliminacionesPendientes,
    setEliminacionesPendientes,
  ] = useState([]);

  const temporizadoresRef = useRef(
    new Map()
  );

  const ordenarCotizaciones = (lista) => {
    return [...lista].sort(
      (a, b) =>
        Number(b.numero || 0) -
        Number(a.numero || 0)
    );
  };

  const cargarCotizaciones = () => {
    try {
      const guardadas = getCotizaciones();

      setCotizaciones(
        ordenarCotizaciones(guardadas)
      );
    } catch (error) {
      console.error(
        "Error cargando cotizaciones:",
        error
      );

      setCotizaciones([]);
    }
  };

  useEffect(() => {
    cargarCotizaciones();

    return () => {
      temporizadoresRef.current.forEach(
        (temporizador) =>
          window.clearTimeout(
            temporizador
          )
      );

      temporizadoresRef.current.clear();
    };
  }, []);

  const handleNew = () => {
    setCreating(true);

    try {
      navigate("/cotizaciones/nueva");
    } catch (error) {
      console.error(
        "Error creando cotización:",
        error
      );

      setCreating(false);
    }
  };

  const eliminarCotizacion = (
    event,
    cotizacion
  ) => {
    event.stopPropagation();

    try {
      const actuales = getCotizaciones();

      const posicionOriginal =
        actuales.findIndex(
          (item) =>
            String(item.id) ===
            String(cotizacion.id)
        );

      const actualizadas =
        actuales.filter(
          (item) =>
            String(item.id) !==
            String(cotizacion.id)
        );

      saveCotizaciones(actualizadas);

      registrarActividad({
        accion: "eliminar",
        modulo: "Cotizaciones",
        entidadId: cotizacion.id,
        entidadNombre: `Cotización N° ${String(
          cotizacion.numero
        ).padStart(4, "0")}`,
        descripcion: `Eliminó la Cotización N° ${String(
          cotizacion.numero
        ).padStart(4, "0")} de ${
          cotizacion.nombre_cliente || "un cliente sin nombre"
        }`,
        datosAntes: {
          numero: cotizacion.numero,
          cliente: cotizacion.nombre_cliente || "",
          estado: cotizacion.estado || "Borrador",
          total: Number(cotizacion.total || 0),
        },
      });

      setCotizaciones(
        ordenarCotizaciones(
          actualizadas
        )
      );

      const eliminacion = {
        cotizacion,
        posicionOriginal,
      };

      setEliminacionesPendientes(
        (actualesPendientes) => [
          ...actualesPendientes.filter(
            (item) =>
              String(item.cotizacion.id) !==
              String(cotizacion.id)
          ),
          eliminacion,
        ]
      );

      const temporizador =
        window.setTimeout(() => {
          setEliminacionesPendientes(
            (actualesPendientes) =>
              actualesPendientes.filter(
                (item) =>
                  String(item.cotizacion.id) !==
                  String(cotizacion.id)
              )
          );

          temporizadoresRef.current.delete(
            String(cotizacion.id)
          );
        }, 5000);

      temporizadoresRef.current.set(
        String(cotizacion.id),
        temporizador
      );
    } catch (error) {
      console.error(
        "Error eliminando cotización:",
        error
      );
    }
  };

  const deshacerEliminacion = (
    eliminacion
  ) => {
    if (!eliminacion) {
      return;
    }

    try {
      const cotizacionId = String(
        eliminacion.cotizacion.id
      );

      const temporizador =
        temporizadoresRef.current.get(
          cotizacionId
        );

      if (temporizador) {
        window.clearTimeout(
          temporizador
        );

        temporizadoresRef.current.delete(
          cotizacionId
        );
      }

      const actuales = getCotizaciones();

      const yaExiste = actuales.some(
        (item) =>
          String(item.id) ===
          String(
            eliminacion.cotizacion.id
          )
      );

      if (!yaExiste) {
        const restauradas = [
          ...actuales,
        ];

        const posicion = Math.max(
          0,
          Math.min(
            eliminacion.posicionOriginal,
            restauradas.length
          )
        );

        restauradas.splice(
          posicion,
          0,
          eliminacion.cotizacion
        );

        saveCotizaciones(restauradas);

        registrarActividad({
          accion: "restaurar",
          modulo: "Cotizaciones",
          entidadId: eliminacion.cotizacion.id,
          entidadNombre: `Cotización N° ${String(
            eliminacion.cotizacion.numero
          ).padStart(4, "0")}`,
          descripcion: `Restauró la Cotización N° ${String(
            eliminacion.cotizacion.numero
          ).padStart(4, "0")}`,
          datosDespues: {
            numero: eliminacion.cotizacion.numero,
            cliente:
              eliminacion.cotizacion.nombre_cliente || "",
            estado:
              eliminacion.cotizacion.estado || "Borrador",
            total: Number(eliminacion.cotizacion.total || 0),
          },
        });

        setCotizaciones(
          ordenarCotizaciones(
            restauradas
          )
        );
      }

      setEliminacionesPendientes(
        (actualesPendientes) =>
          actualesPendientes.filter(
            (item) =>
              String(item.cotizacion.id) !==
              cotizacionId
          )
      );
    } catch (error) {
      console.error(
        "Error restaurando cotización:",
        error
      );
    }
  };

  const elementosLista =
    ordenarCotizaciones([
      ...(cotizaciones || []).map(
        (cotizacion) => ({
          cotizacion,
          numero: cotizacion.numero,
          eliminada: false,
        })
      ),
      ...eliminacionesPendientes.map(
        (eliminacion) => ({
          cotizacion:
            eliminacion.cotizacion,
          numero:
            eliminacion.cotizacion.numero,
          eliminada: true,
          eliminacion,
        })
      ),
    ]);

  if (!cotizaciones) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading">
            Cotizaciones
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            {cotizaciones.length}{" "}
            cotización
            {cotizaciones.length === 1
              ? ""
              : "es"}
          </p>
        </div>

        <Button
          onClick={handleNew}
          disabled={creating}
          className="h-11"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}

          Nueva cotización
        </Button>
      </div>

      {elementosLista.length === 0 ? (
        <Card className="p-12 bg-card border-border text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />

          <p>No hay cotizaciones</p>

          <p className="text-xs mt-1">
            Crea una nueva para comenzar
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {elementosLista.map(
            (elemento) => {
              const cotizacion =
                elemento.cotizacion;

              if (elemento.eliminada) {
                return (
                  <div
                    key={`eliminada-${cotizacion.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 transition-all"
                  >
                    <div className="flex items-center gap-3 text-sm text-red-400">
                      <Trash2 className="w-5 h-5 shrink-0" />

                      <span>
                        Cotización N°{" "}
                        {String(
                          cotizacion.numero
                        ).padStart(4, "0")}{" "}
                        eliminada
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        deshacerEliminacion(
                          elemento.eliminacion
                        )
                      }
                      className="text-red-300 hover:text-white hover:bg-red-500/20"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Deshacer
                    </Button>
                  </div>
                );
              }

              return (
              <Card
                key={cotizacion.id}
                className="p-4 bg-card border-border hover:border-primary/40 cursor-pointer transition-all"
                onClick={() =>
                  navigate(
                    `/cotizaciones/${cotizacion.id}`
                  )
                }
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        Cotización N°{" "}
                        {String(
                          cotizacion.numero
                        ).padStart(
                          4,
                          "0"
                        )}
                      </p>

                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          estadoColors[
                            cotizacion.estado
                          ] ||
                          estadoColors.Borrador
                        }`}
                      >
                        {cotizacion.estado ||
                          "Borrador"}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {cotizacion.nombre_cliente ||
                        "Sin cliente"}{" "}
                      ·{" "}
                      {fmtDate(
                        cotizacion.fecha
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-primary">
                      {fmtMoney(
                        Number(
                          cotizacion.total ||
                            0
                        )
                      )}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {(
                        cotizacion.items ||
                        []
                      ).length}{" "}
                      ítem
                      {(
                        cotizacion.items ||
                        []
                      ).length === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Eliminar cotización"
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={(event) =>
                      eliminarCotizacion(
                        event,
                        cotizacion
                      )
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}