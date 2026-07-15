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
} from "lucide-react";

const CONFIG_KEY = "configuracion_empresa";

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

  const [form, setForm] = useState(
    configuracionInicial
  );

  const [mensaje, setMensaje] =
    useState("");

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

  const actualizarCampo = (
    campo,
    valor
  ) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const mostrarMensaje = (texto) => {
    setMensaje(texto);

    window.setTimeout(() => {
      setMensaje("");
    }, 2200);
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
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
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
    </div>
  );
}