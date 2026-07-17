import React, {
  useMemo,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Boxes,
  BarChart3,
  WalletCards,
} from "lucide-react";

import {
  aplicarTema,
  obtenerTemaGuardado,
} from "@/lib/themes";

const leerJSON = (
  clave,
  fallback
) => {
  try {
    return JSON.parse(
      localStorage.getItem(
        clave
      ) ||
        JSON.stringify(
          fallback
        )
    );
  } catch {
    return fallback;
  }
};

export default function Bienvenida() {
  const navigate =
    useNavigate();

  const configuracion =
    useMemo(
      () =>
        leerJSON(
          "configuracion_empresa",
          {
            nombre:
              "Maderas M&M",
            logo: "/logo.png",
          }
        ),
      []
    );

  React.useEffect(() => {
    aplicarTema(
      obtenerTemaGuardado()
    );
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-20 w-80 h-80 rounded-full bg-primary/15 blur-3xl" />

        <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-primary/10 blur-3xl" />

        <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(circle_at_center,currentColor_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="relative min-h-screen grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex items-center justify-center p-6 md:p-10 lg:p-14">
          <div className="w-full max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Sistema de administración
            </div>

            <div className="mt-8 flex items-center gap-4">
              <img
                src={
                  configuracion.logo ||
                  "/logo.png"
                }
                alt={
                  configuracion.nombre ||
                  "Logo"
                }
                className="w-20 h-20 md:w-24 md:h-24 rounded-[24px] object-cover border border-border shadow-xl"
                onError={(event) => {
                  event.currentTarget.src =
                    "/logo.png";
                }}
              />

              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Bienvenido a
                </p>

                <h1 className="text-3xl md:text-5xl font-bold font-heading mt-1 truncate">
                  {configuracion.nombre ||
                    "Maderas M&M"}
                </h1>
              </div>
            </div>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mt-8 max-w-xl">
              Inventario, ventas, caja, compras, clientes y reportes en un solo lugar.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/inicio"
                )
              }
              className="group mt-10 inline-flex h-14 items-center gap-3 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Entrar al sistema

              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Datos guardados localmente
              </div>

              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Tema personalizado activo
              </div>
            </div>
          </div>
        </section>

        <section className="hidden lg:flex items-center justify-center p-10">
          <div className="w-full max-w-md rounded-[32px] border border-border bg-card/85 backdrop-blur-xl p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Todo bajo control
            </p>

            <h2 className="text-2xl font-bold mt-3">
              El negocio, en una sola vista
            </h2>

            <div className="space-y-3 mt-7">
              <Feature
                icon={Boxes}
                titulo="Inventario"
                descripcion="Stock, productos y alertas críticas"
              />

              <Feature
                icon={WalletCards}
                titulo="Caja diaria"
                descripcion="Apertura, cierre y diferencias"
              />

              <Feature
                icon={BarChart3}
                titulo="Reportes"
                descripcion="Ventas, gastos y utilidad"
              />
            </div>

            <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-sm font-medium text-primary">
                Preparado para comenzar
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Presiona “Entrar al sistema” para abrir el panel.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  titulo,
  descripcion,
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/15 p-4">
      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div>
        <p className="font-semibold">
          {titulo}
        </p>

        <p className="text-xs text-muted-foreground mt-1">
          {descripcion}
        </p>
      </div>
    </div>
  );
}
