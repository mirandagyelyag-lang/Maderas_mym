const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CUBICADOR_VERSION = "12.1.0";

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


function compareRollizoReadings(firstResult: Record<string, any>, secondResult: Record<string, any>) {
  const firstRows = Array.isArray(asRecord(firstResult.medidas).rollizos)
    ? asRecord(firstResult.medidas).rollizos
    : [];
  const secondRows = Array.isArray(asRecord(secondResult.medidas).rollizos)
    ? asRecord(secondResult.medidas).rollizos
    : [];

  const toMap = (rows: unknown[]) => {
    const map = new Map<number, number>();
    rows.forEach((rawRow) => {
      const row = asRecord(rawRow);
      const diameter = boundedInteger(row.diametro_cm, 0, 300);
      const quantity = boundedInteger(row.cantidad, 0, 10_000);
      if (diameter > 0 && quantity > 0) map.set(diameter, quantity);
    });
    return map;
  };

  const first = toMap(firstRows);
  const second = toMap(secondRows);
  const diameters = [...new Set([...first.keys(), ...second.keys()])].sort((a, b) => a - b);
  const discrepancies = diameters
    .map((diameter) => ({
      diametro_cm: diameter,
      primera_lectura: first.get(diameter) || 0,
      segunda_lectura: second.get(diameter) || 0,
    }))
    .filter((item) => item.primera_lectura !== item.segunda_lectura);

  const firstTotal = [...first.values()].reduce((sum, value) => sum + value, 0);
  const secondTotal = [...second.values()].reduce((sum, value) => sum + value, 0);
  const firstMeasures = asRecord(firstResult.medidas);
  const secondMeasures = asRecord(secondResult.medidas);
  const firstUnreadable = boundedInteger(firstMeasures.no_legibles, 0, 10_000);
  const secondUnreadable = boundedInteger(secondMeasures.no_legibles, 0, 10_000);
  const firstVisible = boundedInteger(firstMeasures.total_extremos_visibles, 0, 10_000);
  const secondVisible = boundedInteger(secondMeasures.total_extremos_visibles, 0, 10_000);
  const exactRows = discrepancies.length === 0;
  const exact = exactRows && firstUnreadable === secondUnreadable && firstVisible === secondVisible;
  const totalDifference = Math.abs(firstTotal - secondTotal);
  const relativeDifference = totalDifference / Math.max(1, firstTotal, secondTotal);

  return {
    coincide: exact,
    distribucion_coincide: exactRows,
    primera_total: firstTotal,
    segunda_total: secondTotal,
    primera_no_legibles: firstUnreadable,
    segunda_no_legibles: secondUnreadable,
    primera_visibles: firstVisible,
    segunda_visibles: secondVisible,
    diferencia_total: totalDifference,
    diferencia_relativa: Number(relativeDifference.toFixed(4)),
    discrepancias: discrepancies.slice(0, 20),
  };
}

