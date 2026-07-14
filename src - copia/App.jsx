import { BrowserRouter, Routes, Route } from "react-router-dom";
// ... tus otras importaciones ...
import Cotizaciones from "./components/Cotizaciones"; 
import CotizacionDetalle from "./components/CotizacionDetalle"; // <--- ASEGÚRATE DE ESTA IMPORTACIÓN

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/cotizaciones" element={<Cotizaciones />} />
        
        {/* ESTA ES LA LÍNEA MÁGICA QUE FALTA */}
        <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
        
        {/* ... tus otras rutas ... */}
      </Routes>
    </BrowserRouter>
  );
}