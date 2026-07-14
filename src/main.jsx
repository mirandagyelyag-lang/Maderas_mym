import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './lib/AuthContext'; // Importa el provider
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider> {/* ENVOLVEMOS LA APP AQUÍ */}
      <App />
    </AuthProvider>
  </React.StrictMode>
);