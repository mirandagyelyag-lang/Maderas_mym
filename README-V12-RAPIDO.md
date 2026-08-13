# M&M Maderas · Cubicador V12 rápido

Este parche se instala encima de la V11.

## Qué cambia

- El badge `100` deja de parecer una aprobación del contenido. Ahora informa solo calidad técnica.
- Una foto con mala luz/desenfoque grave se bloquea antes de gastar IA.
- Para rollizos, Gemini primero debe confirmar que la imagen muestra extremos cortados redondos/ovalados con marcas numéricas visibles.
- Postes vistos de lado, tablas, vigas, paredes, pisos, maquinaria u otras escenas se rechazan.
- Lectura primaria: `gemini-3.5-flash-lite`, baja latencia, `thinkingLevel: minimal`.
- 1 foto: timeout servidor 12 s. 4 fotos: 16 s.
- Segunda lectura con `gemini-3.6-flash` solo si la primera tiene baja confianza, marcas no legibles o filas dudosas.
- Si la segunda lectura falla, no destruye una primera lectura válida.
- Timeout cliente de rollizos: 30 s, en vez de esperar cerca de un minuto.
- Un solo botón de reintento después de un error.

## Instalar desde Git Bash

```bash
cd ~/Desktop/'Finanzas papá'
unzip -oq ~/Downloads/M-M-Maderas-Cubicador-V12-RAPIDO.zip -d .
npm run verify
npm run build
npx supabase functions deploy cubicar-madera
```

Después publica:

```bash
git add .
git commit -m "Cubicador V12 validacion de foto y lectura rapida"
git push origin main
```

No necesitas crear `GEMINI_FAST_VISION_MODEL`: si no existe, la Edge Function usa `gemini-3.5-flash-lite` automáticamente. `GEMINI_VISION_MODEL` queda como modelo de segunda comprobación cuando realmente haga falta.
