import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NumericInput from "@/components/NumericInput";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Switch } from "@/components/ui/switch";

import {
  Loader2,
  Upload,
  Trash2,
  Image as ImageIcon,
  Link,
  AlertTriangle,
} from "lucide-react";

const categorias = [
  "Madera Bruta",
  "Madera Impregnada",
  "Planchas",
  "Accesorios",
];

const unidades = [
  "Unidad",
  "Metro",
  "Pie",
  "Placa",
];

const MAX_FILE_SIZE =
  8 * 1024 * 1024;

const MAX_IMAGE_DIMENSION = 900;

const comprimirImagen = (
  archivo
) =>
  new Promise((resolve, reject) => {
    const lector =
      new FileReader();

    lector.onload = () => {
      const imagen =
        new Image();

      imagen.onload = () => {
        const escala = Math.min(
          1,
          MAX_IMAGE_DIMENSION /
            Math.max(
              imagen.width,
              imagen.height
            )
        );

        const ancho = Math.max(
          1,
          Math.round(
            imagen.width * escala
          )
        );

        const alto = Math.max(
          1,
          Math.round(
            imagen.height * escala
          )
        );

        const canvas =
          document.createElement(
            "canvas"
          );

        canvas.width = ancho;
        canvas.height = alto;

        const contexto =
          canvas.getContext("2d");

        if (!contexto) {
          reject(
            new Error(
              "No se pudo procesar la imagen."
            )
          );
          return;
        }

        contexto.drawImage(
          imagen,
          0,
          0,
          ancho,
          alto
        );

        resolve(
          canvas.toDataURL(
            "image/jpeg",
            0.72
          )
        );
      };

      imagen.onerror = () =>
        reject(
          new Error(
            "La imagen no se pudo leer."
          )
        );

      imagen.src = String(
        lector.result
      );
    };

    lector.onerror = () =>
      reject(
        new Error(
          "No se pudo abrir el archivo."
        )
      );

    lector.readAsDataURL(archivo);
  });

