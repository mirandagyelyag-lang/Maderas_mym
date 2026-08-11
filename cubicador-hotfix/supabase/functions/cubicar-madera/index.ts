import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECTOR_NAMES = [
  "superior izquierdo",
  "superior derecho",
  "inferior izquierdo",
  "inferior derecho",
];

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "CUBICADOR_ERROR") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseFirstJsonObject(rawText: unknown) {
  const text = String(rawText || "")
    .replace(/^```json\s*|\s*```$/g, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    if (start < 0) {
      throw new HttpError(502, "La IA no entregó datos estructurados.", "INVALID_AI_JSON");
    }

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

    throw new HttpError(502, "La IA entregó datos incompletos.", "INCOMPLETE_AI_JSON");
  }
}

function getSupabasePublishableKey() {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.default || Object.values(parsed || {})[0] || "");
  } catch {
    return raw;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Error inesperado.");
}

function clampConfidence(value: unknown) {
  const parsed = Number(value) || 0;
  const percent = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
  return Math.round(Math.max(0, Math.min(100, percent)));
}

function cleanRollizos(rows: unknown) {
  const grouped = new Map<number, number>();

  for (const row of Array.isArray(rows) ? rows : []) {
    const diameter = Number(row?.diametro_cm);
    const quantity = Math.floor(Number(row?.cantidad));

    if (!Number.isFinite(diameter) || diameter <= 0 || diameter > 300) continue;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10_000) continue;

    const normalizedDiameter = Number(diameter.toFixed(1));
    grouped.set(
      normalizedDiameter,
      (grouped.get(normalizedDiameter) || 0) + quantity
    );
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([diametro_cm, cantidad]) => ({ diametro_cm, cantidad }));
}

function normalizeSectorResult(result: any, index: number) {
  const rollizos = cleanRollizos(result?.rollizos);
  const totalMarks = rollizos.reduce((sum, row) => sum + row.cantidad, 0);
  const unreadable = Math.max(0, Math.floor(Number(result?.no_legibles) || 0));
  const visible = Math.max(
    totalMarks + unreadable,
    Math.floor(Number(result?.total_extremos_visibles) || 0)
  );

  return {
    nombre: SECTOR_NAMES[index],
    rollizos,
    total_extremos_visibles: visible,
    total_marcas_leidas: totalMarks,
    no_legibles: unreadable,
    confianza: clampConfidence(result?.confianza),
  };
}

function aggregateSectors(rawSectors: unknown, largoM: unknown) {
  if (!Array.isArray(rawSectors) || rawSectors.length !== 4) {
    throw new HttpError(
      422,
      "La IA no logró separar correctamente los cuatro sectores. Repite las fotografías sin superponer zonas.",
      "INVALID_SECTORS"
    );
  }

  const sectors = rawSectors.slice(0, 4).map(normalizeSectorResult);
  const grouped = new Map<number, number>();
  let totalVisible = 0;
  let totalRead = 0;
  let totalUnreadable = 0;
  let confidenceSum = 0;

  for (const sector of sectors) {
    for (const row of sector.rollizos) {
      grouped.set(row.diametro_cm, (grouped.get(row.diametro_cm) || 0) + row.cantidad);
    }
    totalVisible += sector.total_extremos_visibles;
    totalRead += sector.total_marcas_leidas;
    totalUnreadable += sector.no_legibles;
    confidenceSum += sector.confianza;
  }

  const rollizos = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([diametro_cm, cantidad]) => ({ diametro_cm, cantidad }));
  const confidence = Math.round(confidenceSum / sectors.length);

  if (rollizos.length === 0) {
    throw new HttpError(
      422,
      "No se pudo leer ningún número rojo con seguridad. Acerca la cámara y evita sombras o reflejos.",
      "NO_READABLE_MARKS"
    );
  }

  return {
    medidas: {
      largo_m: Number(largoM) > 0 ? Number(largoM) : null,
      ancho_cm: null,
      espesor_cm: null,
      alto_cm: null,
      diametro_inicial_cm: null,
      diametro_final_cm: null,
      cantidad: null,
      rollizos,
      total_extremos_visibles: totalVisible,
      total_marcas_leidas: totalRead,
      no_legibles: totalUnreadable,
    },
    confianza: confidence,
    observaciones:
      "Lectura separada de cuatro sectores. Corrige cualquier número dudoso antes de calcular o guardar.",
    requiere_revision: true,
    resultado_confiable: confidence >= 60,
    sectores: sectors,
  };
}

