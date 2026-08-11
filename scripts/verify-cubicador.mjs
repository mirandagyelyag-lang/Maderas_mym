import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calculateJasTotal,
  calculateJasVolume,
  normalizeJasDiameter,
} from "../src/lib/jasCalculator.js";

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

const [cubicadorSource, cameraCss, edgeSource, pwaSource] = await Promise.all([
  readFile(new URL("../src/pages/Cubicador.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/styles/cubicador-enhancements.css", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/cubicar-madera/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
]);

assert.match(cubicadorSource, /capture="environment"/, "Debe solicitar la cámara trasera nativa");
assert.doesNotMatch(cubicadorSource, /inputRef\.current|setTimeout\([\s\S]{0,120}?\.click\(/, "La cámara Android no debe depender de click() programático");
assert.doesNotMatch(cubicadorSource, /Vista previa de la toma|arrastra el dedo formando un cuadro/i, "La interfaz no debe mostrar el recortador antiguo");
assert.match(cubicadorSource, /cube-crop-viewport[\s\S]*?Mueve la foto dentro del marco/, "El recortador móvil debe mover la foto bajo un marco fijo");
assert.match(cubicadorSource, /type="range"[\s\S]*?Zoom de la fotografía/, "El recortador móvil debe incluir zoom táctil");
assert.match(cameraCss, /\.cube-capture-button input\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/, "El input nativo debe cubrir todo el botón");
assert.doesNotMatch(edgeSource, /corridas|Análisis de consenso|for\s*\(let\s+corrida/i, "La Edge Function no debe ejecutar tres análisis");
assert.match(edgeSource, /30_000/, "La solicitud principal debe tener límite de tiempo");
assert.match(pwaSource, /onNeedRefresh[\s\S]*?updateSW\(true\)/, "La PWA debe aplicar la versión nueva automáticamente");

console.log("Cubicador verificado: cámara Android nativa · un análisis · PWA actualizable · 12 rollizos = 3,720 m³.");
