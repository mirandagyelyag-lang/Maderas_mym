import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShoppingBag,
} from "lucide-react";

import { fmtMoney } from "@/lib/format";
import { registrarActividad } from "@/lib/database";
import {
  eliminarProveedorRemoto,
  getComprasLocalesRespaldo,
  getComprasRemotas,
  getProveedoresLocalesRespaldo,
  getProveedoresRemotos,
  guardarProveedorRemoto,
  importarComprasYProveedoresLocalesSiVacio,
  subscribeCompras,
  subscribeProveedores,
} from "@/lib/purchasingRepository";

const resumirProveedor = (proveedor) => ({
  nombre: proveedor?.nombre || "",
  rut: proveedor?.rut || "",
  telefono: proveedor?.telefono || "",
  correo: proveedor?.correo || "",
  direccion: proveedor?.direccion || "",
  contacto: proveedor?.contacto || "",
});

export default function Proveedores() {
  const [proveedores, setProveedores] =
    useState(
      getProveedoresLocalesRespaldo
    );

  const [compras, setCompras] =
    useState(
      getComprasLocalesRespaldo
    );

  const [busqueda, setBusqueda] =
    useState("");

  const [dialogo, setDialogo] =
    useState(null);

  const [
    errorSincronizacion,
    setErrorSincronizacion,
  ] = useState("");

  const [guardando, setGuardando] =
    useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        await importarComprasYProveedoresLocalesSiVacio();

        const [
          proveedoresRemotos,
          comprasRemotas,
        ] = await Promise.all([
          getProveedoresRemotos(),
          getComprasRemotas(),
        ]);

        setProveedores(
          proveedoresRemotos
        );
        setCompras(comprasRemotas);
        setErrorSincronizacion("");
      } catch (error) {
        console.error(
          "No se pudieron sincronizar los proveedores:",
          error
        );

        setProveedores(
          getProveedoresLocalesRespaldo()
        );
        setCompras(
          getComprasLocalesRespaldo()
        );
        setErrorSincronizacion(
          "No se pudieron sincronizar los proveedores con Supabase."
        );
      }
    };

    cargarDatos();

    const cancelarProveedores =
      subscribeProveedores(cargarDatos);
    const cancelarCompras =
      subscribeCompras(cargarDatos);

    return () => {
      cancelarProveedores();
      cancelarCompras();
    };
  }, []);

  const guardarProveedor = async (
    datos,
    actividad
  ) => {
    if (guardando) return;

    setGuardando(true);

    try {
      const guardado =
        await guardarProveedorRemoto(
          datos
        );

      setProveedores(
        await getProveedoresRemotos()
      );
      registrarActividad({
        ...actividad,
        entidadId: guardado.id,
      });
      setErrorSincronizacion("");
      setDialogo(null);
    } catch (error) {
      console.error(
        "No se pudo guardar el proveedor:",
        error
      );
      setErrorSincronizacion(
        error.message ||
          "No se pudo guardar el proveedor."
      );
    } finally {
      setGuardando(false);
    }
  };

  const proveedoresFiltrados =
    useMemo(() => {
      const texto = busqueda
        .trim()
        .toLowerCase();

      return proveedores.filter(
        (proveedor) =>
          [
            proveedor.nombre,
            proveedor.rut,
            proveedor.telefono,
            proveedor.correo,
          ].some((campo) =>
            String(campo || "")
              .toLowerCase()
              .includes(texto)
          )
      );
    }, [
      proveedores,
      busqueda,
    ]);

  const eliminar = async (
    proveedor
  ) => {
    const tieneCompras =
      compras.some(
        (compra) =>
          String(
            compra.proveedor_id
          ) ===
          String(proveedor.id)
      );

    if (tieneCompras) {
      window.alert(
        "No puedes eliminar este proveedor porque tiene compras registradas."
      );
      return;
    }

    if (
      !window.confirm(
        `¿Eliminar a ${proveedor.nombre}?`
      )
    ) {
      return;
    }

    try {
      await eliminarProveedorRemoto(
        proveedor.id
      );

      setProveedores(
        await getProveedoresRemotos()
      );
      registrarActividad({
        accion: "eliminar",
        modulo: "Proveedores",
        entidadId: proveedor.id,
        entidadNombre: proveedor.nombre,
        descripcion: `Eliminó al proveedor ${proveedor.nombre}`,
        datosAntes: resumirProveedor(proveedor),
      });
      setErrorSincronizacion("");
    } catch (error) {
      console.error(
        "No se pudo eliminar el proveedor:",
        error
      );
      setErrorSincronizacion(
        error.message ||
          "No se pudo eliminar el proveedor."
      );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Proveedores
          </h1>

          <p className="text-muted-foreground">
            Empresas y personas que abastecen el negocio
          </p>
        </div>

        <Button
          onClick={() =>
            setDialogo({})
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo proveedor
        </Button>
      </div>

      {errorSincronizacion && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errorSincronizacion}
        </div>
      )}

      <Card className="p-4 bg-card border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            value={busqueda}
            onChange={(event) =>
              setBusqueda(
                event.target.value
              )
            }
            placeholder="Buscar proveedor, RUT, teléfono o correo..."
            className="pl-10"
          />
        </div>
      </Card>

      {proveedoresFiltrados.length >
      0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {proveedoresFiltrados.map(
            (proveedor) => {
              const comprasProveedor =
                compras.filter(
                  (compra) =>
                    String(
                      compra.proveedor_id
                    ) ===
                    String(
                      proveedor.id
                    )
                );

              const totalComprado =
                comprasProveedor.reduce(
                  (total, compra) =>
                    total +
                    Number(
                      compra.total || 0
                    ),
                  0
                );

              return (
                <Card
                  key={proveedor.id}
                  className="p-5 bg-card border-border"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-lg truncate">
                        {
                          proveedor.nombre
                        }
                      </h2>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {proveedor.rut ||
                          "Sin RUT"}
                      </p>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDialogo({
                            proveedor,
                          })
                        }
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          eliminar(
                            proveedor
                          )
                        }
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 text-sm">
                    {proveedor.telefono && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {
                          proveedor.telefono
                        }
                      </div>
                    )}

                    {proveedor.correo && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">
                          {
                            proveedor.correo
                          }
                        </span>
                      </div>
                    )}

                    {proveedor.direccion && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">
                          {
                            proveedor.direccion
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Compras
                      </p>

                      <p className="font-bold mt-1">
                        {
                          comprasProveedor.length
                        }
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Total comprado
                      </p>

                      <p className="font-bold text-primary mt-1">
                        {fmtMoney(
                          totalComprado
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            }
          )}
        </div>
      ) : (
        <Card className="py-16 text-center text-muted-foreground">
          <Truck className="w-12 h-12 mx-auto mb-4 opacity-25" />

          <p className="font-medium">
            No hay proveedores para mostrar
          </p>
        </Card>
      )}

      {dialogo && (
        <ProveedorDialog
          proveedor={
            dialogo.proveedor
          }
          guardando={guardando}
          onClose={() =>
            setDialogo(null)
          }
          onSave={
            guardarProveedor
          }
        />
      )}
    </div>
  );
}

