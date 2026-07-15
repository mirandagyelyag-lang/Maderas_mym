import React, {
  useMemo,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Pencil,
  Trash2,
  Plus,
  Search,
  Package,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react";

import ProductFormDialog from "@/components/ProductFormDialog";
import { fmtMoney } from "@/lib/format";

const productosIniciales = [
  {
    id: 1,
    nombre: "Melamina Blanca 15mm",
    categoria: "Planchas",
    subcategoria: "2440x1220mm",
    unidad_medida: "Placa",
    precio_unitario: 12000,
    costo_unitario: 8500,
    stock_actual: 3,
    stock_minimo: 10,
    foto_url: "",
    activo: true,
  },
  {
    id: 2,
    nombre: "Plywood 15mm",
    categoria: "Planchas",
    subcategoria: "2440x1220mm",
    unidad_medida: "Placa",
    precio_unitario: 9800,
    costo_unitario: 7000,
    stock_actual: 22,
    stock_minimo: 10,
    foto_url: "",
    activo: true,
  },
];

export default function Inventario({
  onDataChange,
}) {
  const temporizadorRef = useRef(null);

  const [dialog, setDialog] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [
    productoEliminado,
    setProductoEliminado,
  ] = useState(null);

  const [productos, setProductos] =
    useState(() => {
      const guardados =
        localStorage.getItem(
          "inventario"
        );

      if (guardados) {
        return JSON.parse(guardados);
      }

      localStorage.setItem(
        "inventario",
        JSON.stringify(
          productosIniciales
        )
      );

      return productosIniciales;
    });

  const guardarProductos = (
    nuevaLista
  ) => {
    setProductos(nuevaLista);

    localStorage.setItem(
      "inventario",
      JSON.stringify(nuevaLista)
    );

    onDataChange?.();
  };

  const deleteProduct = (
    producto
  ) => {
    if (
      temporizadorRef.current
    ) {
      window.clearTimeout(
        temporizadorRef.current
      );
    }

    const posicionOriginal =
      productos.findIndex(
        (item) =>
          String(item.id) ===
          String(producto.id)
      );

    guardarProductos(
      productos.filter(
        (item) =>
          String(item.id) !==
          String(producto.id)
      )
    );

    setProductoEliminado({
      producto,
      posicionOriginal,
    });

    temporizadorRef.current =
      window.setTimeout(() => {
        setProductoEliminado(null);
        temporizadorRef.current =
          null;
      }, 5000);
  };

  const deshacerEliminacion =
    () => {
      if (!productoEliminado) {
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
        ...productos,
      ];

      const posicion = Math.max(
        0,
        Math.min(
          productoEliminado
            .posicionOriginal,
          restaurados.length
        )
      );

      restaurados.splice(
        posicion,
        0,
        productoEliminado.producto
      );

      guardarProductos(
        restaurados
      );

      setProductoEliminado(null);
    };

  const handleSaved = () => {
    const guardados =
      localStorage.getItem(
        "inventario"
      );

    if (guardados) {
      setProductos(
        JSON.parse(guardados)
      );
    }

    setDialog(null);
    onDataChange?.();
  };

  const filtered = useMemo(
    () => {
      const texto = search
        .trim()
        .toLowerCase();

      return productos.filter(
        (producto) =>
          [
            producto.nombre,
            producto.categoria,
            producto.subcategoria,
            producto.unidad_medida,
          ].some((campo) =>
            String(campo || "")
              .toLowerCase()
              .includes(texto)
          )
      );
    },
    [productos, search]
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Inventario
          </h1>

          <p className="text-muted-foreground">
            {productos.length} producto
            {productos.length === 1
              ? ""
              : "s"}{" "}
            registrado
            {productos.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        <Button
          onClick={() =>
            setDialog({
              product: null,
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {productoEliminado && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-red-400">
            <Trash2 className="w-5 h-5 shrink-0" />

            <span>
              {
                productoEliminado
                  .producto.nombre
              }{" "}
              eliminado
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

      <Card className="p-4 bg-card border-border mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Buscar por nombre, categoría o medida..."
            className="pl-10 h-11"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>
      </Card>

      <Card className="overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-4 text-left">
                  Producto
                </th>

                <th className="p-4 text-left">
                  Categoría
                </th>

                <th className="p-4 text-right">
                  Precio
                </th>

                <th className="p-4 text-right">
                  Costo
                </th>

                <th className="p-4 text-right">
                  Stock
                </th>

                <th className="p-4 text-center">
                  Estado
                </th>

                <th className="p-4 text-center">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filtered.length > 0 ? (
                filtered.map(
                  (producto) => {
                    const stockActual =
                      Number(
                        producto.stock_actual ||
                          0
                      );

                    const stockMinimo =
                      Number(
                        producto.stock_minimo ||
                          0
                      );

                    const sinStock =
                      stockActual <= 0;

                    const isCritical =
                      !sinStock &&
                      stockActual <=
                        stockMinimo;

                    return (
                      <tr
                        key={producto.id}
                        className="hover:bg-muted/30 transition"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3 min-w-[230px]">
                            <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-secondary shrink-0">
                              {producto.foto_url ? (
                                <img
                                  src={
                                    producto.foto_url
                                  }
                                  alt={
                                    producto.nombre
                                  }
                                  className="w-full h-full object-cover"
                                  onError={(
                                    event
                                  ) => {
                                    event.currentTarget.style.display =
                                      "none";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {
                                  producto.nombre
                                }
                              </p>

                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {producto.subcategoria ||
                                  producto.unidad_medida ||
                                  "Sin medida"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-muted-foreground">
                          {
                            producto.categoria
                          }
                        </td>

                        <td className="p-4 text-right font-medium">
                          {fmtMoney(
                            producto.precio_unitario
                          )}
                        </td>

                        <td className="p-4 text-right text-muted-foreground">
                          {fmtMoney(
                            producto.costo_unitario
                          )}
                        </td>

                        <td
                          className={`p-4 text-right font-medium ${
                            sinStock ||
                            isCritical
                              ? "text-red-500 font-bold"
                              : ""
                          }`}
                        >
                          {stockActual}{" "}
                          <span className="text-xs text-muted-foreground">
                            / mín{" "}
                            {stockMinimo}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              sinStock
                                ? "bg-red-500/15 text-red-400"
                                : isCritical
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-emerald-500/15 text-emerald-400"
                            }`}
                          >
                            {sinStock
                              ? "Agotado"
                              : isCritical
                              ? "Stock crítico"
                              : "Disponible"}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar producto"
                              onClick={() =>
                                setDialog({
                                  product:
                                    producto,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar producto"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() =>
                                deleteProduct(
                                  producto
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="p-16 text-center text-muted-foreground"
                  >
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />

                    <p className="font-medium">
                      No se encontraron productos
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {dialog && (
        <ProductFormDialog
          product={dialog.product}
          onClose={() =>
            setDialog(null)
          }
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
