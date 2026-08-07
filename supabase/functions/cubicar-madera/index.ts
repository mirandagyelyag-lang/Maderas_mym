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
    const { tipo, imagenes, largo_m } = await request.json();
    if (!["tablas", "postes", "troncos", "paquetes"].includes(tipo)) throw new Error("Tipo de cubicación inválido.");
    if (!Array.isArray(imagenes) || imagenes.length < 1 || imagenes.length > 3) throw new Error("Debes enviar entre 1 y 3 imágenes.");
    if (imagenes.some((image) => typeof image !== "string" || !image.startsWith("data:image/") || image.length > 4_500_000)) throw new Error("Una de las imágenes no es válida o es demasiado pesada.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) throw new Error("No se pudo validar la sesión.");
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: anonKey } });
    if (!userResponse.ok) throw new Error("Sesión expirada o inválida.");
    const authUser = await userResponse.json();
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${authUser.id}&active=eq.true&status=eq.active&select=id`, { headers: { Authorization: authHeader, apikey: anonKey } });
    const profiles = await profileResponse.json();
    if (!profileResponse.ok || !Array.isArray(profiles) || profiles.length !== 1) throw new Error("Tu cuenta no está autorizada para usar la IA.");
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("Falta configurar OPENAI_API_KEY en Supabase.");

    const rollizosInstructions = tipo === "troncos" ? `
Esta es una pila de rollizos para cubicación JAS. Cada número pintado en el extremo de un rollizo representa su diámetro menor TOTAL en centímetros: 8 significa 8 cm y 34 significa 34 cm; nunca completes decenas ni inventes dígitos.
Cuenta solo extremos distinguibles y lee únicamente números suficientemente visibles. Agrupa los rollizos por diámetro en rollizos:[{"diametro_cm":number,"cantidad":number}]. No necesitas huincha: no debes medir el diámetro visualmente, sino transcribir la cifra pintada. El largo común es ${Number(largo_m) || "desconocido"} m y no debes inferirlo desde la foto. Si un número es dudoso, omítelo, baja la confianza y explica cuántos rollizos requieren revisión.` : `
Solo estima medidas si existe una huincha, regla u otra escala inequívoca en el mismo plano del objeto. No inventes profundidad ni dimensiones ocultas.`;

    const prompt = `Eres un asistente técnico de cubicación de madera. Analiza estas fotografías de tipo ${tipo}.${rollizosInstructions}
Devuelve solo JSON válido con esta forma:
{"medidas":{"largo_m":number|null,"ancho_cm":number|null,"espesor_cm":number|null,"alto_cm":number|null,"diametro_inicial_cm":number|null,"diametro_final_cm":number|null,"cantidad":number|null,"rollizos":[{"diametro_cm":number,"cantidad":number}]},"confianza":number,"observaciones":"texto breve","requiere_revision":true}
La confianza va de 0 a 100. Cuenta piezas solo cuando sean distinguibles. Todas las lecturas serán revisadas por una persona antes de usarlas.`;

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
