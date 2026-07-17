import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Building2,
  Save,
  CheckCircle2,
  Upload,
  RotateCcw,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Image as ImageIcon,
  Download,
  FileUp,
  DatabaseBackup,
  ShieldCheck,
  AlertTriangle,
  X,
  Palette,
  Check,
  MonitorCog,
} from "lucide-react";

import {
  THEMES,
  THEME_STORAGE_KEY,
  aplicarTema,
  obtenerTemaGuardado,
} from "@/lib/themes";

const CONFIG_KEY = "configuracion_empresa";

const BACKUP_VERSION = 1;

const CLAVES_RESPALDO = [
  "inventario",
  "ventas",
  "gastos",
  "mis_clientes_data",
  "deudas_clientes_barraca",
  "cotizaciones",
  "configuracion_empresa",
  THEME_STORAGE_KEY,
];

const configuracionInicial = {
  nombre: "Maderas M&M",
  rut: "",
  telefono: "",
  correo: "",
  direccion: "",
  sitio_web: "",
  mensaje_pie:
    "Gracias por preferirnos.",
  logo: "/logo.png",
};

export default function Configuracion() {
  const inputLogoRef = useRef(null);
  const inputRespaldoRef = useRef(null);

  const [form, setForm] = useState(
    configuracionInicial
  );

  const [mensaje, setMensaje] =
    useState("");

  const [tipoMensaje, setTipoMensaje] =
    useState("success");

  const [
    respaldoPendiente,
    setRespaldoPendiente,
  ] = useState(null);

  const [
    temaSeleccionado,
    setTemaSeleccionado,
  ] = useState(() =>
    obtenerTemaGuardado()
  );

  const [
    temaEnTransicion,
    setTemaEnTransicion,
  ] = useState(false);

  useEffect(() => {
    try {
      const guardada = JSON.parse(
        localStorage.getItem(CONFIG_KEY) ||
          "{}"
      );

      setForm({
        ...configuracionInicial,
        ...guardada,
      });
    } catch (error) {
      console.error(
        "Error cargando configuración:",
        error
      );
    }
  }, []);

  useEffect(() => {
    aplicarTema(
      temaSeleccionado
    );
  }, [temaSeleccionado]);

  const cambiarTema = (
    themeId
  ) => {
    if (
      temaEnTransicion ||
      themeId === temaSeleccionado
    ) {
      return;
    }

    setTemaEnTransicion(true);

    document.documentElement.classList.add(
      "theme-transforming"
    );

    window.setTimeout(() => {
      const temaAplicado =
        aplicarTema(themeId);

      setTemaSeleccionado(
        temaAplicado
      );

      mostrarMensaje(
        "Apariencia transformada"
      );
    }, 230);

    window.setTimeout(() => {
      document.documentElement.classList.remove(
        "theme-transforming"
      );

      setTemaEnTransicion(false);
    }, 820);
  };

  const actualizarCampo = (
    campo,
    valor
  ) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const mostrarMensaje = (
    texto,
    tipo = "success",
    duracion = 2600
  ) => {
    setTipoMensaje(tipo);
    setMensaje(texto);

    window.setTimeout(() => {
      setMensaje("");
    }, duracion);
  };

  const guardar = () => {
    if (!form.nombre.trim()) {
      mostrarMensaje(
        "El nombre de la empresa es obligatorio."
      );
      return;
    }

    const configuracionGuardada = {
      ...form,
      nombre: form.nombre.trim(),
      rut: form.rut.trim(),
      telefono: form.telefono.trim(),
      correo: form.correo.trim(),
      direccion:
        form.direccion.trim(),
      sitio_web:
        form.sitio_web.trim(),
      mensaje_pie:
        form.mensaje_pie.trim(),
    };

    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify(
        configuracionGuardada
      )
    );

    setForm(configuracionGuardada);

    window.dispatchEvent(
      new Event(
        "configuracion-empresa-actualizada"
      )
    );

    mostrarMensaje(
      "Configuración guardada correctamente"
    );
  };

  const cargarLogo = (event) => {
    const archivo =
      event.target.files?.[0];

    if (!archivo) return;

    if (
      !archivo.type.startsWith(
        "image/"
      )
    ) {
      mostrarMensaje(
        "Selecciona un archivo de imagen."
      );
      return;
    }

    if (
      archivo.size >
      2 * 1024 * 1024
    ) {
      mostrarMensaje(
        "El logo debe pesar menos de 2 MB."
      );
      return;
    }

    const lector = new FileReader();

    lector.onload = () => {
      actualizarCampo(
        "logo",
        String(lector.result)
      );
    };

    lector.readAsDataURL(archivo);
  };

  const restaurarLogo = () => {
    actualizarCampo(
      "logo",
      "/logo.png"
    );

    if (inputLogoRef.current) {
      inputLogoRef.current.value =
        "";
    }
  };

  const crearContenidoRespaldo = () => {
    const datos = {};

    CLAVES_RESPALDO.forEach(
      (clave) => {
        const valor =
          localStorage.getItem(clave);

        if (valor === null) {
          datos[clave] = null;
          return;
        }

        try {
          datos[clave] =
            JSON.parse(valor);
        } catch {
          datos[clave] = valor;
        }
      }
    );

    return {
      app: "Finanzas Papá",
      empresa:
        form.nombre ||
        "Maderas M&M",
      version_respaldo:
        BACKUP_VERSION,
      fecha_exportacion:
        new Date().toISOString(),
      datos,
    };
  };

  const descargarArchivoJSON = (
    contenido,
    nombreArchivo
  ) => {
    const blob = new Blob(
      [
        JSON.stringify(
          contenido,
          null,
          2
        ),
      ],
      {
        type:
          "application/json;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const enlace =
      document.createElement("a");

    enlace.href = url;
    enlace.download =
      nombreArchivo;

    document.body.appendChild(
      enlace
    );

    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);
  };

  const nombreFechaArchivo = () =>
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

  const exportarRespaldo = (
    prefijo = "respaldo"
  ) => {
    try {
      const contenido =
        crearContenidoRespaldo();

      descargarArchivoJSON(
        contenido,
        `${prefijo}-maderas-mm-${nombreFechaArchivo()}.json`
      );

      mostrarMensaje(
        "Respaldo descargado correctamente."
      );

      return true;
    } catch (error) {
      console.error(
        "Error exportando respaldo:",
        error
      );

      mostrarMensaje(
        "No se pudo crear el respaldo.",
        "error"
      );

      return false;
    }
  };

  const seleccionarRespaldo = (
    event
  ) => {
    const archivo =
      event.target.files?.[0];

    if (!archivo) return;

    if (
      !archivo.name
        .toLowerCase()
        .endsWith(".json")
    ) {
      mostrarMensaje(
        "Selecciona un respaldo en formato JSON.",
        "error"
      );

      event.target.value = "";
      return;
    }

    const lector =
      new FileReader();

    lector.onload = () => {
      try {
        const contenido =
          JSON.parse(
            String(lector.result)
          );

        if (
          !contenido ||
          typeof contenido !==
            "object" ||
          !contenido.datos ||
          typeof contenido.datos !==
            "object"
        ) {
          throw new Error(
            "Formato de respaldo inválido"
          );
        }

        const clavesValidas =
          CLAVES_RESPALDO.filter(
            (clave) =>
              Object.prototype.hasOwnProperty.call(
                contenido.datos,
                clave
              )
          );

        if (
          clavesValidas.length === 0
        ) {
          throw new Error(
            "El archivo no contiene datos compatibles"
          );
        }

        setRespaldoPendiente({
          archivo:
            archivo.name,
          contenido,
          clavesValidas,
        });
      } catch (error) {
        console.error(
          "Respaldo inválido:",
          error
        );

        mostrarMensaje(
          "El archivo no es un respaldo válido de esta aplicación.",
          "error",
          3600
        );
      } finally {
        event.target.value = "";
      }
    };

    lector.onerror = () => {
      mostrarMensaje(
        "No se pudo leer el archivo.",
        "error"
      );

      event.target.value = "";
    };

    lector.readAsText(archivo);
  };

  const restaurarRespaldo = () => {
    if (!respaldoPendiente) {
      return;
    }

    try {
      const copiaCreada =
        exportarRespaldo(
          "respaldo-antes-de-restaurar"
        );

      if (!copiaCreada) {
        mostrarMensaje(
          "La restauración se canceló porque no se pudo crear la copia de seguridad previa.",
          "error",
          4200
        );

        return;
      }

      CLAVES_RESPALDO.forEach(
        (clave) => {
          if (
            !Object.prototype.hasOwnProperty.call(
              respaldoPendiente
                .contenido.datos,
              clave
            )
          ) {
            return;
          }

          const valor =
            respaldoPendiente
              .contenido.datos[
              clave
            ];

          if (
            valor === null ||
            valor === undefined
          ) {
            localStorage.removeItem(
              clave
            );
          } else {
            localStorage.setItem(
              clave,
              JSON.stringify(valor)
            );
          }
        }
      );

      window.dispatchEvent(
        new Event(
          "configuracion-empresa-actualizada"
        )
      );

      setRespaldoPendiente(
        null
      );

      mostrarMensaje(
        "Respaldo restaurado. La aplicación se recargará.",
        "success",
        1800
      );

      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      console.error(
        "Error restaurando respaldo:",
        error
      );

      mostrarMensaje(
        "No se pudo restaurar el respaldo.",
        "error",
        3600
      );
    }
  };

  const resumenRespaldo =
    respaldoPendiente
      ? {
          productos: Array.isArray(
            respaldoPendiente
              .contenido.datos
              .inventario
          )
            ? respaldoPendiente
                .contenido.datos
                .inventario.length
            : 0,
          ventas: Array.isArray(
            respaldoPendiente
              .contenido.datos
              .ventas
          )
            ? respaldoPendiente
                .contenido.datos
                .ventas.length
            : 0,
          clientes: Array.isArray(
            respaldoPendiente
              .contenido.datos
              .mis_clientes_data
          )
            ? respaldoPendiente
                .contenido.datos
                .mis_clientes_data
                .length
            : 0,
          cotizaciones:
            Array.isArray(
              respaldoPendiente
                .contenido.datos
                .cotizaciones
            )
              ? respaldoPendiente
                  .contenido.datos
                  .cotizaciones
                  .length
              : 0,
        }
      : null;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl font-bold">
              Configuración
            </h1>

            <p className="text-sm text-muted-foreground mt-0.5">
              Datos generales de la empresa
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={guardar}
          className="h-11"
        >
          <Save className="w-4 h-4 mr-2" />
          Guardar cambios
        </Button>
      </div>

      {mensaje && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            tipoMensaje === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {tipoMensaje === "error" ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}

          <span>{mensaje}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <Card className="p-5 md:p-6 bg-card border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>
                Nombre de la empresa{" "}
                <span className="text-red-400">
                  *
                </span>
              </Label>

              <Input
                value={form.nombre}
                onChange={(event) =>
                  actualizarCampo(
                    "nombre",
                    event.target.value
                  )
                }
                className="mt-1"
                placeholder="Maderas M&M"
              />
            </div>

            <div>
              <Label>RUT</Label>

              <div className="relative mt-1">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  value={form.rut}
                  onChange={(event) =>
                    actualizarCampo(
                      "rut",
                      event.target.value
                    )
                  }
                  className="pl-10"
                  placeholder="76.123.456-7"
                />
              </div>
            </div>

            <div>
              <Label>Teléfono</Label>

              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  value={
                    form.telefono
                  }
                  onChange={(event) =>
                    actualizarCampo(
                      "telefono",
                      event.target.value
                    )
                  }
                  className="pl-10"
                  placeholder="+56 9..."
                />
              </div>
            </div>

            <div>
              <Label>Correo</Label>

              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                <Input
                  type="email"
                  value={form.correo}
                  onChange={(event) =>
                    actualizarCampo(
                      "correo",
                      event.target.value
                    )
                  }
                  className="pl-10"
                  placeholder="contacto@empresa.cl"
                />
              </div>
            </div>

            <div>
              <Label>Sitio web</Label>

              <Input
                value={form.sitio_web}
                onChange={(event) =>
                  actualizarCampo(
                    "sitio_web",
                    event.target.value
                  )
                }
                className="mt-1"
                placeholder="www.empresa.cl"
              />
            </div>

            <div className="md:col-span-2">
              <Label>Dirección</Label>

              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />

                <textarea
                  value={
                    form.direccion
                  }
                  onChange={(event) =>
                    actualizarCampo(
                      "direccion",
                      event.target.value
                    )
                  }
                  rows={2}
                  className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Dirección comercial"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label>
                Mensaje al pie de la cotización
              </Label>

              <textarea
                value={
                  form.mensaje_pie
                }
                onChange={(event) =>
                  actualizarCampo(
                    "mensaje_pie",
                    event.target.value
                  )
                }
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Gracias por preferirnos."
              />
            </div>

            <div className="md:col-span-2">
              <Label>Logo</Label>

              <div className="mt-1 flex flex-col sm:flex-row gap-2">
                <input
                  ref={inputLogoRef}
                  type="file"
                  accept="image/*"
                  onChange={cargarLogo}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    inputLogoRef.current?.click()
                  }
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Seleccionar imagen
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={restaurarLogo}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Usar logo original
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                PNG o JPG. Máximo 2 MB.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-card border-border h-fit">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-4 h-4 text-primary" />

            <h2 className="font-semibold">
              Vista previa
            </h2>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-5 text-center">
            <img
              src={
                form.logo ||
                "/logo.png"
              }
              alt="Vista previa del logo"
              className="w-32 h-32 mx-auto rounded-2xl object-cover border border-border"
              onError={(event) => {
                event.currentTarget.src =
                  "/logo.png";
              }}
            />

            <h3 className="text-xl font-bold mt-4">
              {form.nombre ||
                "Nombre de empresa"}
            </h3>

            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              {form.rut && (
                <p>RUT: {form.rut}</p>
              )}

              {form.telefono && (
                <p>{form.telefono}</p>
              )}

              {form.correo && (
                <p>{form.correo}</p>
              )}

              {form.direccion && (
                <p>{form.direccion}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Estos datos aparecerán en las cotizaciones y en el sidebar.
          </p>
        </Card>
      </div>

      <Card className="mt-6 p-5 md:p-6 bg-card border-border">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 text-primary" />
          </div>

          <div>
            <h2 className="font-semibold">
              Apariencia
            </h2>

            <p className="text-sm text-muted-foreground mt-1">
              Elige una paleta para toda la aplicación. El cambio se aplica al instante y se guarda automáticamente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-6">
          {THEMES.map((tema) => {
            const activo =
              temaSeleccionado ===
              tema.id;

            return (
              <button
                key={tema.id}
                type="button"
                onClick={() =>
                  cambiarTema(
                    tema.id
                  )
                }
                disabled={temaEnTransicion}
                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all disabled:cursor-wait disabled:opacity-70 ${
                  activo
                    ? "border-primary ring-2 ring-primary/20 shadow-lg"
                    : "border-border hover:border-primary/45 hover:-translate-y-0.5"
                }`}
              >
                <div className="flex gap-2">
                  {tema.preview.map(
                    (color, index) => (
                      <span
                        key={`${tema.id}-${index}`}
                        className={`block rounded-xl border border-black/5 ${
                          index === 0
                            ? "w-12 h-12"
                            : "w-8 h-12"
                        }`}
                        style={{
                          backgroundColor:
                            color,
                        }}
                      />
                    )
                  )}
                </div>

                <div className="mt-4 pr-8">
                  <p className="font-semibold">
                    {tema.nombre}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    {tema.descripcion}
                  </p>
                </div>

                {activo && (
                  <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-stretch">
          <div className="rounded-2xl border border-border bg-muted/20 p-5">
            <div className="flex items-center gap-2">
              <MonitorCog className="w-5 h-5 text-primary" />

              <h3 className="font-semibold">
                Vista previa
              </h3>
            </div>

            <p className="text-sm text-muted-foreground mt-2">
              Los colores cambian en tarjetas, menús, tablas, botones, modales y formularios.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="theme-preview-card p-4">
                <p className="text-xs text-muted-foreground">
                  Ventas del mes
                </p>

                <p className="text-xl font-bold mt-2">
                  $1.250.000
                </p>
              </div>

              <div className="theme-preview-card p-4">
                <p className="text-xs text-muted-foreground">
                  Stock crítico
                </p>

                <p className="text-xl font-bold text-primary mt-2">
                  3 productos
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-primary text-primary-foreground p-5 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">
                Tema activo
              </p>

              <p className="text-xl font-bold mt-2">
                {THEMES.find(
                  (tema) =>
                    tema.id ===
                    temaSeleccionado
                )?.nombre ||
                  "Oscuro M&M"}
              </p>
            </div>

            <p className="text-xs mt-8 opacity-75">
              Se mantendrá seleccionado cuando vuelvas a abrir la aplicación.
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-6 p-5 md:p-6 bg-card border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <DatabaseBackup className="w-5 h-5 text-emerald-500" />
            </div>

            <div>
              <h2 className="font-semibold">
                Respaldo de datos
              </h2>

              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Guarda inventario, ventas, gastos, clientes, deudas, cotizaciones y configuración en un solo archivo.
              </p>

              <div className="flex items-center gap-2 mt-2 text-xs text-emerald-500">
                <ShieldCheck className="w-4 h-4" />
                Antes de restaurar, se descarga automáticamente una copia de tus datos actuales.
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              type="button"
              onClick={() =>
                exportarRespaldo()
              }
              className="h-11"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar respaldo
            </Button>

            <input
              ref={inputRespaldoRef}
              type="file"
              accept=".json,application/json"
              onChange={seleccionarRespaldo}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                inputRespaldoRef.current?.click()
              }
              className="h-11"
            >
              <FileUp className="w-4 h-4 mr-2" />
              Importar respaldo
            </Button>
          </div>
        </div>
      </Card>

      {respaldoPendiente && (
        <Card className="mt-4 p-5 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    Confirmar restauración
                  </h3>

                  <p className="text-sm text-muted-foreground mt-1 break-all">
                    {respaldoPendiente.archivo}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setRespaldoPendiente(
                      null
                    )
                  }
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Productos
                  </p>

                  <p className="font-bold mt-1">
                    {resumenRespaldo.productos}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Ventas
                  </p>

                  <p className="font-bold mt-1">
                    {resumenRespaldo.ventas}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Clientes
                  </p>

                  <p className="font-bold mt-1">
                    {resumenRespaldo.clientes}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Cotizaciones
                  </p>

                  <p className="font-bold mt-1">
                    {resumenRespaldo.cotizaciones}
                  </p>
                </div>
              </div>

              <p className="text-sm text-amber-300 mt-4">
                Al continuar, estos datos reemplazarán los actuales.
              </p>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setRespaldoPendiente(
                      null
                    )
                  }
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  onClick={
                    restaurarRespaldo
                  }
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Restaurar datos
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}