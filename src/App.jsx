import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { useState, useEffect } from "react";

import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Ventas from "./pages/Ventas";
import Gastos from "./pages/Gastos";
import Clientes from "./pages/Clientes";
import Cotizaciones from "./pages/Cotizaciones";
import CotizacionDetalle from "./pages/CotizacionDetalle";

export default function App() {
  // 1. Estados para centralizar la información y que sea reactiva
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);

  // 2. Cargar los datos desde localStorage al iniciar la App
  useEffect(() => {
    const cargarDatos = () => {
      const prodGuardados = localStorage.getItem("inventario");
      const venGuardadas = localStorage.getItem("ventas"); // Por si usas esta clave
      const gasGuardados = localStorage.getItem("gastos"); // Por si usas esta clave

      if (prodGuardados) setProductos(JSON.parse(prodGuardados));
      if (venGuardadas) setVentas(JSON.parse(venGuardadas));
      if (gasGuardados) setGastos(JSON.parse(gasGuardados));
    };

    cargarDatos();

    // Escuchar cambios en el localStorage por si se modifica desde otra pestaña/componente
    window.addEventListener("storage", cargarDatos);
    return () => window.removeEventListener("storage", cargarDatos);
  }, []);

  // 3. Función para sincronizar los productos cuando cambien en la sección Inventario
  const actualizarProductos = () => {
  const prodGuardados = localStorage.getItem("inventario");
  setProductos(prodGuardados ? JSON.parse(prodGuardados) : []);
};
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard recibe los estados actualizados */}
          <Route 
            path="/dashboard" 
            element={
              <Dashboard 
                productos={productos}
                ventas={ventas}
                gastos={gastos}
              />
            }
          />

          {/* Inventario recibe una función para avisar cuando guardes o elimines algo */}
          <Route 
            path="/inventario" 
            element={<Inventario onDataChange={actualizarProductos} />} 
          />
          
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cotizaciones" element={<Cotizaciones />} />
          <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}