function ProveedorDialog({
  proveedor,
  guardando,
  onClose,
  onSave,
}) {
  const [form, setForm] =
    useState({
      id:
        proveedor?.id ||
        String(Date.now()),
      nombre:
        proveedor?.nombre || "",
      rut:
        proveedor?.rut || "",
      telefono:
        proveedor?.telefono ||
        "",
      correo:
        proveedor?.correo || "",
      direccion:
        proveedor?.direccion ||
        "",
      contacto:
        proveedor?.contacto ||
        "",
      notas:
        proveedor?.notas || "",
    });

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
      nombre:
        form.nombre.trim(),
    };

    if (proveedor) {
      onSave(datos, {
        accion: "editar",
        modulo: "Proveedores",
        entidadId: datos.id,
        entidadNombre: datos.nombre,
        descripcion: `Editó al proveedor ${datos.nombre}`,
        datosAntes: resumirProveedor(proveedor),
        datosDespues: resumirProveedor(datos),
      });
    } else {
      onSave(datos, {
        accion: "crear",
        modulo: "Proveedores",
        entidadId: datos.id,
        entidadNombre: datos.nombre,
        descripcion: `Creó al proveedor ${datos.nombre}`,
        datosDespues: resumirProveedor(datos),
      });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {proveedor
              ? "Editar proveedor"
              : "Nuevo proveedor"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>
              Nombre{" "}
              <span className="text-red-400">
                *
              </span>
            </Label>

            <Input
              value={form.nombre}
              onChange={(event) =>
                setForm({
                  ...form,
                  nombre:
                    event.target.value,
                })
              }
              className="mt-1"
            />
          </div>

          <Campo
            label="RUT"
            value={form.rut}
            onChange={(valor) =>
              setForm({
                ...form,
                rut: valor,
              })
            }
          />

          <Campo
            label="Teléfono"
            value={form.telefono}
            onChange={(valor) =>
              setForm({
                ...form,
                telefono: valor,
              })
            }
          />

          <Campo
            label="Correo"
            value={form.correo}
            onChange={(valor) =>
              setForm({
                ...form,
                correo: valor,
              })
            }
          />

          <Campo
            label="Persona de contacto"
            value={form.contacto}
            onChange={(valor) =>
              setForm({
                ...form,
                contacto: valor,
              })
            }
          />

          <div className="sm:col-span-2">
            <Campo
              label="Dirección"
              value={form.direccion}
              onChange={(valor) =>
                setForm({
                  ...form,
                  direccion: valor,
                })
              }
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Notas</Label>

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
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </Button>

          <Button
            onClick={guardar}
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : "Guardar proveedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label,
  value,
  onChange,
}) {
  return (
    <div>
      <Label>{label}</Label>

      <Input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-1"
      />
    </div>
  );
}