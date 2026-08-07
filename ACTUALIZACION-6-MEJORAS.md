# Actualización integral · Maderas M&M

## Instalación

1. Reemplaza el código del proyecto por esta versión conservando tu `.env` local.
2. En Supabase > SQL Editor ejecuta `supabase/cubicaciones.sql` y después `supabase/reiniciar_datos_demostracion.sql` completos.
3. Publica nuevamente la función de IA:

```bash
supabase functions deploy cubicar-madera
```

4. Inicia el proyecto:

```bash
npm install
npm run dev
```

## Cambios incluidos

- Historial de cubicaciones sincronizado con Supabase y respaldo offline.
- Validación de medidas, cantidades enteras y factor de apilado.
- Fórmula visible antes de confirmar el resultado.
- Repetición rápida para trabajar por lotes y exportación CSV.
- Envío del resultado a inventario con formulario precargado; accesos a cotizaciones y compras.
- Cubicaciones del día y acceso rápido desde el dashboard.
- Respaldo versión 2: incluye compras, proveedores, caja, cubicaciones y bitácora.
- Eliminación de contraseñas guardadas en `localStorage`.
- Eliminación de códigos de barras de tarjetas, ventas, búsquedas y normalización.
- Validación real de usuario activo antes de permitir llamadas a la IA.
- Carga diferida de pantallas para reducir considerablemente el JavaScript inicial.
- Botón administrativo para borrar todos los datos de demostración, con respaldo automático y confirmación escrita; conserva usuarios y configuración.
- Identidad PWA completa: favicon M&M, iconos de instalación, título correcto, manifest en español y aviso “Instalar aplicación”.
- Favicon e icono instalable rediseñados como monograma M&M dorado elegante sobre fondo grafito.

## Instalar como aplicación

La web debe estar publicada con HTTPS (por ejemplo, en Vercel). En Chrome o Edge aparecerá dentro de la app el aviso **Instalar Maderas M&M**. En Android también puede instalarse desde el menú del navegador. En iPhone se instala desde Safari > Compartir > Añadir a pantalla de inicio.

El proyecto incluye `vercel.json` para que las rutas internas de React funcionen al abrirlas o recargarlas directamente.

## Importante

La función de IA requiere `OPENAI_API_KEY` en los secretos de Supabase. Las fotografías siguen siendo una ayuda estimativa: el usuario debe revisar y confirmar todas las medidas.

Los recibos internos no reemplazan documentos tributarios del SII. La aplicación registra los datos de boletas o facturas emitidas externamente hasta que se conecte un proveedor DTE autorizado.