export default function ProductFormDialog({
  product,
  onClose,
  onSaved,
}) {
  const isEdit =
    Boolean(product);

  const inputFotoRef =
    useRef(null);

  const [form, setForm] =
    useState({
      nombre: "",
      categoria:
        "Madera Bruta",
      subcategoria: "",
      unidad_medida:
        "Unidad",
      precio_unitario: "",
      costo_unitario: "",
      stock_actual: "",
      stock_minimo: "",
      foto_url: "",
      activo: true,
    });

  const [modoImagen, setModoImagen] =
    useState("archivo");

  const [loading, setLoading] =
    useState(false);

  const [
    procesandoFoto,
    setProcesandoFoto,
  ] = useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!product) return;

    const foto =
      product.foto_url || "";

    setForm({
      nombre:
        product.nombre || "",
      categoria:
        product.categoria ||
        "Madera Bruta",
      subcategoria:
        product.subcategoria ||
        "",
      unidad_medida:
        product.unidad_medida ||
        "Unidad",
      precio_unitario:
        product.precio_unitario ??
        "",
      costo_unitario:
        product.costo_unitario ??
        "",
      stock_actual:
        product.stock_actual ??
        "",
      stock_minimo:
        product.stock_minimo ??
        "",
      foto_url: foto,
      activo:
        product.activo !== false,
    });

    setModoImagen(
      foto.startsWith("data:image/")
        ? "archivo"
        : foto
        ? "url"
        : "archivo"
    );
  }, [product]);

  const set = (
    campo,
    valor
  ) => {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const seleccionarFoto = async (
    event
  ) => {
    const archivo =
      event.target.files?.[0];

    if (!archivo) return;

    setError("");

    if (
      !archivo.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "Selecciona una imagen válida."
      );

      event.target.value = "";
      return;
    }

    if (
      archivo.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "La imagen no puede superar 8 MB."
      );

      event.target.value = "";
      return;
    }

    setProcesandoFoto(true);

    try {
      const imagenComprimida =
        await comprimirImagen(
          archivo
        );

      set(
        "foto_url",
        imagenComprimida
      );

      setModoImagen(
        "archivo"
      );
    } catch (errorImagen) {
      console.error(
        "Error procesando foto:",
        errorImagen
      );

      setError(
        "No se pudo procesar la imagen."
      );
    } finally {
      setProcesandoFoto(false);
      event.target.value = "";
    }
  };

  const cambiarModo = (
    modo
  ) => {
    setModoImagen(modo);
    setError("");

    if (
      modo === "url" &&
      form.foto_url.startsWith(
        "data:image/"
      )
    ) {
      set("foto_url", "");
    }

    if (
      modo === "archivo" &&
      form.foto_url &&
      !form.foto_url.startsWith(
        "data:image/"
      )
    ) {
      set("foto_url", "");
    }
  };

  const quitarFoto = () => {
    set("foto_url", "");

    if (
      inputFotoRef.current
    ) {
      inputFotoRef.current.value =
        "";
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!form.nombre.trim()) {
      setError(
        "El nombre es obligatorio."
      );
      return;
    }

    setLoading(true);

    try {
      const productosGuardados =
        JSON.parse(
          localStorage.getItem(
            "inventario"
          ) || "[]"
        );

      const datosProducto = {
        ...form,
        nombre:
          form.nombre.trim(),
        subcategoria:
          form.subcategoria.trim(),
        precio_unitario: Number(
          form.precio_unitario ||
            0
        ),
        costo_unitario: Number(
          form.costo_unitario ||
            0
        ),
        stock_actual: Number(
          form.stock_actual || 0
        ),
        stock_minimo: Number(
          form.stock_minimo || 0
        ),
      };

      let nuevaLista;

      if (isEdit) {
        nuevaLista =
          productosGuardados.map(
            (
              productoGuardado
            ) =>
              String(
                productoGuardado.id
              ) ===
              String(product.id)
                ? {
                    ...productoGuardado,
                    ...datosProducto,
                  }
                : productoGuardado
          );
      } else {
        nuevaLista = [
          ...productosGuardados,
          {
            id: Date.now(),
            ...datosProducto,
          },
        ];
      }

      localStorage.setItem(
        "inventario",
        JSON.stringify(nuevaLista)
      );

      onSaved?.();
      onClose();
    } catch (errorGuardado) {
      console.error(
        "Error guardando producto:",
        errorGuardado
      );

      setError(
        errorGuardado?.name ===
          "QuotaExceededError"
          ? "No queda espacio suficiente para guardar esta imagen. Usa una foto más pequeña o una URL."
          : "No se pudo guardar el producto."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={onClose}
    >
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Editar producto"
              : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-5">
          <div>
            <Label>
              Fotografía
            </Label>

            <div className="mt-1 aspect-square rounded-2xl overflow-hidden border border-border bg-secondary">
              {form.foto_url ? (
                <img
                  src={
                    form.foto_url
                  }
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-10 h-10 opacity-50" />

                  <span className="text-xs">
                    Sin fotografía
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() =>
                  cambiarModo(
                    "archivo"
                  )
                }
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  modoImagen ===
                  "archivo"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Subir foto
              </button>

              <button
                type="button"
                onClick={() =>
                  cambiarModo("url")
                }
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  modoImagen ===
                  "url"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Usar URL
              </button>
            </div>

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              onChange={
                seleccionarFoto
              }
              className="hidden"
            />

            {modoImagen ===
            "archivo" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  inputFotoRef.current?.click()
                }
                disabled={
                  procesandoFoto ||
                  loading
                }
                className="w-full mt-2"
              >
                {procesandoFoto ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}

                {form.foto_url
                  ? "Cambiar archivo"
                  : "Elegir imagen"}
              </Button>
            ) : (
              <div className="mt-2">
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                  <Input
                    value={
                      form.foto_url
                    }
                    onChange={(event) =>
                      set(
                        "foto_url",
                        event.target.value
                      )
                    }
                    placeholder="https://ejemplo.com/foto.jpg"
                    className="pl-10"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground mt-2">
                  Pega un enlace directo a una imagen.
                </p>
              </div>
            )}

            {form.foto_url && (
              <Button
                type="button"
                variant="ghost"
                onClick={quitarFoto}
                disabled={
                  procesandoFoto ||
                  loading
                }
                className="w-full mt-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Quitar foto
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              Puedes elegir una imagen del computador o pegar una URL.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>
                Nombre{" "}
                <span className="text-red-400">
                  *
                </span>
              </Label>

              <Input
                value={form.nombre}
                onChange={(event) =>
                  set(
                    "nombre",
                    event.target.value
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label>
                Categoría
              </Label>

              <Select
                value={
                  form.categoria
                }
                onValueChange={(
                  valor
                ) =>
                  set(
                    "categoria",
                    valor
                  )
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {categorias.map(
                    (categoria) => (
                      <SelectItem
                        key={
                          categoria
                        }
                        value={
                          categoria
                        }
                      >
                        {categoria}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Unidad</Label>

              <Select
                value={
                  form.unidad_medida
                }
                onValueChange={(
                  valor
                ) =>
                  set(
                    "unidad_medida",
                    valor
                  )
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {unidades.map(
                    (unidad) => (
                      <SelectItem
                        key={unidad}
                        value={unidad}
                      >
                        {unidad}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>
                Subcategoría / Medida
              </Label>

              <Input
                value={
                  form.subcategoria
                }
                onChange={(event) =>
                  set(
                    "subcategoria",
                    event.target.value
                  )
                }
                className="mt-1"
                placeholder="Ej: 2440x1220 mm"
              />
            </div>

            <div>
              <Label>
                Precio venta
              </Label>

              <NumericInput
                min={0}
                value={
                  form.precio_unitario
                }
                onValueChange={(
                  valor
                ) =>
                  set(
                    "precio_unitario",
                    valor
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label>Costo</Label>

              <NumericInput
                min={0}
                value={
                  form.costo_unitario
                }
                onValueChange={(
                  valor
                ) =>
                  set(
                    "costo_unitario",
                    valor
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label>
                Stock actual
              </Label>

              <NumericInput
                min={0}
                value={
                  form.stock_actual
                }
                onValueChange={(
                  valor
                ) =>
                  set(
                    "stock_actual",
                    valor
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label>
                Stock mínimo
              </Label>

              <NumericInput
                min={0}
                value={
                  form.stock_minimo
                }
                onValueChange={(
                  valor
                ) =>
                  set(
                    "stock_minimo",
                    valor
                  )
                }
                className="mt-1"
              />
            </div>

            {isEdit && (
              <div className="col-span-2 flex items-center gap-2 pt-1">
                <Switch
                  checked={
                    form.activo
                  }
                  onCheckedChange={(
                    valor
                  ) =>
                    set(
                      "activo",
                      valor
                    )
                  }
                />

                <Label>
                  Producto activo
                </Label>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={
              loading ||
              procesandoFoto
            }
          >
            Cancelar
          </Button>

          <Button
            onClick={
              handleSubmit
            }
            disabled={
              loading ||
              procesandoFoto ||
              !form.nombre.trim()
            }
          >
            {loading && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}

            {isEdit
              ? "Guardar cambios"
              : "Crear producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}