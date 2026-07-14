import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // 1. IMPORTA ESTO
import ScrollToTop from './components/ScrollToTop';
import { Toaster } from "sonner";
import Layout from './components/Layout';
// ... (tus otros imports)

const queryClient = new QueryClient(); // 2. CREA EL CLIENTE

export default function App() {
  // ... (tu código de pin y autorizado sigue igual)

  return (
    <QueryClientProvider client={queryClient}> {/* 3. ENVUELVE AQUÍ */}
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}