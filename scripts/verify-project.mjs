import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mustExist = [
  "src/App.jsx",
  "src/components/Layout.jsx",
  "src/components/MobileDock.jsx",
  "src/components/AppSidebar.jsx",
  "src/pages/Dashboard.jsx",
  "src/pages/Inventario.jsx",
  "src/pages/Vender.jsx",
  "src/pages/Clientes.jsx",
  "src/pages/Cotizaciones.jsx",
  "src/pages/Cubicador.jsx",
  "supabase/functions/cubicar-madera/index.ts",
  "vite.config.js",
];
for (const rel of mustExist) await access(path.join(root, rel));

const forbiddenAtRoot = [
  ".vercel",
  "dist",
  "dev-dist",
  "velvet-stories",
  "Maderas-MM-Cubicador-ARREGLADO",
  "cubicar-madera-resistente",
  "maderas-mm-cubicador-final",
  "maderas-mm-consenso",
  "cubicador-hotfix",
  "cubicar-madera-listo",
  "cubicador-diagnostico-supabase",
  "cubicador-android-v3",
  "maderas-mm-multiusuario",
];
const rootEntries = new Set(await readdir(root));
for (const name of forbiddenAtRoot) {
  assert.equal(rootEntries.has(name), false, `El paquete limpio no debe incluir ${name}`);
}

const layout = await readFile(path.join(root, "src/components/Layout.jsx"), "utf8");
const dock = await readFile(path.join(root, "src/components/MobileDock.jsx"), "utf8");
const css = await readFile(path.join(root, "src/index.css"), "utf8");
assert.match(layout, /mobile-network/);
assert.match(layout, /<MobileDock/);
assert.match(dock, /Cubicar/);
assert.match(dock, /Vender/);
assert.match(css, /mobile-dock-inner/);
assert.match(css, /system-main-mobile/);
assert.match(css, /mm-card/);

console.log("Proyecto V11 verificado: estructura limpia · configuración local protegida · navegación móvil · UI unificada.");
