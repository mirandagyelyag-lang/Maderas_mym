# Activar la medición por IA

El cálculo manual y el historial funcionan sin configuración adicional. Para habilitar **Medir con IA**:

1. Crea una clave de API en tu proyecto de OpenAI.
2. En la terminal del proyecto ejecuta:

```bash
supabase secrets set OPENAI_API_KEY=TU_CLAVE
supabase secrets set OPENAI_VISION_MODEL=gpt-5-mini
supabase functions deploy cubicar-madera
```

La clave queda en Supabase y nunca se envía al navegador. No la agregues al archivo `.env` de Vite ni uses un nombre que comience con `VITE_`.

## Uso recomendado

- Fotografiar con buena luz.
- Poner una huincha visible en el mismo plano de la madera.
- Para troncos, subir un extremo, el otro extremo y una vista lateral.
- Para paquetes, subir una vista frontal, lateral y superior.
- Revisar siempre los valores antes de marcar la confirmación.

La medición visual es una estimación asistida. No debe usarse como certificación metrológica ni reemplazar una revisión humana en ventas.