function normalizeGeneralResult(raw: any, tipo: string, largoM: unknown) {
  const source = raw?.medidas;
  if (!source || typeof source !== "object") {
    throw new HttpError(502, "La IA no devolvió medidas válidas.", "MISSING_MEASUREMENTS");
  }

  const positiveOrNull = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const integerOrNull = (value: unknown) => {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const rollizos = cleanRollizos(source.rollizos);
  const totalRead = rollizos.reduce((sum, row) => sum + row.cantidad, 0);
  const totalUnreadable = Math.max(0, Math.floor(Number(source.no_legibles) || 0));
  const confidence = clampConfidence(raw?.confianza);

  if (tipo === "troncos" && rollizos.length === 0) {
    throw new HttpError(
      422,
      "No se pudo leer el número rojo. Toma una foto cercana, de frente y con buena luz.",
      "NO_READABLE_MARKS"
    );
  }

  return {
    medidas: {
      largo_m: tipo === "troncos"
        ? positiveOrNull(largoM) || positiveOrNull(source.largo_m)
        : positiveOrNull(source.largo_m),
      ancho_cm: positiveOrNull(source.ancho_cm),
      espesor_cm: positiveOrNull(source.espesor_cm),
      alto_cm: positiveOrNull(source.alto_cm),
      diametro_inicial_cm: positiveOrNull(source.diametro_inicial_cm),
      diametro_final_cm: positiveOrNull(source.diametro_final_cm),
      cantidad: integerOrNull(source.cantidad),
      rollizos,
      total_extremos_visibles: tipo === "troncos"
        ? Math.max(totalRead + totalUnreadable, Math.floor(Number(source.total_extremos_visibles) || 0))
        : null,
      total_marcas_leidas: tipo === "troncos" ? totalRead : null,
      no_legibles: tipo === "troncos" ? totalUnreadable : null,
    },
    confianza: confidence,
    observaciones:
      String(raw?.observaciones || "Lectura automática lista para revisión humana.").slice(0, 500),
    requiere_revision: true,
    resultado_confiable: confidence >= 60,
  };
}

function imagePartsFromDataUrls(images: string[]) {
  return images.map((image) => {
    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
    if (!match) {
      throw new HttpError(400, "Una fotografía no pudo prepararse para el análisis.", "INVALID_IMAGE");
    }
    return { inlineData: { mimeType: match[1], data: match[2] } };
  });
}

async function requestGeminiModel(
  modelName: string,
  apiKey: string,
  prompt: string,
  imageParts: any[],
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }, ...imageParts],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
            maxOutputTokens: 2_048,
          },
        }),
      }
    );

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        message:
          payload?.error?.message || `Gemini rechazó la solicitud (${response.status}).`,
      };
    }

    const outputText = payload?.candidates?.[0]?.content?.parts
      ?.filter((part: any) => typeof part?.text === "string" && !part?.thought)
      .map((part: any) => part.text)
      .join("")
      .trim();

    if (!outputText) {
      return {
        ok: false as const,
        status: 502,
        message: "Gemini no entregó un resultado legible.",
      };
    }

    return {
      ok: true as const,
      model: modelName,
      data: parseFirstJsonObject(outputText),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false as const,
        status: 504,
        message: `El modelo ${modelName} tardó demasiado.`,
      };
    }

    return {
      ok: false as const,
      status: 503,
      message: getErrorMessage(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function askGemini(apiKey: string, prompt: string, imageParts: any[]) {
  const configured = String(Deno.env.get("GEMINI_VISION_MODEL") || "").trim();
  const models = [configured || "gemini-3.5-flash", "gemini-3.5-flash-lite"]
    .filter((model, index, values) => model && values.indexOf(model) === index)
    .slice(0, 2);

  const failures: Array<{ status: number; message: string }> = [];

  for (let index = 0; index < models.length; index += 1) {
    const result = await requestGeminiModel(
      models[index],
      apiKey,
      prompt,
      imageParts,
      index === 0 ? 25_000 : 18_000
    );

    if (result.ok) {
      console.log(`cubicar-madera completado con ${result.model}`);
      return result.data;
    }

    failures.push({ status: result.status, message: result.message });

    if ([400, 401, 403].includes(result.status)) {
      throw new HttpError(
        result.status === 401 || result.status === 403 ? 500 : 502,
        result.message,
        "GEMINI_REJECTED_REQUEST"
      );
    }
  }

  if (failures.length && failures.every((failure) => failure.status === 429)) {
    throw new HttpError(
      429,
      "La cuota de IA está temporalmente ocupada. Espera un momento y vuelve a intentar.",
      "AI_QUOTA_LIMIT"
    );
  }

  if (failures.some((failure) => failure.status === 504)) {
    throw new HttpError(
      504,
      "El análisis superó el tiempo máximo. Usa fotos más cercanas o analiza un sector a la vez.",
      "AI_TIMEOUT"
    );
  }

  throw new HttpError(
    502,
    failures.at(-1)?.message || "No se pudo completar el análisis de IA.",
    "AI_UNAVAILABLE"
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      throw new HttpError(401, "Tu sesión no es válida. Vuelve a iniciar sesión.", "MISSING_AUTH");
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "La solicitud de análisis está dañada.", "INVALID_JSON");
    }

    const tipo = String(body?.tipo || "");
    const imagenes = body?.imagenes;
    const largoM = body?.largo_m;
    const modoImagenes = String(body?.modo_imagenes || "fotografias");

    if (!["tablas", "postes", "troncos", "paquetes"].includes(tipo)) {
      throw new HttpError(400, "Tipo de cubicación inválido.", "INVALID_TYPE");
    }
    if (!Array.isArray(imagenes) || imagenes.length < 1 || imagenes.length > 4) {
      throw new HttpError(400, "Debes enviar entre una y cuatro fotografías.", "INVALID_IMAGE_COUNT");
    }
    if (tipo === "troncos" && modoImagenes === "cuadrantes_2x2" && imagenes.length !== 4) {
      throw new HttpError(400, "La pila completa necesita exactamente cuatro fotografías.", "MISSING_SECTORS");
    }

    const invalidImage = imagenes.some(
      (image: unknown) =>
        typeof image !== "string" ||
        !image.startsWith("data:image/") ||
        image.length > 4_500_000
    );
    const totalPayload = imagenes.reduce(
      (sum: number, image: unknown) => sum + (typeof image === "string" ? image.length : 0),
      0
    );

    if (invalidImage || totalPayload > 12_000_000) {
      throw new HttpError(
        413,
        "Las fotografías son demasiado pesadas. Vuelve a seleccionarlas para que la app las comprima.",
        "IMAGES_TOO_LARGE"
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = getSupabasePublishableKey();
    if (!supabaseUrl || !publishableKey) {
      throw new HttpError(500, "Supabase no pudo validar la sesión.", "MISSING_SUPABASE_CONFIG");
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: publishableKey },
    });
    if (!userResponse.ok) {
      throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.", "EXPIRED_SESSION");
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new HttpError(500, "Falta configurar GEMINI_API_KEY en Supabase.", "MISSING_GEMINI_KEY");
    }

    const sectorInstruction = modoImagenes === "cuadrantes_2x2"
      ? `Las imágenes son cuatro fotografías separadas y no superpuestas de una misma pila, en este orden: superior izquierdo, superior derecho, inferior izquierdo e inferior derecho. Un extremo pertenece al sector donde aparece su centro. No dupliques extremos entre imágenes.`
      : "";

    const rollizoInstruction = tipo === "troncos"
      ? `
Esta es una cubicación de rollizos según marcas pintadas.
${sectorInstruction}
Tu tarea es transcribir literalmente los números ROJOS visibles en cada extremo.
- No calcules el diámetro por el tamaño aparente del rollizo.
- No completes dígitos ausentes ni conviertas un 6 visible en 16, 26 o 36.
- La pintura verde, los puntos y las manchas no son dígitos.
- Si un número no se distingue completo, cuéntalo como no_legibles; no lo adivines.
- Recorre los extremos por filas, de izquierda a derecha y de arriba hacia abajo.
- La suma de las cantidades agrupadas debe coincidir exactamente con total_marcas_leidas.
El largo común informado es ${Number(largoM) > 0 ? Number(largoM) : "desconocido"} m. No lo infieras desde la foto.`
      : `
Solo estima una medida cuando exista una huincha, regla o escala inequívoca en el mismo plano de la madera. Si no se ve, devuelve null. No inventes dimensiones ocultas.`;

    const generalPrompt = `Eres un asistente técnico para cubicación de madera. Analiza fotografías del tipo ${tipo}.${rollizoInstruction}
Devuelve únicamente JSON válido con esta forma:
{"medidas":{"largo_m":number|null,"ancho_cm":number|null,"espesor_cm":number|null,"alto_cm":number|null,"diametro_inicial_cm":number|null,"diametro_final_cm":number|null,"cantidad":number|null,"rollizos":[{"diametro_cm":number,"cantidad":number}],"total_extremos_visibles":number|null,"total_marcas_leidas":number|null,"no_legibles":number|null},"confianza":number,"observaciones":"texto breve","requiere_revision":true}
La confianza va de 0 a 100. Toda lectura será revisada por una persona antes de guardarse.`;

    const sectorPrompt = `${rollizoInstruction}
Recibirás exactamente cuatro fotografías, una por sector y en el orden indicado.
Devuelve únicamente JSON válido con esta forma:
{"sectores":[{"nombre":"superior izquierdo","rollizos":[{"diametro_cm":number,"cantidad":number}],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number},{"nombre":"superior derecho","rollizos":[],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number},{"nombre":"inferior izquierdo","rollizos":[],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number},{"nombre":"inferior derecho","rollizos":[],"total_extremos_visibles":number,"total_marcas_leidas":number,"no_legibles":number,"confianza":number}]}
Incluye los cuatro sectores aunque alguno no tenga marcas legibles.`;

    const imageParts = imagePartsFromDataUrls(imagenes);
    const useSectors = tipo === "troncos" && modoImagenes === "cuadrantes_2x2";
    const rawResult = await askGemini(apiKey, useSectors ? sectorPrompt : generalPrompt, imageParts);
    const result = useSectors
      ? aggregateSectors(rawResult?.sectores, largoM)
      : normalizeGeneralResult(rawResult, tipo, largoM);

    return json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : "UNEXPECTED_ERROR";
    const message = getErrorMessage(error);

    console.error("cubicar-madera error:", { status, code, message });
    return json({ error: message, code }, status);
  }
});
