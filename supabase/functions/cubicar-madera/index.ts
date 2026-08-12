const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CUBICADOR_VERSION = "8.0.0";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error || "Error inesperado.");

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

const positiveNumberOrNull = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const positiveIntegerOrNull = (value: unknown) => {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const boundedInteger = (value: unknown, minimum: number, maximum: number) => {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return minimum;
  return Math.min(maximum, Math.max(minimum, numeric));
};

const normalizeConfidence = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const percentage = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(Math.min(100, Math.max(0, percentage)));
};

function parseFirstJsonObject(rawText: string) {
  const cleaned = String(rawText || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new HttpError(502, "El servicio de visión no entregó un JSON válido.");
  }
}

function sanitizeRollizoResult(rawResult: unknown, inputLength: unknown) {
  const result = asRecord(rawResult);
  const rawSectors = Array.isArray(result.sectores) && result.sectores.length
    ? result.sectores
    : [result.medidas || result];
  const grouped = new Map<number, { cantidad: number; confianzas: number[] }>();
  const readings: Array<Record<string, unknown>> = [];
  let unreadable = 0;
  let visible = 0;
  const sectorSummaries: Array<Record<string, unknown>> = [];

  rawSectors.slice(0, 4).forEach((rawSector: unknown, index: number) => {
    const sector = asRecord(rawSector);
    const sectorMeasures = asRecord(sector.medidas);
    const rawRows = Array.isArray(sector.rollizos)
      ? sector.rollizos
      : Array.isArray(sectorMeasures.rollizos)
        ? sectorMeasures.rollizos
        : [];
    let readableInSector = 0;

    rawRows.forEach((rawRow: unknown) => {
      const row = asRecord(rawRow);
      // Los números pintados de la tabla son diámetros enteros. No se completa
      // una decena ni se corrige usando el tamaño aparente del rollizo.
      const diameter = boundedInteger(row.diametro_cm, 0, 300);
      const quantity = boundedInteger(row.cantidad, 0, 10_000);
      if (diameter <= 0 || quantity <= 0) return;
      const rowConfidence = normalizeConfidence(row.confianza);
      const current = grouped.get(diameter) || { cantidad: 0, confianzas: [] };
      current.cantidad += quantity;
      if (rowConfidence > 0) current.confianzas.push(rowConfidence);
      grouped.set(diameter, current);
      readings.push({
        sector: index + 1,
        diametro_cm: diameter,
        cantidad: quantity,
        confianza: rowConfidence,
        requiere_revision: rowConfidence < 75,
      });
      readableInSector += quantity;
    });

    const unreadableInSector = boundedInteger(
      sector.no_legibles ?? sectorMeasures.no_legibles,
      0,
      10_000,
    );
    const reportedVisible = boundedInteger(
      sector.total_extremos_visibles ?? sectorMeasures.total_extremos_visibles,
      0,
      10_000,
    );
    const safeVisible = Math.max(readableInSector + unreadableInSector, reportedVisible);
    unreadable += unreadableInSector;
    visible += safeVisible;
    sectorSummaries.push({
      sector: index + 1,
      marcas_leidas: readableInSector,
      no_legibles: unreadableInSector,
      extremos_visibles: safeVisible,
    });
  });

  const rollizos = [...grouped.entries()]
    .sort(([first], [second]) => first - second)
    .map(([diametro_cm, item]) => ({
      diametro_cm,
      cantidad: item.cantidad,
      confianza: item.confianzas.length ? Math.min(...item.confianzas) : 0,
      requiere_revision: !item.confianzas.length || Math.min(...item.confianzas) < 75,
    }));
  const readable = rollizos.reduce((sum, row) => sum + row.cantidad, 0);
  let confidence = normalizeConfidence(result.confianza);
  if (!readable) confidence = Math.min(confidence, 20);
  if (unreadable > 0) confidence = Math.min(confidence, 65);

  const modelObservation = typeof result.observaciones === "string"
    ? result.observaciones.trim().slice(0, 350)
    : "";
  const reviewMessage = unreadable > 0
    ? `${unreadable} marca(s) no fueron legibles: agrégalas manualmente antes de calcular.`
    : "Compara cada diámetro y cantidad con la fotografía antes de calcular.";

  return {
    medidas: {
      largo_m: positiveNumberOrNull(inputLength),
      ancho_cm: null,
      espesor_cm: null,
      alto_cm: null,
      diametro_inicial_cm: null,
      diametro_final_cm: null,
      cantidad: null,
      rollizos,
      total_extremos_visibles: Math.max(visible, readable + unreadable),
      total_marcas_leidas: readable,
      no_legibles: unreadable,
    },
    confianza: confidence,
    observaciones: `${reviewMessage}${modelObservation ? ` ${modelObservation}` : ""}`,
    requiere_revision: true,
    resultado_confiable: false,
    sectores: sectorSummaries,
    lecturas: readings,
  };
}

