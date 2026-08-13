import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calculateJasTotal,
  calculateJasVolume,
  normalizeJasDiameter,
} from "../src/lib/jasCalculator.js";
import { evaluateImageMetrics } from "../src/lib/imageQuality.js";

assert.equal(normalizeJasDiameter(27), 26, "JAS debe bajar 27 cm al par 26");
assert.equal(normalizeJasDiameter(13.9), 13, "Bajo 14 cm debe bajar al entero");
assert.equal(calculateJasVolume(26, 3.3), 0.216);
assert.equal(calculateJasVolume(28, 3.3), 0.251);
assert.equal(calculateJasVolume(38, 3.3), 0.462);
assert.equal(calculateJasVolume(46, 3.3), 0.677);

const empresaRows = [
  { diametro: 26, cantidad: 4 },
  { diametro: 28, cantidad: 5 },
  { diametro: 38, cantidad: 2 },
  { diametro: 46, cantidad: 1 },
];
assert.equal(calculateJasTotal(empresaRows, 3.3), 3.72, "12 rollizos deben totalizar 3,720 m³");

const goodPhoto = evaluateImageMetrics(
  { width: 1600, height: 1200, brightness: 120, contrast: 48, sharpness: 19, redPixelRatio: .01 },
  { requireRedMarks: true },
);
assert.equal(goodPhoto.level, "good");
assert.equal(goodPhoto.canAnalyze, true);
const unusablePhoto = evaluateImageMetrics(
  { width: 1600, height: 1200, brightness: 20, contrast: 10, sharpness: 3, redPixelRatio: 0 },
  { requireRedMarks: true },
);
assert.equal(unusablePhoto.level, "bad");
assert.equal(unusablePhoto.canAnalyze, false, "Una foto técnicamente inutilizable debe bloquear la llamada de IA");

const [cubicadorSource, qualitySource, edgeSource, packageSource] = await Promise.all([
  readFile(new URL("../src/pages/Cubicador.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/imageQuality.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/cubicar-madera/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

assert.match(packageSource, /"version": "12\.1\.0"/, "El proyecto debe informar V12.1");
assert.match(cubicadorSource, /CUBICADOR_VERSION = "12\.1\.0"/, "El cliente debe informar V12.1");
assert.match(edgeSource, /CUBICADOR_VERSION = "12\.1\.0"/, "La Edge Function debe informar V12.1");

assert.match(cubicadorSource, /accept="image\/jpeg" capture="environment"/, "Debe abrir la cámara trasera nativa");
assert.match(cubicadorSource, /2200 \/ Math\.max\(image\.naturalWidth, image\.naturalHeight\)/, "Debe conservar detalle de la fotografía");
assert.match(cubicadorSource, /nextImages\.length === requiredPhotos && !technicalBlock/, "Debe evitar gastar IA en una foto técnicamente inutilizable");
assert.match(cubicadorSource, /Foto nítida/, "La UI debe hablar de nitidez y no presentar 100 como validación semántica");
assert.doesNotMatch(cubicadorSource, /quality\.score/, "El badge no debe mostrar un puntaje que parezca aprobación del contenido");
assert.match(cubicadorSource, /clientTimeoutMs = mode === "troncos" \? 34_000 : 28_000/, "El cliente debe cortar una espera anormal sin acercarse a un minuto");
assert.match(cubicadorSource, /Afinando una lectura dudosa/, "La UI debe explicar que la segunda lectura es condicional");
assert.match(qualitySource, /canAnalyze: !severe/, "La calidad técnica grave debe poder bloquear el análisis");

assert.match(edgeSource, /gemini-3\.6-flash/, "Gemini 3.6 Flash debe ser el modelo principal por defecto");
assert.match(edgeSource, /GEMINI_CUBICADOR_MODEL/, "El modelo del cubicador debe tener un override opcional propio");
assert.doesNotMatch(edgeSource, /gemini-3\.5-flash-lite/, "V12.1 no debe volver a Flash-Lite en el camino normal");
assert.match(edgeSource, /thinkingConfig: \{ thinkingLevel: "minimal" \}/, "Gemini 3.6 debe usar thinking minimal para bajar latencia");
assert.match(edgeSource, /temperature: 0/, "La transcripción debe ser determinista");
assert.match(edgeSource, /foto_valida/, "La respuesta debe validar semánticamente la fotografía");
assert.match(edgeSource, /EXTREMOS CORTADOS/, "El prompt debe exigir extremos cortados de rollizos");
assert.match(edgeSource, /Un poste vertical visto principalmente de lado/, "El prompt debe rechazar explícitamente el falso positivo observado");
assert.match(edgeSource, /ve_extremos_cortados/, "La validación semántica debe comprobar caras de corte");
assert.match(edgeSource, /marcas_numericas_en_extremos/, "La validación semántica debe exigir números sobre las caras de corte");
assert.match(edgeSource, /vista_lateral_dominante/, "La validación semántica debe detectar vistas laterales dominantes");
assert.match(edgeSource, /sectorSemanticallyValid/, "El servidor debe verificar los criterios y no confiar solo en foto_valida");
assert.match(edgeSource, /needsSecondCheck/, "La segunda lectura debe ejecutarse solo cuando haga falta");
assert.match(edgeSource, /primaryTimeoutMs[\s\S]*14_000/, "Una foto de rollizo con Gemini 3.6 debe tener timeout acotado");
assert.match(edgeSource, /verifierModel[\s\S]*10_000/, "La verificación dudosa también debe tener timeout acotado");
assert.match(edgeSource, /Repite la foto mostrando de frente las caras circulares u ovaladas de corte/, "Una escena incorrecta debe rechazarse con una instrucción clara");
assert.match(edgeSource, /responseFormat[\s\S]*mimeType: "APPLICATION_JSON"[\s\S]*schema: responseSchema/, "Debe conservar salida JSON estructurada");

console.log("Cubicador V12.1 verificado: Gemini 3.6 · validación semántica estricta · una llamada normal · segunda solo si hay dudas · 12 rollizos = 3,720 m³.");
