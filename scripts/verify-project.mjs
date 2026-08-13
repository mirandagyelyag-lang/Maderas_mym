import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mustExist = [
  "src/App.jsx",
  "src/components/Layout.jsx",
  "src/components/MobileDock.jsx",
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

// Este verificador corre dentro de la carpeta LOCAL. Por eso .env, dist o .vercel
// pueden existir aquí. Lo importante es que Git ignore las credenciales.
const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
assert.match(gitignore, /(^|\n)\.env(\n|$)/, ".env debe estar protegido por .gitignore");
assert.match(gitignore, /\.env(?:\.local|\.\*)/, ".env.local debe quedar cubierto por .gitignore");

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

console.log("Proyecto V12 verificado: configuración local protegida · navegación móvil · UI unificada.");