function sanitizeGeometricResult(rawResult: unknown) {
  const result = asRecord(rawResult);
  const measures = asRecord(result.medidas);
  const confidence = normalizeConfidence(result.confianza);
  const modelObservation = typeof result.observaciones === "string"
    ? result.observaciones.trim().slice(0, 350)
    : "";

  return {
    medidas: {
      largo_m: positiveNumberOrNull(measures.largo_m),
      ancho_cm: positiveNumberOrNull(measures.ancho_cm),
      espesor_cm: positiveNumberOrNull(measures.espesor_cm),
      alto_cm: positiveNumberOrNull(measures.alto_cm),
      diametro_inicial_cm: positiveNumberOrNull(measures.diametro_inicial_cm),
      diametro_final_cm: positiveNumberOrNull(measures.diametro_final_cm),
      cantidad: positiveIntegerOrNull(measures.cantidad),
      rollizos: [],
      total_extremos_visibles: null,
      total_marcas_leidas: null,
      no_legibles: null,
    },
    confianza: confidence,
    observaciones: `Lectura automática no validada. Revisa todas las medidas.${modelObservation ? ` ${modelObservation}` : ""}`,
    requiere_revision: true,
    resultado_confiable: false,
  };
}

function buildPrompt(tipo: string, imageCount: number, modoImagenes: string, largoM: unknown) {
  if (tipo === "troncos") {
    const sectorNames = [
      "arriba izquierda",
      "arriba derecha",
      "abajo izquierda",
      "abajo derecha",
    ];
    const requestedNames = modoImagenes === "cuadrantes_2x2"
      ? sectorNames.slice(0, imageCount)
      : ["fotografía 1"];

    return `Eres un transcriptor visual para cubicación JAS de rollizos. Recibes ${imageCount} fotografía(s), en este orden: ${requestedNames.join(", ")}.

Tu única tarea es TRANSCRIBIR LITERALMENTE los dígitos ROJOS pintados en cada extremo. No calcules volumen y no estimes el diámetro por el tamaño aparente.

Reglas obligatorias:
- Una marca roja "6" es 6; jamás la conviertas en 16, 26 o 36.
- Devuelve 26 solo si se ven juntos claramente un 2 y un 6 en el mismo extremo.
- La pintura verde nunca es un dígito ni un cero.
- Un punto sin forma numérica no es un dígito.
- Si una marca es dudosa, cortada, tapada o borrosa, no adivines: cuéntala en no_legibles.
- Cuenta un extremo en una sola fotografía. No extrapoles filas ocultas ni inventes piezas.
- Agrupa únicamente transcripciones idénticas.
- Para cada grupo devuelve confianza de 0 a 100. Usa menos de 75 si algún dígito es dudoso.
- El largo común (${Number(largoM) || "no informado"} m) es un dato manual y no se infiere desde la foto.

Devuelve solamente JSON válido:
{"sectores":[{"nombre":"sector","rollizos":[{"diametro_cm":26,"cantidad":1,"confianza":90}],"total_extremos_visibles":1,"no_legibles":0}],"confianza":0,"observaciones":"texto breve"}

Debe existir un elemento en sectores por cada fotografía y conservar el mismo orden.`;
  }

  return `Eres un asistente de medición de madera tipo ${tipo}. Solo informa una dimensión cuando exista una huincha, regla u otra escala inequívoca en el mismo plano del objeto. No inventes profundidad, caras ocultas ni piezas tapadas. Si una dimensión no se puede leer, usa null.

Devuelve solamente JSON válido:
{"medidas":{"largo_m":null,"ancho_cm":null,"espesor_cm":null,"alto_cm":null,"diametro_inicial_cm":null,"diametro_final_cm":null,"cantidad":null},"confianza":0,"observaciones":"texto breve","requiere_revision":true}`;
}

type GeminiAttempt = {
  ok: boolean;
  status: number;
  retryable: boolean;
  message: string;
  data?: unknown;
};

