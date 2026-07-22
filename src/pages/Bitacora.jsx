import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getBitacora } from "@/lib/database";
import { ROLE_LABELS } from "@/lib/permissions";

import {
  CalendarDays,
  FileClock,
  History,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const ACCION_LABELS = {
  crear: "Creación",
  editar: "Edición",
  eliminar: "Eliminación",
  restaurar: "Restauración",
  convertir_venta: "Conversión en venta",
  registrar_saldo: "Movimiento de saldo",
  ajustar_stock: "Movimiento de inventario",
  registrar_venta: "Venta registrada",
  abrir_caja: "Apertura de caja",
  cerrar_caja: "Cierre de caja",
  registrar_compra: "Compra registrada",
  aprobar_usuario: "Acceso aprobado",
  activar_usuario: "Usuario activado",
  desactivar_usuario: "Usuario desactivado",
  cambiar_rol: "Cambio de rol",
  rechazar_usuario: "Solicitud rechazada",
  eliminar_usuario: "Usuario eliminado",
};

const ACCION_CLASSES = {
  crear: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  editar: "border-primary/30 bg-primary/10 text-primary",
  eliminar: "border-red-500/30 bg-red-500/10 text-red-500",
  restaurar: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  convertir_venta:
    "border-violet-500/30 bg-violet-500/10 text-violet-500",
  registrar_saldo:
    "border-amber-500/30 bg-amber-500/10 text-amber-500",
  ajustar_stock:
    "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
  registrar_venta:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  abrir_caja:
    "border-sky-500/30 bg-sky-500/10 text-sky-500",
  cerrar_caja:
    "border-violet-500/30 bg-violet-500/10 text-violet-500",
  registrar_compra:
    "border-amber-500/30 bg-amber-500/10 text-amber-500",
  aprobar_usuario:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  activar_usuario:
    "border-sky-500/30 bg-sky-500/10 text-sky-500",
  desactivar_usuario:
    "border-orange-500/30 bg-orange-500/10 text-orange-500",
  cambiar_rol:
    "border-violet-500/30 bg-violet-500/10 text-violet-500",
  rechazar_usuario:
    "border-red-500/30 bg-red-500/10 text-red-500",
  eliminar_usuario:
    "border-red-500/30 bg-red-500/10 text-red-500",
};

const formatearFecha = (fecha) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(fecha));

const normalizar = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

function DetalleCambios({ actividad }) {
  const antes = actividad.datos_antes;
  const despues = actividad.datos_despues;

  if (!antes && !despues) return null;

  const campos = Array.from(
    new Set([
      ...Object.keys(antes || {}),
      ...Object.keys(despues || {}),
    ])
  ).filter(
    (campo) =>
      JSON.stringify(antes?.[campo]) !==
      JSON.stringify(despues?.[campo])
  );

  if (campos.length === 0) return null;

  return (
    <details className="mt-4 rounded-xl border border-border bg-background/45 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Ver detalles del cambio
      </summary>

      <div className="mt-3 space-y-2">
        {campos.map((campo) => (
          <div
            key={campo}
            className="grid gap-1 border-t border-border/70 pt-2 text-xs sm:grid-cols-[150px_1fr_1fr]"
          >
            <span className="font-semibold capitalize text-foreground">
              {campo.replaceAll("_", " ")}
            </span>

            <span className="break-words text-muted-foreground">
              {antes?.[campo] === undefined
                ? "—"
                : String(antes[campo])}
            </span>

            <span className="break-words text-foreground">
              {despues?.[campo] === undefined
                ? "—"
                : String(despues[campo])}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function Bitacora() {
  const [actividades, setActividades] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [modulo, setModulo] = useState("todos");
  const [accion, setAccion] = useState("todas");

  useEffect(() => {
    const cargar = () => setActividades(getBitacora());

    cargar();
    window.addEventListener("bitacora-actualizada", cargar);
    window.addEventListener("storage", cargar);

    return () => {
      window.removeEventListener("bitacora-actualizada", cargar);
      window.removeEventListener("storage", cargar);
    };
  }, []);

  const modulos = useMemo(
    () =>
      Array.from(
        new Set(actividades.map((item) => item.modulo).filter(Boolean))
      ).sort(),
    [actividades]
  );

  const actividadesFiltradas = useMemo(() => {
    const texto = normalizar(busqueda);

    return actividades.filter((actividad) => {
      const coincideModulo =
        modulo === "todos" || actividad.modulo === modulo;
      const coincideAccion =
        accion === "todas" || actividad.accion === accion;
      const coincideTexto =
        !texto ||
        [
          actividad.descripcion,
          actividad.usuario_nombre,
          actividad.usuario_email,
          actividad.modulo,
          actividad.entidad_nombre,
        ].some((valor) => normalizar(valor).includes(texto));

      return coincideModulo && coincideAccion && coincideTexto;
    });
  }, [actividades, busqueda, modulo, accion]);

  const usuariosActivos = new Set(
    actividades.map((item) => item.usuario_id).filter(Boolean)
  ).size;

  return (
    <div className="mx-auto max-w-6xl p-4 text-foreground md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Solo administradores
            </span>
          </div>

          <h1 className="text-3xl font-bold font-heading">
            Bitácora de actividad
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Historial protegido de las acciones realizadas en el sistema.
          </p>
        </div>

        <div className="flex gap-3">
          <Card className="min-w-28 border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Registros</p>
            <p className="text-xl font-bold">{actividades.length}</p>
          </Card>

          <Card className="min-w-28 border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Usuarios</p>
            <p className="text-xl font-bold">{usuariosActivos}</p>
          </Card>
        </div>
      </div>

      <Card className="mb-5 border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por usuario, acción o registro..."
              className="border-border bg-background/70 pl-10"
            />
          </div>

          <select
            value={modulo}
            onChange={(event) => setModulo(event.target.value)}
            className="h-10 rounded-md border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="todos">Todos los módulos</option>
            {modulos.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={accion}
            onChange={(event) => setAccion(event.target.value)}
            className="h-10 rounded-md border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="todas">Todas las acciones</option>
            {Object.entries(ACCION_LABELS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {actividadesFiltradas.length === 0 ? (
        <Card className="border-border bg-card p-12 text-center">
          <History className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="font-semibold">No hay actividades para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Las nuevas acciones en Clientes y Cotizaciones aparecerán aquí.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {actividadesFiltradas.map((actividad) => (
            <Card
              key={actividad.id}
              className="border-border bg-card p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileClock className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        ACCION_CLASSES[actividad.accion] ||
                        "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {ACCION_LABELS[actividad.accion] || actividad.accion}
                    </span>

                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {actividad.modulo}
                    </span>
                  </div>

                  <p className="mt-3 font-medium leading-6">
                    {actividad.descripcion}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5" />
                      {actividad.usuario_nombre}
                      {actividad.usuario_rol
                        ? ` · ${
                            ROLE_LABELS[actividad.usuario_rol] ||
                            actividad.usuario_rol
                          }`
                        : ""}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatearFecha(actividad.fecha)}
                    </span>
                  </div>

                  <DetalleCambios actividad={actividad} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}