function attachRollizoCrossCheck(
  primaryResult: Record<string, any>,
  secondaryResult: Record<string, any> | null,
  primaryModel: string,
  secondaryModel: string | null,
) {
  if (!secondaryResult) {
    return {
      ...primaryResult,
      observaciones: `Lectura rápida completada. Revisa los números visibles antes de guardar. ${String(primaryResult.observaciones || "")}`.trim(),
      resultado_confiable: false,
      requiere_revision: true,
      consistencia: {
        coincide: null,
        comprobaciones: 1,
        modelos: [primaryModel],
        mensaje: "La primera lectura no mostró señales que obligaran una segunda llamada. Revisa visualmente antes de guardar.",
      },
    };
  }

  const comparison = compareRollizoReadings(primaryResult, secondaryResult);
  const primaryMeasures = asRecord(primaryResult.medidas);
  const primaryRows = Array.isArray(primaryMeasures.rollizos) ? primaryMeasures.rollizos : [];
  const secondaryConfidence = normalizeConfidence(secondaryResult.confianza);
  const primaryConfidence = normalizeConfidence(primaryResult.confianza);
  const agreedConfidence = comparison.coincide
    ? Math.min(primaryConfidence || 100, secondaryConfidence || 100, 96)
    : Math.min(primaryConfidence || 55, secondaryConfidence || 55, 55);

  const rows = primaryRows.map((rawRow: unknown) => {
    const row = asRecord(rawRow);
    return {
      ...row,
      confianza: comparison.coincide
        ? Math.min(normalizeConfidence(row.confianza) || agreedConfidence, agreedConfidence)
        : Math.min(normalizeConfidence(row.confianza) || 55, 55),
      requiere_revision: !comparison.coincide || row.requiere_revision !== false,
    };
  });

  const message = comparison.coincide
    ? `Dos lecturas independientes coincidieron: ${comparison.primera_total} rollizos en ambas.`
    : `Las dos lecturas no coincidieron (${comparison.primera_total} vs ${comparison.segunda_total} rollizos). Revisa los diámetros marcados antes de calcular.`;

  return {
    ...primaryResult,
    medidas: { ...primaryMeasures, rollizos: rows },
    confianza: Math.round(agreedConfidence),
    observaciones: `${message} ${String(primaryResult.observaciones || "")}`.trim(),
    resultado_confiable: comparison.coincide && Number(primaryMeasures.no_legibles || 0) === 0,
    requiere_revision: true,
    consistencia: {
      ...comparison,
      comprobaciones: 2,
      modelos: [primaryModel, secondaryModel].filter(Boolean),
    },
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

    return `Eres un inspector visual para cubicación JAS de rollizos. Recibes ${imageCount} fotografía(s), en este orden: ${requestedNames.join(", ")}.

PRIMERA TAREA, antes de leer cualquier número: valida cada fotografía de forma ESTRICTA. Una foto es válida SOLO si muestra claramente uno o más EXTREMOS CORTADOS de rollizos redondos/ovalados, vistos de frente o casi de frente, y existe al menos una marca numérica pintada SOBRE una de esas caras de corte.

NO basta con que la fotografía sea de madera, esté nítida o haya un número en cualquier parte. Si domina la vista lateral larga con corteza de un poste/tronco, si se ve un árbol o poste de pie, una tabla, una viga, una pared, piso, maquinaria, estructura de aserradero u otro objeto, la foto es inválida cuando NO se ven claramente las caras circulares/ovaladas de corte con sus marcas. Un poste vertical visto principalmente de lado sigue siendo inválido aunque esté perfectamente enfocado. Si tienes dudas sobre si realmente son extremos cortados, usa foto_valida=false. Nunca aceptes una escena solo por estar dentro de una barraca/aserradero.

Para cada fotografía informa por separado estos tres criterios: ve_extremos_cortados, marcas_numericas_en_extremos y vista_lateral_dominante. foto_valida SOLO puede ser true cuando ve_extremos_cortados=true, marcas_numericas_en_extremos=true y vista_lateral_dominante=false.

SEGUNDA TAREA, solo en fotos válidas: TRANSCRIBE LITERALMENTE los dígitos ROJOS pintados en cada extremo. No calcules volumen y no estimes el diámetro por el tamaño aparente.

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
- foto_valida=true NO significa que la foto sea nítida: significa específicamente que la escena corresponde a extremos de rollizos aptos para esta tarea.

Devuelve solamente JSON válido:
{"foto_valida":true,"motivo_rechazo":"","sectores":[{"nombre":"sector","foto_valida":true,"ve_extremos_cortados":true,"marcas_numericas_en_extremos":true,"vista_lateral_dominante":false,"motivo_rechazo":"","rollizos":[{"diametro_cm":26,"cantidad":1,"confianza":90}],"total_extremos_visibles":1,"no_legibles":0}],"confianza":90,"observaciones":"texto breve"}

Debe existir un elemento en sectores por cada fotografía y conservar el mismo orden. La raíz foto_valida solo puede ser true si TODAS las fotografías son válidas.`;
  }

  return `Eres un asistente de medición de madera tipo ${tipo}. Solo informa una dimensión cuando exista una huincha, regla u otra escala inequívoca en el mismo plano del objeto. No inventes profundidad, caras ocultas ni piezas tapadas. Si una dimensión no se puede leer, usa null.

Devuelve solamente JSON válido:
{"medidas":{"largo_m":null,"ancho_cm":null,"espesor_cm":null,"alto_cm":null,"diametro_inicial_cm":null,"diametro_final_cm":null,"cantidad":null},"confianza":0,"observaciones":"texto breve","requiere_revision":true}`;
}


