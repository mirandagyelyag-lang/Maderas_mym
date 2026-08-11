# Maderas M&M — cubicador corregido

Esta es la carpeta activa completa. No copies archivos desde las antiguas carpetas `cubicador-*`: esos parches separados fueron la razón por la que la web seguía compilando el cubicador viejo.

## 1. Conserva la configuración privada

El paquete corregido no incluye contraseñas. Copia tus archivos `.env` y `.env.local` desde la carpeta anterior a esta carpeta, sin enviarlos a nadie ni subirlos a Git.

## 2. Prueba en Git Bash

Entra a esta carpeta y ejecuta:

```bash
npm ci
npm run verify:cubicador
npm run build
```

La verificación correcta termina con:

```text
Cubicador verificado: cámara Android nativa · un análisis · PWA actualizable · 12 rollizos = 3,720 m³.
```

## 3. Publica las dos partes

Primero publica la función de fotografías:

```bash
npx supabase login
npx supabase functions deploy cubicar-madera --project-ref vvvxocbvjvsidtikqryo
```

Si aún no existe el secreto de Gemini:

```bash
npx supabase secrets set GEMINI_API_KEY=TU_CLAVE_DE_GEMINI --project-ref vvvxocbvjvsidtikqryo
```

Luego publica la web en el proyecto Vercel de la empresa:

```bash
npx vercel --prod
```

Si Vercel pregunta si deseas enlazar el proyecto, responde que sí y elige el proyecto existente de Maderas M&M. No crees otro proyecto si la web actual ya está conectada a uno.

## 4. Comprueba el Android

1. Abre la web publicada con Chrome.
2. Entra a **Cubicador IA → Rollizos → Fotografías**.
3. Debajo de los botones debe decir **“Cámara Android activa · versión 4”**.
4. Toca **Abrir cámara**: debe abrir directamente la cámara trasera.
5. Si no aparece “versión 4”, cierra por completo la app instalada y vuelve a abrirla. Como último recurso, elimina la app instalada y agrégala nuevamente desde Chrome.

## Resultado real y revisable

La cámara entrega la foto; Gemini propone una transcripción editable; una persona confirma los diámetros y cantidades; recién entonces el motor JAS calcula. La prueba incluida reproduce el caso físico de la empresa:

- largo 3,3 m;
- Ø26 × 4;
- Ø28 × 5;
- Ø38 × 2;
- Ø46 × 1;
- total: 12 rollizos y 3,720 m³.

