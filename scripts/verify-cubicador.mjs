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

assert.equal(
  evaluateImageMetrics({ width: 1600, height: 1200, brightness: 120, contrast: 48, sharpness: 19, redPixelRatio: .01 }, { requireRedMarks: true }).level,
  "good",
);
assert.equal(
  evaluateImageMetrics({ width: 1600, height: 1200, brightness: 20, contrast: 10, sharpness: 3, redPixelRatio: 0 }, { requireRedMarks: true }).level,
  "bad",
);

const [cubicadorSource, cameraCss, mobileCss, qualitySource, mobileHook, edgeSource, pwaSource, packageSource] = await Promise.all([
  readFile(new URL("../src/pages/Cubicador.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/cubicador-enhancements.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/cubicador-mobile.css", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/imageQuality.js", import.meta.url), "utf8"),
  readFile(new URL("../src/hooks/use-mobile.jsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/cubicar-madera/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

assert.match(packageSource, /"version": "11\.0\.0"/, "El proyecto debe informar V11");
assert.match(cubicadorSource, /CUBICADOR_VERSION = "11\.0\.0"/, "El cliente debe informar V11");
assert.match(edgeSource, /CUBICADOR_VERSION = "11\.0\.0"/, "La Edge Function debe informar V11");

assert.match(cubicadorSource, /accept="image\/jpeg" capture="environment"/, "Debe abrir la cámara trasera nativa");
assert.doesNotMatch(cubicadorSource, /inputRef\.current|setTimeout\([\s\S]{0,120}?\.click\(/, "La cámara no debe depender de click() programático");
assert.match(cubicadorSource, /import\("heic2any"\)/, "Debe convertir HEIC/HEIF");
assert.match(packageSource, /"heic2any"\s*:/, "Debe incluir heic2any");
assert.match(cubicadorSource, /2200 \/ Math\.max\(image\.naturalWidth, image\.naturalHeight\)/, "Debe conservar detalle de la fotografía");
assert.match(cubicadorSource, /nextImages\.length === requiredPhotos[\s\S]{0,220}?analyze\(nextImages, nextQualities\)/, "La IA debe arrancar sola al completar las fotos");
assert.doesNotMatch(cubicadorSource, /PhotoReviewModal|cropViewportDataUrl|Usar foto completa|<Crop \/>/, "No debe quedar el recortador obsoleto en el flujo");
assert.match(cubicadorSource, /Al volver de la cámara, la IA comenzará a leerla automáticamente/, "La guía debe explicar el flujo directo");

assert.match(cubicadorSource, /verify: \["4", "Comprobando lectura"/, "Debe mostrar la etapa de doble lectura");
assert.match(cubicadorSource, /CrossCheckStatus/, "Debe mostrar la consistencia de las lecturas");
assert.match(cubicadorSource, /clientTimeoutMs = mode === "troncos" \? 68_000 : 55_000/, "Rollizos deben permitir tiempo suficiente para dos lecturas");
assert.match(cubicadorSource, /DiagnosticsModal/, "Debe incluir diagnóstico desde el teléfono");
assert.match(cubicadorSource, /hasDetectedMeasurements\(mode, measured\)/, "No debe aceptar una respuesta sin medidas");
assert.match(cubicadorSource, /La IA no entregó los datos[\s\S]*Reintentar análisis con estas fotos/, "Un fallo debe conservar las fotos y ofrecer reintento");
assert.match(cubicadorSource, /step === 2 && images\.length !== requiredPhotos/, "No debe avanzar con fotografías incompletas");
assert.doesNotMatch(cubicadorSource, /<strong>Medición manual<\/strong>|Ingresar medidas/, "La foto fallida no debe ocultarse tras un flujo manual");

assert.match(qualitySource, /brightness[\s\S]*contrast[\s\S]*sharpness/, "Debe revisar luz, contraste y nitidez");
assert.match(cameraCss, /\.cube-capture-button input\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/, "El input nativo debe cubrir todo el botón");
assert.match(mobileCss, /\.cube-page\s*\{[\s\S]*?width:\s*100dvw;/, "El cubicador debe ocupar el ancho móvil");
assert.match(mobileHook, /pointer:\s*coarse/, "Android ancho debe conservar layout móvil");

assert.match(edgeSource, /MEDIA_RESOLUTION_HIGH/, "Gemini debe usar resolución visual alta");
assert.match(edgeSource, /responseFormat[\s\S]*mimeType: "APPLICATION_JSON"[\s\S]*schema: responseSchema/, "Gemini debe usar JSON estructurado con el enum REST actual");
assert.match(edgeSource, /successfulRollizoRuns\.length >= 2/, "Rollizos deben intentar dos lecturas independientes");
assert.match(edgeSource, /attachRollizoCrossCheck/, "Las dos lecturas deben compararse antes de responder");
assert.match(edgeSource, /primera_lectura[\s\S]*segunda_lectura/, "Debe conservar discrepancias por diámetro");
assert.match(edgeSource, /"gemini-3\.6-flash", "gemini-3\.5-flash"/, "Debe usar Gemini 3.6 con respaldo 3.5");
assert.match(edgeSource, /accion === "diagnostico"/, "La función debe exponer diagnóstico autenticado");
assert.match(edgeSource, /confianza: rowConfidence/, "Cada diámetro debe conservar confianza");
assert.match(edgeSource, /if \(!hasDetection\)/, "Debe rechazar lecturas vacías");
assert.match(pwaSource, /onNeedRefresh[\s\S]*?updateSW\(true\)/, "La PWA debe actualizarse automáticamente");

console.log("Cubicador V11 verificado: cámara → IA directa · visión alta · doble lectura · control de discrepancias · 12 rollizos = 3,720 m³.");
