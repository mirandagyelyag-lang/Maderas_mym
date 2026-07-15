import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Vender from "./pages/Vender";
import Ventas from "./pages/Ventas";
import Gastos from "./pages/Gastos";
import Clientes from "./pages/Clientes";
import Cotizaciones from "./pages/Cotizaciones";
import CotizacionDetalle from "./pages/CotizacionDetalle";
import Configuracion from "./pages/Configuracion";

export default function App() {
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);

  const actualizarProductos = () => {
    try {
      const guardados = JSON.parse(
        localStorage.getItem("inventario") || "[]"
      );
      setProductos(guardados);
    } catch (error) {
      console.error("Error al cargar inventario:", error);
      setProductos([]);
    }
  };

  const actualizarVentas = () => {
    try {
      const guardadas = JSON.parse(
        localStorage.getItem("ventas") || "[]"
      );
      setVentas(guardadas);
    } catch (error) {
      console.error("Error al cargar ventas:", error);
      setVentas([]);
    }
  };

  const actualizarGastos = () => {
    try {
      const guardados = JSON.parse(
        localStorage.getItem("gastos") || "[]"
      );
      setGastos(guardados);
    } catch (error) {
      console.error("Error al cargar gastos:", error);
      setGastos([]);
    }
  };

  const actualizarCotizaciones = () => {
    try {
      const guardadas = JSON.parse(
        localStorage.getItem("cotizaciones") || "[]"
      );
      setCotizaciones(guardadas);
    } catch (error) {
      console.error("Error al cargar cotizaciones:", error);
      setCotizaciones([]);
    }
  };

  const actualizarTodo = () => {
    actualizarProductos();
    actualizarVentas();
    actualizarGastos();
    actualizarCotizaciones();
  };

  useEffect(() => {
    actualizarTodo();

    const manejarStorage = () => actualizarTodo();

    window.addEventListener("storage", manejarStorage);

    return () =>
      window.removeEventListener("storage", manejarStorage);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={<Navigate to="/dashboard" replace />}
          />

          <Route
            path="/dashboard"
            element={
              <Dashboard
                productos={productos}
                ventas={ventas}
                gastos={gastos}
                cotizaciones={cotizaciones}
              />
            }
          />

          <Route
            path="/inventario"
            element={
              <Inventario
                onDataChange={actualizarProductos}
              />
            }
          />

          <Route
            path="/vender"
            element={
              <Vender
                productos={productos}
                actualizarProductos={actualizarProductos}
                actualizarVentas={actualizarVentas}
              />
            }
          />

          <Route
            path="/ventas"
            element={
              <Ventas
                ventas={ventas}
                actualizarVentas={actualizarVentas}
                actualizarProductos={actualizarProductos}
              />
            }
          />

          <Route
            path="/gastos"
            element={<Gastos />}
          />

          <Route
            path="/clientes"
            element={<Clientes />}
          />

          <Route
            path="/cotizaciones"
            element={<Cotizaciones />}
          />

          <Route
            path="/cotizaciones/:id"
            element={
              <CotizacionDetalle
                actualizarProductos={actualizarProductos}
                actualizarVentas={actualizarVentas}
                actualizarCotizaciones={actualizarCotizaciones}
              />
            }
          />

          <Route
            path="/configuracion"
            element={<Configuracion />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
