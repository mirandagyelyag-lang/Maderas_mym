import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Sesión no válida.");
    const { tipo, imagenes } = await request.json();
    if (!Array.isArray(imagenes) || imagenes.length < 1 || imagenes.length > 3) throw new Error("Debes enviar entre 1 y 3 imágenes.");
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("Falta configurar OPENAI_API_KEY en Supabase.");

    const prompt = `Eres un asistente técnico de cubicación de madera. Analiza estas fotografías de tipo ${tipo}.
Solo estima medidas si existe una huincha, regla u otra escala inequívoca en el mismo plano del objeto. No inventes profundidad ni dimensiones ocultas.
Devuelve solo JSON válido con esta forma:
{"medidas":{"largo_m":number|null,"ancho_cm":number|null,"espesor_cm":number|null,"alto_cm":number|null,"diametro_inicial_cm":number|null,"diametro_final_cm":number|null,"cantidad":number|null},"confianza":number,"observaciones":"texto breve","requiere_revision":true}
La confianza va de 0 a 100. Si la escala no es legible, usa null, confianza menor a 35 y explícalo. Cuenta piezas solo cuando sean distinguibles. Todas las medidas serán revisadas por una persona antes de usarlas.`;

    const content = [
      { type: "input_text", text: prompt },
      ...imagenes.map((image) => ({ type: "input_image", image_url: image, detail: "high" })),
    ];
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("OPENAI_VISION_MODEL") || "gpt-5-mini", input: [{ role: "user", content }] }),
    });
    const payload = await openAIResponse.json();
    if (!openAIResponse.ok) throw new Error(payload?.error?.message || "La IA rechazó la solicitud.");
    const outputText = payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("La IA no entregó un resultado.");
    const parsed = JSON.parse(outputText.replace(/^```json\s*|\s*```$/g, ""));
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Error inesperado." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
