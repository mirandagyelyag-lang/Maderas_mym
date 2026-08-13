import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyEntries = [
  "Maderas-MM-Cubicador-ARREGLADO",
  "cubicar-madera-resistente",
  "maderas-mm-cubicador-final",
  "maderas-mm-consenso",
  "cubicador-hotfix",
  "cubicar-madera-listo",
  "cubicador-diagnostico-supabase",
  "cubicador-android-v3",
  "maderas-mm-multiusuario",
  "velvet-stories",
  "base44",
  "dist",
  "dev-dist",
  ".vercel",
  "ACTUALIZACION-6-MEJORAS.md",
  "LEEME-PRIMERO-CUBICADOR.md",
  "LEEME-V10-CAMARA-IA-DIRECTA.txt",
  "LEEME-V5.txt",
  "LEEME-V7-IA-ANDROID.txt",
  "LEEME-V8-BARRACA.txt",
  "LEEME-V9-IA-OBLIGATORIA.txt",
  "icon-proposals.png",
  "icon-proposals.svg",
  "wood-yard-concept.png",
  "wood-yard-concept.svg",
  "src/components/BarcodeScannerDialog.jsx",
  "src/lib/query-client.js",
  "src/pages/Bienvenida.jsx",
  "src/pages/ForgotPassword.jsx",
  "src/pages/Login.jsx",
  "src/pages/Register.jsx",
  "src/pages/ResetPassword.jsx",
  "src/pages/Stock.jsx",
  "src/components/AuthLayout.jsx",
  "src/components/GoogleIcon.jsx",
  "src/components/UserNotRegisteredError.jsx",
  "src/components/ScrollToTop.jsx",
];

for (const entry of legacyEntries) {
  await rm(path.join(root, entry), { recursive: true, force: true });
}

console.log("Limpieza V11 completada. Se conservaron .env, .env.local, .git y tus datos locales.");
