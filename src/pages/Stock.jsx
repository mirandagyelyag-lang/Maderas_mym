import React, { useState, useEffect } from "react";
import { Search, Plus, Package, X, Trash2 } from "lucide-react";

export default function Stock() {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // 💾 Cargamos desde el disco del navegador (compartido con Vender)
  const [productos, setProductos] = useState(() => {
    const guardados = localStorage.getItem("productos_barraca");
    if (guardados) {
      return JSON.parse(guardados);
    }
    return [
      { id: 1, nombre: "Pino Impregnado 2x3x3.2mt", categoria: "Madera Impregnada", stock: 140, precio: 4500 },
      { id: 2, nombre: "Madera Bruta Pino 1x4", categoria: "Madera Bruta", stock: 85, precio: 2800 },
      { id: 3, nombre: "Plancha OSB 9.5mm", categoria: "Planchas", stock: 50, precio: 12500 },
      { id: 4, nombre: "Tornillo Madera 1 1/2 (Caja)", categoria: "Accesorios", stock: 20, precio: 6900 },
    ];
  });

  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "",
    categoria: "Madera Bruta",
    stock: "",
    precio: ""
  });

  useEffect(() => {
    localStorage.setItem("productos_barraca", JSON.stringify(productos));
  }, [productos]);

  const handleGuardar = (e) => {
    e.preventDefault();
    if (!nuevoProducto.nombre || !nuevoProducto.stock || !nuevoProducto.precio) {
      alert("Por favor, llena todos los campos ⚠️");
      return;
    }

    const productoCreado = {
      id: Date.now(),
      nombre: nuevoProducto.nombre,
      categoria: nuevoProducto.categoria,
      stock: parseInt(nuevoProducto.stock),
      precio: parseInt(nuevoProducto.precio)
    };

    setProductos([...productos, productoCreado]);
    setMostrarModal(false);
    setNuevoProducto({ nombre: "", categoria: "Madera Bruta", stock: "", precio: "" });
  };

  const handleEliminar = (id) => {
    if (confirm("¿Estás segura de que quieres eliminar este producto? 😲")) {
      setProductos(productos.filter(prod => prod.id !== id));
    }
  };

  const productosFiltrados = productos.filter(prod =>
    prod.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-6 bg-zinc-950 text-white min-h-screen relative">
      {/* CABECERA */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Stock disponible</h1>
          <p className="text-zinc-400 text-sm mt-1">Inventario actual de la barraca</p>
        </div>
        
        <button 
          onClick={() => setMostrarModal(true)} 
          className="bg-amber-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-amber-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar Producto
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
        />
      </div>

      {/* TABLA DE STOCK REAL */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 text-sm">
              <th className="p-4 font-medium">Producto</th>
              <th className="p-4 font-medium">Categoría</th>
              <th className="p-4 font-medium">Stock</th>
              <th className="p-4 font-medium">Precio</th>
              <th className="p-4 font-medium text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.length > 0 ? (
              productosFiltrados.map((prod) => (
                <tr key={prod.id} className="border-b border-zinc-800 last:border-none hover:bg-zinc-800/30 transition-colors">
                  <td className="p-4 font-medium flex items-center gap-3">
                    <Package className="w-4 h-4 text-amber-500" />
                    {prod.nombre}
                  </td>
                  <td className="p-4 text-zinc-400 text-sm">{prod.categoria}</td>
                  <td className="p-4 font-mono">
                    <span className={`px-2 py-1 rounded text-xs ${prod.stock > 20 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {prod.stock} unids
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-zinc-200">${prod.precio.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleEliminar(prod.id)}
                      className="text-zinc-500 hover:text-red-400 p-2 rounded transition-colors inline-flex items-center justify-center"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center p-8 text-zinc-500 text-sm">
                  No se encontraron productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* VENTANA EMERGENTE PARA AGREGAR */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setMostrarModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold mb-4 text-white">Añadir nuevo producto</h2>
            
            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Nombre del Producto</label>
                <input 
                  type="text" 
                  placeholder="Ej: Pino Bruto 2x4"
                  value={nuevoProducto.nombre}
                  onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Categoría</label>
                <select 
                  value={nuevoProducto.categoria}
                  onChange={(e) => setNuevoProducto({...nuevoProducto, categoria: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 text-sm"
                >
                  <option value="Madera Bruta">Madera Bruta</option>
                  <option value="Madera Impregnada">Madera Impregnada</option>
                  <option value="Planchas">Planchas</option>
                  <option value="Accesorios">Accesorios</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Cantidad (Stock)</label>
                  <input 
                    type="number" 
                    value={nuevoProducto.stock}
                    onChange={(e) => setNuevoProducto({...nuevoProducto, stock: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">Precio ($)</label>
                  <input 
                    type="number" 
                    value={nuevoProducto.precio}
                    onChange={(e) => setNuevoProducto({...nuevoProducto, precio: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl mt-2 transition-colors text-sm">
                Guardar Producto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}