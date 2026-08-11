# Publicar la lectura de fotografías del cubicador

El cálculo JAS funciona localmente. Para que el botón **Leer números** analice fotografías también hay que publicar la Edge Function `cubicar-madera`.

## Git Bash

Abre Git Bash dentro de la carpeta del proyecto y ejecuta:

```bash
npm ci
npm run verify:cubicador
npx supabase login
npx supabase secrets set GEMINI_API_KEY=TU_CLAVE_DE_GEMINI --project-ref vvvxocbvjvsidtikqryo
npx supabase functions deploy cubicar-madera --project-ref vvvxocbvjvsidtikqryo
```

La clave queda en Supabase. No debe guardarse en `.env`, no debe comenzar con `VITE_` y nunca debe subirse a Git.

Opcionalmente se puede fijar otro modelo con un secreto `GEMINI_VISION_MODEL`. Sin ese secreto la función usa primero `gemini-3.5-flash` y recurre a `gemini-3.5-flash-lite` solamente si el primero falla.

## Qué garantiza esta versión

- Hace una lectura por solicitud; ya no ejecuta tres análisis consecutivos.
- Cada modelo tiene tiempo máximo. Un modelo de respaldo solo se usa ante una falla temporal.
- Los errores de sesión, tamaño, cuota, proveedor y espera usan códigos HTTP distintos y mensajes legibles.
- Para rollizos, la IA transcribe pintura roja y no calcula el volumen.
- La lectura siempre queda marcada como no validada hasta que una persona compare los números con la fotografía.
- El volumen final usa exclusivamente el motor JAS probado del proyecto.

La visión automática puede leer mal una pintura borrosa. Por eso no se guarda ni se envía a inventario un resultado de IA sin confirmación humana.

