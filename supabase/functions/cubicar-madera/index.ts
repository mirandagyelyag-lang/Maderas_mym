import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseFirstJsonObject(rawText) {
  const text = String(rawText || "").replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    if (start < 0) throw new Error("Gemini no entregó un objeto JSON.");
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) return JSON.parse(text.slice(start, index + 1));
      }
    }
    throw new Error("Gemini entregó un JSON incompleto.");
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Sesión no válida.");
    const { tipo, imagenes, largo_m, modo_imagenes } = await request.json();
    if (!["tablas", "postes", "troncos", "paquetes"].includes(tipo)) throw new Error("Tipo de cubicación inválido.");
    if (!Array.isArray(imagenes) || imagenes.length < 1 || imagenes.length > 4) throw new Error("Debes enviar entre 1 y 4 imágenes.");
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
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("Falta configurar GEMINI_API_KEY en Supabase.");

    const sectorInstructions = modo_imagenes === "cuadrantes_2x2" ? `Las cuatro imágenes son cuadrantes NO SUPERPUESTOS de una sola foto, ordenados: superior izquierdo, superior derecho, inferior izquierdo e inferior derecho. Examina los cuatro cuadrantes por separado y suma sus resultados. Ningún extremo aparece completo en dos cuadrantes: no dupliques conteos. Si un número queda cortado por el borde, clasifícalo como no legible.` : "";
    const rollizosInstructions = tipo === "troncos" ? `
Esta es una pila de rollizos para cubicación JAS. Tu única tarea visual es TRANSCRIBIR LITERALMENTE los dígitos rojos pintados, no estimar diámetros por el tamaño aparente del rollizo.
${sectorInstructions}
Reglas obligatorias:
- Una marca visible "6" significa exactamente 6 cm. JAMÁS la conviertas en 16, 26, 36 u otro número comercial.
- Devuelve 26 solamente si se ven claramente un "2" y un "6" juntos en el mismo extremo. No completes decenas ausentes.
- Lee EXCLUSIVAMENTE trazos numéricos ROJOS. La pintura VERDE nunca forma parte del número.
- Un punto verde junto a un 2, 4, 6 u 8 NO es un cero: conserva 2, 4, 6 u 8.
- Los puntos verdes o rojos sin forma numérica no son dígitos ni ceros.
- No uses el tamaño, la perspectiva, la tabla JAS ni otros rollizos para corregir o inferir un número.
- Cuenta solo extremos distinguibles con una marca roja legible. Si una marca es dudosa, no la adivines: súmala a no_legibles.
Agrupa las transcripciones idénticas en rollizos:[{"diametro_cm":number,"cantidad":number}]. Informa también total_extremos_visibles, total_marcas_leidas y no_legibles. La suma de cantidades en rollizos debe ser exactamente total_marcas_leidas.
No necesitas huincha. El largo común es ${Number(largo_m) || "desconocido"} m y no debes inferirlo desde la foto.` : `
Solo estima medidas si existe una huincha, regla u otra escala inequívoca en el mismo plano del objeto. No inventes profundidad ni dimensiones ocultas.`;

    const prompt = `Eres un asistente técnico de cubicación de madera. Analiza estas fotografías de tipo ${tipo}.${rollizosInstructions}
Devuelve solo JSON válido con esta forma:
{"medidas":{"largo_m":number|null,"ancho_cm":number|null,"espesor_cm":number|null,"alto_cm":number|null,"diametro_inicial_cm":number|null,"diametro_final_cm":number|null,"cantidad":number|null,"rollizos":[{"diametro_cm":number,"cantidad":number}],"total_extremos_visibles":number|null,"total_marcas_leidas":number|null,"no_legibles":number|null},"confianza":number,"observaciones":"texto breve","requiere_revision":true}
La confianza va de 0 a 100. Cuenta piezas solo cuando sean distinguibles. Todas las lecturas serán revisadas por una persona antes de usarlas.`;

    const imageParts = imagenes.map((image) => {
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
      if (!match) throw new Error("Una fotografía no pudo prepararse para el análisis.");
      return { inlineData: { mimeType: match[1], data: match[2] } };
    });
    const model = Deno.env.get("GEMINI_VISION_MODEL") || "gemini-3.5-flash";
    const askGemini = async (analysisPrompt, parts) => {
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: analysisPrompt }, ...parts] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "minimal" } },
        }),
      });
      const payload = await geminiResponse.json();
      if (!geminiResponse.ok) {
        if (geminiResponse.status === 429) {
          throw new Error("Gemini alcanzó su límite gratuito temporal. Espera 30 segundos y vuelve a intentarlo una sola vez.");
        }
        throw new Error(payload?.error?.message || "Gemini rechazó la solicitud.");
      }
      const outputText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
      if (!outputText) throw new Error("Gemini no entregó un resultado legible.");
      return parseFirstJsonObject(outputText);
    };

    let parsed;
    if (tipo === "troncos" && modo_imagenes === "cuadrantes_2x2" && imageParts.length === 4) {
      const nombres = ["superior izquierdo", "superior derecho", "inferior izquierdo", "inferior derecho"];
      const sectorPrompt = `${rollizosInstructions}
Recibirás exactamente cuatro imágenes, en este orden: superior izquierdo, superior derecho, inferior izquierdo e inferior derecho.
Analiza las cuatro dentro de ESTA ÚNICA solicitud, pero entrega un resultado separado para cada sector.
En cada sector recorre los extremos por filas, de izquierda a derecha y de arriba hacia abajo. Cuenta todos los extremos distinguibles, incluso cuando su marca no sea legible. No resumas ni extrapoles.
Un extremo cortado pertenece al sector sólo si el centro del círculo está dentro de esa imagen. Recuerda: la pintura verde nunca es un cero ni parte del diámetro rojo.
Devuelve únicamente JSON válido con esta forma:
{"sectores":[{"nombre":"superior izquierdo","rollizos":[{"diametro_cm":number,"cantidad":number}],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number},{"nombre":"superior derecho","rollizos":[],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number},{"nombre":"inferior izquierdo","rollizos":[],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number},{"nombre":"inferior derecho","rollizos":[],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number}]}
La suma de cantidades de rollizos de cada sector debe ser exactamente su total_marcas_leidas.`;
      const respuestaSectores = await askGemini(sectorPrompt, imageParts);
      const resultados = Array.isArray(respuestaSectores?.sectores) ? respuestaSectores.sectores : [];
      if (resultados.length !== 4) throw new Error("Gemini no separó correctamente los cuatro sectores. Intenta nuevamente.");

      const agrupados = new Map();
      let totalExtremos = 0;
      let totalLeidas = 0;
      let totalNoLegibles = 0;
      let confianzaTotal = 0;
      for (const resultado of resultados) {
        const medidas = resultado || {};
        for (const row of Array.isArray(medidas.rollizos) ? medidas.rollizos : []) {
          const diametro = Number(row?.diametro_cm);
          const cantidad = Math.max(0, Math.floor(Number(row?.cantidad) || 0));
          if (Number.isFinite(diametro) && diametro > 0 && cantidad > 0) {
            agrupados.set(diametro, (agrupados.get(diametro) || 0) + cantidad);
          }
        }
        const leidasCalculadas = (Array.isArray(medidas.rollizos) ? medidas.rollizos : []).reduce(
          (sum, row) => sum + Math.max(0, Math.floor(Number(row?.cantidad) || 0)), 0,
        );
        const leidas = Math.max(leidasCalculadas, Math.floor(Number(medidas.total_marcas_leidas) || 0));
        const noLegibles = Math.max(0, Math.floor(Number(medidas.no_legibles) || 0));
        totalLeidas += leidasCalculadas;
        totalNoLegibles += noLegibles;
        totalExtremos += Math.max(leidas + noLegibles, Math.floor(Number(medidas.total_extremos_visibles) || 0));
        const confianzaSector = Number(resultado?.confianza) || 0;
        confianzaTotal += Math.max(0, Math.min(100, confianzaSector > 0 && confianzaSector <= 1 ? confianzaSector * 100 : confianzaSector));
      }
      parsed = {
        medidas: {
          largo_m: Number(largo_m) || null,
          ancho_cm: null,
          espesor_cm: null,
          alto_cm: null,
          diametro_inicial_cm: null,
          diametro_final_cm: null,
          cantidad: null,
          rollizos: [...agrupados.entries()].sort((a, b) => a[0] - b[0]).map(([diametro_cm, cantidad]) => ({ diametro_cm, cantidad })),
          total_extremos_visibles: totalExtremos,
          total_marcas_leidas: totalLeidas,
          no_legibles: totalNoLegibles,
        },
        confianza: Math.round(confianzaTotal / resultados.length),
        observaciones: `Conteo independiente de ${resultados.length} sectores. Verifica las marcas dudosas antes de guardar.`,
        requiere_revision: true,
      };
    } else {
      parsed = await askGemini(prompt, imageParts);
    }
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("cubicar-madera error:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message || "Error inesperado." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
