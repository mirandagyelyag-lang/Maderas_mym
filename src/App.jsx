import React, {
  useEffect,
  useState,
} from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

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
import Compras from "./pages/Compras";
import Proveedores from "./pages/Proveedores";

export default function App() {
  const [productos, setProductos] =
    useState([]);

  const [ventas, setVentas] =
    useState([]);

  const [gastos, setGastos] =
    useState([]);

  const [
    cotizaciones,
    setCotizaciones,
  ] = useState([]);

  const actualizarProductos = () => {
    setProductos(
      JSON.parse(
        localStorage.getItem(
          "inventario"
        ) || "[]"
      )
    );
  };

  const actualizarVentas = () => {
    setVentas(
      JSON.parse(
        localStorage.getItem(
          "ventas"
        ) || "[]"
      )
    );
  };

  const actualizarGastos = () => {
    setGastos(
      JSON.parse(
        localStorage.getItem(
          "gastos"
        ) || "[]"
      )
    );
  };

  const actualizarCotizaciones =
    () => {
      setCotizaciones(
        JSON.parse(
          localStorage.getItem(
            "cotizaciones"
          ) || "[]"
        )
      );
    };

  const actualizarTodo = () => {
    actualizarProductos();
    actualizarVentas();
    actualizarGastos();
    actualizarCotizaciones();
  };

  useEffect(() => {
    actualizarTodo();

    const manejarStorage = () =>
      actualizarTodo();

    window.addEventListener(
      "storage",
      manejarStorage
    );

    return () =>
      window.removeEventListener(
        "storage",
        manejarStorage
      );
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/dashboard"
            element={
              <Dashboard
                productos={productos}
                ventas={ventas}
                gastos={gastos}
                cotizaciones={
                  cotizaciones
                }
              />
            }
          />

          <Route
            path="/inventario"
            element={
              <Inventario
                onDataChange={
                  actualizarProductos
                }
              />
            }
          />

          <Route
            path="/vender"
            element={
              <Vender
                productos={productos}
                actualizarProductos={
                  actualizarProductos
                }
                actualizarVentas={
                  actualizarVentas
                }
              />
            }
          />

          <Route
            path="/ventas"
            element={
              <Ventas
                ventas={ventas}
                actualizarVentas={
                  actualizarVentas
                }
                actualizarProductos={
                  actualizarProductos
                }
              />
            }
          />

          <Route
            path="/compras"
            element={
              <Compras
                productos={productos}
                actualizarProductos={
                  actualizarProductos
                }
              />
            }
          />

          <Route
            path="/proveedores"
            element={<Proveedores />}
          />

          <Route
            path="/gastos"
            element={
              <Gastos
                actualizarGastos={
                  actualizarGastos
                }
              />
            }
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
                actualizarProductos={
                  actualizarProductos
                }
                actualizarVentas={
                  actualizarVentas
                }
                actualizarCotizaciones={
                  actualizarCotizaciones
                }
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
