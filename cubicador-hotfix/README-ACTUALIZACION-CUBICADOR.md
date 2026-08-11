# Actualización urgente del Cubicador · Maderas M&M

Este paquete reemplaza únicamente dos archivos del proyecto y conserva el resto del ERP.

## Archivos incluidos

- `src/pages/Cubicador.jsx`
- `supabase/functions/cubicar-madera/index.ts`

## Qué corrige

- Botones separados para abrir la cámara trasera o elegir imágenes de la galería.
- Vista previa y recorte antes de aceptar cada fotografía.
- Un único análisis controlado por acción, sin dos o tres solicitudes paralelas.
- Tiempo máximo de espera; la pantalla deja de quedar cargando indefinidamente.
- Mensaje real de la Edge Function, incluyendo el código HTTP, en vez del texto genérico `non-2xx`.
- Modelos de respaldo sin pausas largas.
- Eliminación del consenso que mezclaba diámetros distintos y podía inventar cantidades.
- Validación y agrupación de diámetros antes de llenar la tabla JAS.
- Revisión humana obligatoria antes de guardar una cubicación.

## Instalación en Git Bash

1. Descomprime este ZIP dentro de una carpeta temporal.
2. Copia los dos archivos incluidos sobre los archivos del mismo nombre en `~/Desktop/finanzas papá`.
3. Desde Git Bash ejecuta:

```bash
cd ~/Desktop/"finanzas papá"
npx supabase functions deploy cubicar-madera --project-ref vvvxocbvjvsidtikqryo
npm run build
git add src/pages/Cubicador.jsx supabase/functions/cubicar-madera/index.ts
git commit -m "Repair cubicador photo and AI flow"
git push origin main
```

Si Vercel está conectado a la rama `main`, el `git push` publica automáticamente la nueva versión web/PWA.

## Prueba mínima antes de usarlo en una operación real

1. Inicia sesión nuevamente si la app muestra sesión expirada.
2. Prueba primero `Rollizos` → `Un rollizo o pocos` con una foto cercana.
3. Comprueba que la marca roja detectada coincide con la fotografía.
4. Prueba `Pila completa` con cuatro zonas no superpuestas.
5. Corrige manualmente cualquier lectura dudosa y confirma las medidas antes de guardar.

La lectura de imágenes es una ayuda de transcripción. La app no debe guardar ni usar comercialmente un resultado que una persona no haya revisado.
