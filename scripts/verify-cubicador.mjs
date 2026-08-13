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

assert.equal(
  calculateJasTotal(empresaRows, 3.3),
  3.72,
  "El caso real de 12 rollizos debe totalizar 3,720 m³",
);

assert.equal(evaluateImageMetrics({ width: 1600, height: 1200, brightness: 120, contrast: 48, sharpness: 19, redPixelRatio: .01 }, { requireRedMarks: true }).level, "good", "Una foto nítida y bien iluminada debe aprobar el control local");
assert.equal(evaluateImageMetrics({ width: 1600, height: 1200, brightness: 20, contrast: 10, sharpness: 3, redPixelRatio: 0 }, { requireRedMarks: true }).level, "bad", "Una foto oscura y movida debe recomendar repetición");

const [cubicadorSource, cameraCss, mobileCss, v8Css, qualitySource, mobileHook, edgeSource, pwaSource, packageSource] = await Promise.all([
  readFile(new URL("../src/pages/Cubicador.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/cubicador-enhancements.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/cubicador-mobile.css", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/cubicador-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/imageQuality.js", import.meta.url), "utf8"),
  readFile(new URL("../src/hooks/use-mobile.jsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/cubicar-madera/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

assert.match(cubicadorSource, /accept="image\/jpeg" capture="environment"/, "Debe solicitar una fotografía JPEG a la cámara trasera nativa");
assert.doesNotMatch(cubicadorSource, /inputRef\.current|setTimeout\([\s\S]{0,120}?\.click\(/, "La cámara Android no debe depender de click() programático");
assert.match(cubicadorSource, /import\("heic2any"\)/, "Debe convertir las fotografías HEIC/HEIF de Android");
assert.match(packageSource, /"heic2any"\s*:/, "Debe incluir el decodificador HEIC/HEIF");
assert.match(cubicadorSource, /nextImages\.length === requiredPhotos[\s\S]{0,180}?analyze\(nextImages, nextQualities\)/, "Debe analizar automáticamente después de aceptar la última fotografía");
assert.doesNotMatch(cubicadorSource, /Vista previa de la toma|arrastra el dedo formando un cuadro/i, "La interfaz no debe mostrar el recortador antiguo");
assert.match(cubicadorSource, /cube-crop-viewport[\s\S]*?Mueve la foto dentro del marco/, "El recortador móvil debe mover la foto bajo un marco fijo");
assert.match(cubicadorSource, /type="range"[\s\S]*?Zoom de la fotografía/, "El recortador móvil debe incluir zoom táctil");
assert.match(cubicadorSource, /Usar foto completa/, "La foto completa debe ser la acción principal y el recorte opcional");
assert.match(cubicadorSource, /<Crop \/> Ajustar/, "El ajuste debe ser una opción explícita");
assert.match(cubicadorSource, /AnalysisProgress/, "Debe mostrar progreso real del análisis");
assert.match(cubicadorSource, /DiagnosticsModal/, "Debe incluir diagnóstico desde el teléfono");
assert.match(cubicadorSource, /hasDetectedMeasurements\(mode, measured\)/, "No debe aceptar una respuesta de IA sin datos medidos");
assert.match(cubicadorSource, /La IA no entregó los datos[\s\S]*Reintentar análisis con estas fotos/, "Una lectura fallida debe conservar las fotos y ofrecer reintento");
assert.match(cubicadorSource, /step === 2 && images\.length !== requiredPhotos/, "No debe permitir avanzar desde fotografías incompletas");
assert.match(cubicadorSource, /if \(!analysis\) \{ setError\("Primero debes obtener una lectura de la IA\."\)/, "El cálculo debe exigir una respuesta de IA");
assert.doesNotMatch(cubicadorSource, /<strong>Medición manual<\/strong>|Ingresar medidas/, "Una foto fallida no debe desembocar silenciosamente en medición manual");
assert.match(qualitySource, /brightness[\s\S]*contrast[\s\S]*sharpness/, "Debe revisar luz, contraste y nitidez antes de enviar");
assert.match(v8Css, /cube-full-preview[\s\S]*cube-analysis-progress[\s\S]*cube-diagnostics/, "La interfaz V8 debe incluir vista completa, progreso y diagnóstico");
assert.match(cameraCss, /\.cube-capture-button input\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/, "El input nativo debe cubrir todo el botón");
assert.match(mobileCss, /\.cube-page\s*\{[\s\S]*?width:\s*100dvw;/, "El cubicador móvil debe ocupar todo el ancho visible");
assert.match(mobileCss, /\.cube-capture-choice\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/, "Las opciones de fotografía deben caber en una fila móvil");
assert.match(cubicadorSource, /rollizoCapture === "pila"[\s\S]{0,120}?<CaptureGuide/, "La guía adicional sólo debe aparecer para la pila de cuatro fotos");
assert.doesNotMatch(cubicadorSource, /Continuar sin fotos/, "La acción manual debe decir claramente que permite ingresar medidas");
assert.match(mobileHook, /pointer:\s*coarse/, "Los Android de pantalla ancha deben conservar el layout móvil");
assert.doesNotMatch(edgeSource, /corridas|Análisis de consenso|for\s*\(let\s+corrida/i, "La Edge Function no debe ejecutar tres análisis");
assert.match(edgeSource, /30_000/, "La solicitud principal debe tener límite de tiempo");
assert.match(edgeSource, /"gemini-3\.6-flash", "gemini-3\.5-flash"/, "Debe usar Gemini 3.6 con respaldo 3.5 para visión");
assert.match(edgeSource, /accion === "diagnostico"/, "La Edge Function debe exponer diagnóstico autenticado");
assert.match(edgeSource, /confianza: rowConfidence/, "Cada lectura de diámetro debe conservar su confianza");
assert.match(edgeSource, /CUBICADOR_VERSION = "9\.0\.0"/, "Cliente y función deben informar la versión V9");
assert.match(edgeSource, /if \(!hasDetection\)[\s\S]*new HttpError\([\s\S]*422/, "La función debe rechazar respuestas sin ninguna lectura");
assert.match(pwaSource, /onNeedRefresh[\s\S]*?updateSW\(true\)/, "La PWA debe aplicar la versión nueva automáticamente");

console.log("Cubicador V9 verificado: la foto exige datos IA · reintento sin perder fotos · 12 rollizos = 3,720 m³.");