function buildResponseSchema(tipo: string) {
  if (tipo === "troncos") {
    return {
      type: "object",
      properties: {
        foto_valida: { type: "boolean" },
        motivo_rechazo: { type: "string" },
        sectores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nombre: { type: "string" },
              foto_valida: { type: "boolean" },
              ve_extremos_cortados: { type: "boolean" },
              marcas_numericas_en_extremos: { type: "boolean" },
              vista_lateral_dominante: { type: "boolean" },
              motivo_rechazo: { type: "string" },
              rollizos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    diametro_cm: { type: "integer", minimum: 1, maximum: 300 },
                    cantidad: { type: "integer", minimum: 1, maximum: 10000 },
                    confianza: { type: "integer", minimum: 0, maximum: 100 },
                  },
                  required: ["diametro_cm", "cantidad", "confianza"],
                },
              },
              total_extremos_visibles: { type: "integer", minimum: 0, maximum: 10000 },
              no_legibles: { type: "integer", minimum: 0, maximum: 10000 },
            },
            required: ["nombre", "foto_valida", "ve_extremos_cortados", "marcas_numericas_en_extremos", "vista_lateral_dominante", "motivo_rechazo", "rollizos", "total_extremos_visibles", "no_legibles"],
          },
        },
        confianza: { type: "integer", minimum: 0, maximum: 100 },
        observaciones: { type: "string" },
      },
      required: ["foto_valida", "motivo_rechazo", "sectores", "confianza", "observaciones"],
    };
  }

  return {
    type: "object",
    properties: {
      medidas: {
        type: "object",
        properties: {
          largo_m: { type: ["number", "null"] },
          ancho_cm: { type: ["number", "null"] },
          espesor_cm: { type: ["number", "null"] },
          alto_cm: { type: ["number", "null"] },
          diametro_inicial_cm: { type: ["number", "null"] },
          diametro_final_cm: { type: ["number", "null"] },
          cantidad: { type: ["integer", "null"] },
        },
        required: ["largo_m", "ancho_cm", "espesor_cm", "alto_cm", "diametro_inicial_cm", "diametro_final_cm", "cantidad"],
      },
      confianza: { type: "integer", minimum: 0, maximum: 100 },
      observaciones: { type: "string" },
      requiere_revision: { type: "boolean" },
    },
    required: ["medidas", "confianza", "observaciones", "requiere_revision"],
  };
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
  responseSchema: Record<string, unknown>,
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
            // La resolución alta ya va por fotografía. Temperatura 0 reduce
            // variación al transcribir marcas pintadas.
            temperature: 0,
            responseFormat: {
              text: {
                mimeType: "APPLICATION_JSON",
                schema: responseSchema,
              },
            },
            thinkingConfig: { thinkingLevel: "minimal" },
            maxOutputTokens: 1400,
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
        modelo_principal: String(Deno.env.get("GEMINI_CUBICADOR_MODEL") || "gemini-3.6-flash"),
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
      return {
        inlineData: { mimeType: match[1], data: match[2] },
        // Los números pintados son detalles pequeños. Gemini 3 puede reservar
        // más presupuesto visual por imagen cuando pedimos resolución alta.
        mediaResolution: { level: "MEDIA_RESOLUTION_HIGH" },
      };
    });
    const prompt = buildPrompt(tipo, imageParts.length, modoImagenes, body.largo_m);
    const responseSchema = buildResponseSchema(tipo);
    // V12.1: Gemini 3.6 Flash es el cerebro normal del cubicador.
    // No reutilizamos GEMINI_VISION_MODEL porque instalaciones anteriores pueden
    // tener ahí un modelo 3.5 antiguo. GEMINI_CUBICADOR_MODEL es opcional.
    const primaryModel = String(Deno.env.get("GEMINI_CUBICADOR_MODEL") || "gemini-3.6-flash").trim();
    const verifierModel = String(Deno.env.get("GEMINI_CUBICADOR_VERIFY_MODEL") || primaryModel).trim();
    let lastAttempt: GeminiAttempt | null = null;
    const successfulRollizoRuns: Array<{ cleaned: Record<string, any>; model: string }> = [];

    // V12.1: una sola llamada a Gemini 3.6 valida la escena Y lee los números.
    // Solo una lectura realmente dudosa dispara una comprobación independiente.
    const primaryTimeoutMs = tipo === "troncos"
      ? (imageParts.length > 1 ? 18_000 : 14_000)
      : 16_000;
    console.log(`[cubicar-madera:${requestId}] validación + lectura; modelo=${primaryModel}`);
    const primaryAttempt = await requestGemini(
      primaryModel,
      apiKey,
      prompt,
      imageParts,
      responseSchema,
      primaryTimeoutMs,
    );
    lastAttempt = primaryAttempt;

    if (primaryAttempt.ok) {
      if (tipo === "troncos") {
        const rawPrimary = asRecord(primaryAttempt.data);
        const rawSectors = Array.isArray(rawPrimary.sectores) ? rawPrimary.sectores : [];
        const auditedSectors = rawSectors
          .map((rawSector: unknown, index: number) => ({ index, sector: asRecord(rawSector) }));
        const sectorSemanticallyValid = (sector: Record<string, any>) =>
          sector.foto_valida === true &&
          sector.ve_extremos_cortados === true &&
          sector.marcas_numericas_en_extremos === true &&
          sector.vista_lateral_dominante === false;
        const invalidSectors = auditedSectors.filter(({ sector }) => !sectorSemanticallyValid(sector));
        const allPhotosAccountedFor = rawSectors.length === imageParts.length;
        const rootValid = rawPrimary.foto_valida === true;
        if (!rootValid || !allPhotosAccountedFor || invalidSectors.length > 0) {
          const firstInvalid = invalidSectors[0];
          const reason = String(
            firstInvalid?.sector?.motivo_rechazo || rawPrimary.motivo_rechazo ||
            (!allPhotosAccountedFor
              ? "La IA no pudo comprobar correctamente todas las fotografías."
              : "La fotografía no muestra de frente extremos cortados de rollizos con números pintados."),
          ).trim();
          const photoLabel = firstInvalid ? `Foto ${firstInvalid.index + 1}: ` : "";
          throw new HttpError(422, `${photoLabel}${reason} Repite la foto mostrando de frente las caras circulares u ovaladas de corte y sus números pintados.`);
        }

        const cleaned = sanitizeRollizoResult(primaryAttempt.data, body.largo_m) as Record<string, any>;
        const measures = asRecord(cleaned.medidas);
        const rows = Array.isArray(measures.rollizos) ? measures.rollizos : [];
        const hasDetection = rows.length > 0;
        if (!hasDetection) {
          throw new HttpError(422, "La foto parece corresponder a rollizos, pero no se pudo leer ningún número pintado. Acércate a los extremos y repite la foto.");
        }
        successfulRollizoRuns.push({ cleaned, model: primaryModel });

        const confidence = normalizeConfidence(cleaned.confianza);
        const unreadable = boundedInteger(measures.no_legibles, 0, 10_000);
        const rowNeedsReview = rows.some((rawRow: unknown) => {
          const row = asRecord(rawRow);
          return normalizeConfidence(row.confianza) < 75;
        });
        const needsSecondCheck = confidence < 78 || unreadable > 0 || rowNeedsReview;

        if (needsSecondCheck && verifierModel) {
          console.log(`[cubicar-madera:${requestId}] lectura dudosa; verificación=${verifierModel}`);
          const verifierAttempt = await requestGemini(
            verifierModel,
            apiKey,
            prompt,
            imageParts,
            responseSchema,
            10_000,
          );
          if (verifierAttempt.ok) {
            const rawVerifier = asRecord(verifierAttempt.data);
            const verifierSectors = Array.isArray(rawVerifier.sectores) ? rawVerifier.sectores : [];
            const verifierValid = rawVerifier.foto_valida === true &&
              verifierSectors.length === imageParts.length &&
              verifierSectors.every((rawSector: unknown) => {
                const sector = asRecord(rawSector);
                return sector.foto_valida === true &&
                  sector.ve_extremos_cortados === true &&
                  sector.marcas_numericas_en_extremos === true &&
                  sector.vista_lateral_dominante === false;
              });
            if (verifierValid) {
              const cleanedVerifier = sanitizeRollizoResult(verifierAttempt.data, body.largo_m) as Record<string, any>;
              const verifierRows = Array.isArray(asRecord(cleanedVerifier.medidas).rollizos) ? asRecord(cleanedVerifier.medidas).rollizos : [];
              if (verifierRows.length > 0) successfulRollizoRuns.push({ cleaned: cleanedVerifier, model: verifierModel });
            }
          }
        }

        const primary = successfulRollizoRuns[0];
        const secondary = successfulRollizoRuns[1] || null;
        const crossChecked = attachRollizoCrossCheck(
          primary.cleaned,
          secondary?.cleaned || null,
          primary.model,
          secondary?.model || null,
        );
        console.log(`[cubicar-madera:${requestId}] rollizos completados; lecturas=${successfulRollizoRuns.length}; ms=${Date.now() - startedAt}`);
        return jsonResponse({
          ...crossChecked,
          foto_valida: true,
          modelo: secondary ? `${primary.model} + ${secondary.model}` : primary.model,
          request_id: requestId,
          version: CUBICADOR_VERSION,
        });
      }

      const cleaned = sanitizeGeometricResult(primaryAttempt.data);
      const cleanedMeasures = asRecord(asRecord(cleaned).medidas);
      const hasDetection = [
        cleanedMeasures.largo_m,
        cleanedMeasures.ancho_cm,
        cleanedMeasures.espesor_cm,
        cleanedMeasures.alto_cm,
        cleanedMeasures.diametro_inicial_cm,
        cleanedMeasures.diametro_final_cm,
      ].some((value) => positiveNumberOrNull(value) !== null);
      if (!hasDetection) {
        throw new HttpError(422, "La IA no pudo leer ninguna medida visible. Incluye una huincha en el mismo plano y repite la fotografía.");
      }
      console.log(`[cubicar-madera:${requestId}] completada; modelo=${primaryModel}; ms=${Date.now() - startedAt}`);
      return jsonResponse({ ...cleaned, modelo: primaryModel, request_id: requestId, version: CUBICADOR_VERSION });
    }

    const providerStatus = lastAttempt?.status === 429
      ? 429
      : lastAttempt?.status === 504
        ? 504
        : 502;
    const providerMessage = lastAttempt?.status === 429
      ? "La cuota de IA está temporalmente agotada. Las fotos siguen disponibles; intenta más tarde o ingresa los números manualmente."
      : lastAttempt?.status === 504
        ? "La lectura con Gemini 3.6 tardó demasiado. Detuvimos el intento para no hacerte esperar; la foto sigue guardada y puedes reintentar."
        : lastAttempt?.message || "No fue posible completar la lectura de las fotografías.";
    throw new HttpError(providerStatus, providerMessage);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = errorMessage(error);
    console.error(`[cubicar-madera:${requestId}] error; status=${status}; ms=${Date.now() - startedAt}; mensaje=${message}`);
    return jsonResponse({ error: message, request_id: requestId, version: CUBICADOR_VERSION }, status);
  }
});
