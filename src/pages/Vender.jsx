import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Package,
  Search,
  ShoppingCart,
  Boxes,
  ScanLine,
  Keyboard,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProductCard from "@/components/ProductCard";
import SaleModal from "@/components/SaleModal";
import BarcodeScannerDialog from "@/components/BarcodeScannerDialog";

const categorias = [
  "Todos",
  "Madera Bruta",
  "Madera Impregnada",
  "Planchas",
  "Accesorios",
];

const normalizarCodigo = (valor) =>
  String(valor || "")
    .trim()
    .replace(/\s+/g, "");

export default function Vender({
  productos = [],
  actualizarProductos,
  actualizarVentas,
}) {
  const lectorBufferRef = useRef("");
  const lectorTiempoRef = useRef(0);
  const mensajeTimeoutRef = useRef(null);
  const ultimoCodigoRef = useRef({ codigo: "", fecha: 0 });

  const [categoria, setCategoria] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [scannerAbierto, setScannerAbierto] = useState(false);
  const [mensajeCodigo, setMensajeCodigo] = useState("");

  const productosActivos = useMemo(
    () => productos.filter((producto) => producto.activo !== false),
    [productos]
  );

  const mostrarMensajeCodigo = (mensaje) => {
    if (mensajeTimeoutRef.current) {
      window.clearTimeout(mensajeTimeoutRef.current);
    }

    setMensajeCodigo(mensaje);

    mensajeTimeoutRef.current = window.setTimeout(() => {
      setMensajeCodigo("");
      mensajeTimeoutRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (mensajeTimeoutRef.current) {
        window.clearTimeout(mensajeTimeoutRef.current);
      }
    };
  }, []);

  const buscarPorCodigo = (codigoLeido) => {
    const codigo = normalizarCodigo(codigoLeido);
    if (!codigo) return false;

    const ahora = Date.now();

    if (
      ultimoCodigoRef.current.codigo === codigo &&
      ahora - ultimoCodigoRef.current.fecha < 1800
    ) {
      return false;
    }

    ultimoCodigoRef.current = { codigo, fecha: ahora };

    const producto = productosActivos.find(
      (item) => normalizarCodigo(item.codigo_barras) === codigo
    );

    if (!producto) {
      setSearch(codigo);
      mostrarMensajeCodigo(
        `No existe un producto registrado con el código ${codigo}.`
      );
      return false;
    }

    if (Number(producto.stock_actual || 0) <= 0) {
      mostrarMensajeCodigo(`${producto.nombre} está sin stock.`);
      return false;
    }

    setSearch("");
    setCategoria("Todos");
    setMensajeCodigo("");
    setSelected(producto);
    return true;
  };

  useEffect(() => {
    const manejarLectorUSB = (event) => {
      const objetivo = event.target;

      const escribiendoEnCampo =
        objetivo instanceof HTMLInputElement ||
        objetivo instanceof HTMLTextAreaElement ||
        objetivo instanceof HTMLSelectElement ||
        objetivo?.isContentEditable;

      if (escribiendoEnCampo || scannerAbierto || selected) return;

      const ahora = Date.now();

      if (ahora - lectorTiempoRef.current > 90) {
        lectorBufferRef.current = "";
      }

      lectorTiempoRef.current = ahora;

      if (event.key === "Enter") {
        const codigo = lectorBufferRef.current;
        lectorBufferRef.current = "";

        if (codigo.length >= 4) buscarPorCodigo(codigo);
        return;
      }

      if (event.key.length === 1) {
        lectorBufferRef.current += event.key;
      }
    };

    window.addEventListener("keydown", manejarLectorUSB);
    return () => window.removeEventListener("keydown", manejarLectorUSB);
  }, [productosActivos, scannerAbierto, selected]);

  const productosFiltrados = useMemo(
    () =>
      productosActivos.filter((producto) => {
        const coincideCategoria =
          categoria === "Todos" || producto.categoria === categoria;

        const texto = search.trim().toLowerCase();

        const campos = [
          producto.nombre,
          producto.subcategoria,
          producto.categoria,
          producto.unidad_medida,
          producto.codigo_barras,
        ].map((campo) => String(campo || "").toLowerCase());

        const coincideBusqueda =
          texto === "" || campos.some((campo) => campo.includes(texto));

        return coincideCategoria && coincideBusqueda;
      }),
    [productosActivos, categoria, search]
  );

  const productosConStock = productosActivos.filter(
    (producto) => Number(producto.stock_actual || 0) > 0
  ).length;

  const productosAgotados = productosActivos.length - productosConStock;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>

          <div>
            <h1 className="text-3xl font-bold">Vender</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Selecciona o escanea un producto
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMensajeCodigo("");
              setScannerAbierto(true);
            }}
            className="h-auto px-4 py-3"
          >
            <ScanLine className="w-4 h-4 mr-2" />
            Escanear código
          </Button>

          <Card className="px-4 py-3 bg-card border-border">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[11px] text-muted-foreground">Disponibles</p>
                <p className="font-semibold text-sm">{productosConStock}</p>
              </div>
            </div>
          </Card>

          <Card className="px-4 py-3 bg-card border-border">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-destructive" />
              <div>
                <p className="text-[11px] text-muted-foreground">Agotados</p>
                <p className="font-semibold text-sm">{productosAgotados}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4 md:p-5 bg-card border-border mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              className="pl-10 pr-10 h-11"
              placeholder="Buscar por nombre, categoría, medida o código..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") buscarPorCodigo(search);
              }}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <Keyboard className="w-4 h-4 text-primary" />
            <span>Lector USB listo</span>
          </div>
        </div>

        {mensajeCodigo && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {mensajeCodigo}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
          {categorias.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoria(cat)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                categoria === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {productosFiltrados.length} producto
          {productosFiltrados.length === 1 ? "" : "s"}
        </p>

        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-xs text-primary hover:underline"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>

      {productosFiltrados.length === 0 ? (
        <Card className="flex flex-col items-center py-16 bg-card border-border text-muted-foreground">
          <Package className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium">No hay productos disponibles</p>
          <p className="text-xs mt-1">
            Prueba otra búsqueda, categoría o código
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {productosFiltrados.map((producto) => (
            <ProductCard
              key={producto.id}
              product={producto}
              onClick={() => setSelected(producto)}
            />
          ))}
        </div>
      )}

      {selected && (
        <SaleModal
          product={selected}
          actualizarProductos={actualizarProductos}
          actualizarVentas={actualizarVentas}
          onClose={() => setSelected(null)}
        />
      )}

      {scannerAbierto && (
        <BarcodeScannerDialog
          onClose={() => setScannerAbierto(false)}
          onDetected={(codigo) => {
            setScannerAbierto(false);
            window.setTimeout(() => buscarPorCodigo(codigo), 50);
          }}
        />
      )}
    </div>
  );
}