# Maderas M&M · V11

Versión limpia del ERP/PWA con foco en uso diario desde Android y en el Cubicador IA.

## Cambios principales

- Proyecto depurado: sin builds viejos, parches históricos, Velvet Stories, `.vercel` ni archivos `.env`.
- Navegación móvil inferior para Inicio, Cubicador, Venta e Inventario, con menú completo desde “Más”.
- Estado de conexión visible en móvil y espacios seguros para la barra inferior/PWA.
- Componentes base (tarjetas, botones e inputs) unificados y más cómodos para tacto.
- Sidebar de escritorio más compacto.
- Cubicador V11: foto → IA directa, conservación de detalle, control de calidad local y reintento sin perder fotos.
- Rollizos: dos lecturas independientes cuando están disponibles y comparación automática de cantidades por diámetro.
- Si las dos lecturas no coinciden, la interfaz lo avisa y baja la confianza para obligar a revisar las filas dudosas.
- Regla JAS verificada con el caso de 12 rollizos = 3,720 m³.

## Variables locales

Crea `.env` en tu equipo (no se incluye en este paquete):

```env
VITE_SUPABASE_URL=TU_URL_DE_SUPABASE
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

La clave `GEMINI_API_KEY` debe permanecer como secret de Supabase Edge Functions, nunca en Vite ni en el navegador.

## Verificación

```bash
npm run cleanup:v11
npm ci
npm run verify
npm run build
```

`cleanup:v11` borra únicamente copias/parches antiguos conocidos. No elimina `.env`, `.env.local` ni `.git`.

## Publicar la Edge Function

```bash
npx supabase functions deploy cubicar-madera
```

Después publica el frontend normalmente desde tu repositorio/Vercel.