async function requestGemini(
  model: string,
  apiKey: string,
  prompt: string,
  imageParts: Array<Record<string, unknown>>,
  timeoutMs: number,
): Promise<GeminiAttempt> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
            maxOutputTokens: 4096,
          },
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = asRecord(asRecord(payload).error).message ||
        `El servicio de visión respondió ${response.status}.`;
      return {
        ok: false,
        status: response.status,
        retryable: response.status === 404 || response.status === 408 || response.status === 429 || response.status >= 500,
        message,
      };
    }

    const candidates = Array.isArray(asRecord(payload).candidates)
      ? asRecord(payload).candidates
      : [];
    const parts = Array.isArray(asRecord(asRecord(candidates[0]).content).parts)
      ? asRecord(asRecord(candidates[0]).content).parts
      : [];
    const output = parts.map((part: unknown) => String(asRecord(part).text || "")).join("");
    if (!output) {
      return { ok: false, status: 502, retryable: true, message: "El servicio de visión respondió vacío." };
    }

    return { ok: true, status: 200, retryable: false, message: "", data: parseFirstJsonObject(output) };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      retryable: true,
      message: timedOut
        ? `El modelo ${model} superó ${Math.round(timeoutMs / 1000)} segundos.`
        : "No se pudo conectar con el servicio de visión.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function validateUser(authHeader: string, supabaseUrl: string, anonKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      signal: controller.signal,
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!response.ok) throw new HttpError(401, "La sesión expiró. Vuelve a iniciar sesión.");
    const user = await response.json();
    if (!user?.id) throw new HttpError(401, "La sesión no es válida.");
    return user.id as string;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(504, "No se pudo validar la sesión a tiempo.");
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  console.log(`[cubicar-madera:${requestId}] solicitud iniciada`);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new HttpError(401, "Falta la sesión del usuario.");

    const body = asRecord(await request.json().catch(() => {
      throw new HttpError(400, "El cuerpo de la solicitud no es JSON válido.");
    }));
    const accion = String(body.accion || "analizar");
    const tipo = String(body.tipo || "");
    const modoImagenes = String(body.modo_imagenes || "fotografias");
    const imagenes = Array.isArray(body.imagenes) ? body.imagenes : [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !anonKey) throw new HttpError(500, "Falta la configuración de Supabase.");
    if (!apiKey) throw new HttpError(500, "Falta configurar GEMINI_API_KEY en Supabase.");

    await validateUser(authHeader, supabaseUrl, anonKey);
    if (accion === "diagnostico") {
      console.log(`[cubicar-madera:${requestId}] diagnóstico correcto; cliente=${String(body.version_cliente || "no informado")}`);
      return jsonResponse({
        ok: true,
        version: CUBICADOR_VERSION,
        proveedor: "Gemini",
        modelo_principal: String(Deno.env.get("GEMINI_VISION_MODEL") || "gemini-3.5-flash"),
        request_id: requestId,
      });
    }
    if (accion !== "analizar") throw new HttpError(400, "Acción inválida.");
    if (!["tablas", "postes", "troncos", "paquetes"].includes(tipo)) {
      throw new HttpError(400, "Tipo de cubicación inválido.");
    }
    if (imagenes.length < 1 || imagenes.length > 4) {
      throw new HttpError(400, "Debes enviar entre 1 y 4 fotografías.");
    }
    if (imagenes.some((image: unknown) =>
      typeof image !== "string" || !image.startsWith("data:image/") || image.length > 4_500_000
    )) {
      throw new HttpError(413, "Una fotografía no es válida o supera el tamaño permitido.");
    }
    const totalPayloadSize = imagenes.reduce((sum: number, image: unknown) => sum + String(image).length, 0);
    if (totalPayloadSize > 13_000_000) {
      throw new HttpError(413, "Las fotografías juntas son demasiado pesadas. Tómalas nuevamente con menor resolución.");
    }
    console.log(`[cubicar-madera:${requestId}] sesión válida; tipo=${tipo}; fotos=${imagenes.length}`);

    const imageParts = imagenes.map((image: unknown) => {
      const match = String(image).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
      if (!match) throw new HttpError(400, "Una fotografía no pudo prepararse para el análisis.");
      return { inlineData: { mimeType: match[1], data: match[2] } };
    });
    const prompt = buildPrompt(tipo, imageParts.length, modoImagenes, body.largo_m);
    const configuredModel = String(Deno.env.get("GEMINI_VISION_MODEL") || "").trim();
    const models = [configuredModel, "gemini-3.5-flash", "gemini-3.5-flash-lite"]
      .filter((model, index, list) => Boolean(model) && list.indexOf(model) === index)
      .slice(0, 2);

    let lastAttempt: GeminiAttempt | null = null;
    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      console.log(`[cubicar-madera:${requestId}] intento ${index + 1}/${models.length}; modelo=${model}`);
      const attempt = await requestGemini(model, apiKey, prompt, imageParts, index === 0 ? 30_000 : 18_000);
      lastAttempt = attempt;
      if (attempt.ok) {
        const cleaned = tipo === "troncos"
          ? sanitizeRollizoResult(attempt.data, body.largo_m)
          : sanitizeGeometricResult(attempt.data);
        console.log(`[cubicar-madera:${requestId}] completada; modelo=${model}; ms=${Date.now() - startedAt}`);
        return jsonResponse({ ...cleaned, modelo: model, request_id: requestId, version: CUBICADOR_VERSION });
      }
      console.warn(`[cubicar-madera:${requestId}] modelo falló; status=${attempt.status}; mensaje=${attempt.message}`);
      if (!attempt.retryable) break;
    }

    const providerStatus = lastAttempt?.status === 429
      ? 429
      : lastAttempt?.status === 504
        ? 504
        : 502;
    const providerMessage = lastAttempt?.status === 429
      ? "La cuota de IA está temporalmente agotada. Las fotos siguen disponibles; intenta más tarde o ingresa los números manualmente."
      : lastAttempt?.message || "No fue posible completar la lectura de las fotografías.";
    throw new HttpError(providerStatus, providerMessage);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = errorMessage(error);
    console.error(`[cubicar-madera:${requestId}] error; status=${status}; ms=${Date.now() - startedAt}; mensaje=${message}`);
    return jsonResponse({ error: message, request_id: requestId, version: CUBICADOR_VERSION }, status);
  }
});
