# Actualización urgente del Cubicador · Maderas M&M

Este paquete reemplaza únicamente dos archivos del proyecto y conserva el resto del ERP.

## Archivos incluidos

- `src/pages/Cubicador.jsx`
- `supabase/functions/cubicar-madera/index.ts`

## Qué corrige

- Cámara en vivo dentro del cubicador usando el lente trasero, más un botón separado para la galería.
- Solicitud y diagnóstico explícito de permisos de cámara (bloqueado, sin dispositivo o cámara ocupada).
- Selector nativo del teléfono como respaldo si el navegador no permite la cámara integrada.
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
2. Prueba primero `Rollizos` → `Un rollizo o pocos` → `Tomar fotografía` y acepta el permiso de cámara.
3. Comprueba que la marca roja detectada coincide con la fotografía.
4. Prueba `Pila completa` con cuatro zonas no superpuestas.
5. Corrige manualmente cualquier lectura dudosa y confirma las medidas antes de guardar.

La lectura de imágenes es una ayuda de transcripción. La app no debe guardar ni usar comercialmente un resultado que una persona no haya revisado.

La cámara integrada necesita que la app esté publicada bajo HTTPS. La dirección de Vercel cumple esta condición. Si Android o iOS había bloqueado el permiso anteriormente, hay que habilitar Cámara en los permisos del sitio o de la PWA.
