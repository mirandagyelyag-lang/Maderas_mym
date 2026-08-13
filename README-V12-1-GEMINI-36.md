# M&M Maderas · Cubicador V12.1 · Gemini 3.6

Este parche se instala encima de V11 o V12.

## Qué cambia

- Modelo principal por defecto: `gemini-3.6-flash`.
- Una sola llamada normal hace **validación semántica + lectura de números**.
- La foto se rechaza si no cumple simultáneamente: extremos cortados visibles, números pintados sobre esos extremos y ausencia de una vista lateral dominante.
- Un poste/tronco vertical visto principalmente de lado se rechaza aunque la foto esté nítida.
- `thinkingLevel: minimal`, `temperature: 0` y salida JSON estructurada.
- Resolución visual alta por fotografía para conservar números pequeños.
- Segunda comprobación solo si la lectura tiene confianza < 78, marcas no legibles o una fila < 75.
- La segunda comprobación también usa Gemini 3.6 de forma independiente.
- 1 foto: timeout de IA principal 14 s. 4 fotos: 18 s.
- Timeout del cliente para rollizos: 34 s como corte de seguridad, no como tiempo esperado.
- El antiguo `GEMINI_VISION_MODEL` no controla el cubicador, para evitar que una variable vieja lo deje atado a Gemini 3.5.
- No necesitas crear ninguna variable nueva. Opcionalmente puedes usar `GEMINI_CUBICADOR_MODEL` y `GEMINI_CUBICADOR_VERIFY_MODEL`.

## Instalar desde Git Bash

```bash
cd ~/Desktop/'Finanzas papá'
unzip -oq ~/Downloads/M-M-Maderas-Cubicador-V12-1-GEMINI-36.zip -d .
npm run verify
npm run build
npx supabase functions deploy cubicar-madera
```

Después publica:

```bash
git add .
git commit -m "Cubicador V12.1 Gemini 3.6 y validacion estricta"
git push origin main
```

## Prueba obligatoria

1. Repite primero una fotografía claramente incorrecta, por ejemplo un poste visto de lado. Debe rechazarla.
2. Luego fotografía de frente un extremo de rollizo con el número pintado claramente visible. Debe entregar la lectura.
3. Repite con una marca parcialmente tapada. Debe indicarla como dudosa/no legible en vez de inventar el número.
