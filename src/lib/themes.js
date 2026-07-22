export const THEME_STORAGE_KEY = "tema_aplicacion";

export const THEMES = [
  {
    id: "oscuro-mm",
    nombre: "Oscuro M&M",
    descripcion: "Nogal oscuro, oro y profundidad",
    preview: ["#171311", "#211b18", "#c3a579"],
    atmosfera: "wood",
  },
  {
    id: "claro-minimal",
    nombre: "Claro minimal",
    descripcion: "Cristal blanco, precisión y luz",
    preview: ["#f7f7f7", "#ffffff", "#9b7951"],
    atmosfera: "light",
  },
  {
    id: "madera-pastel",
    nombre: "Madera pastel",
    descripcion: "Crema, roble suave y calidez",
    preview: ["#f3e8dc", "#fffaf4", "#a87955"],
    atmosfera: "wood",
  },
  {
    id: "rosa-pastel",
    nombre: "Rosa pastel",
    descripcion: "Pétalos, vidrio rosado y brillo",
    preview: ["#f8e9ef", "#fff9fb", "#b76e89"],
    atmosfera: "petals",
  },
  {
    id: "celeste-pastel",
    nombre: "Celeste pastel",
    descripcion: "Cristal azul y partículas de luz",
    preview: ["#e7f2f7", "#f9fdff", "#5b8fa8"],
    atmosfera: "light",
  },
  {
    id: "lavanda-pastel",
    nombre: "Lavanda",
    descripcion: "Neblina violeta y pequeñas estrellas",
    preview: ["#eee9f7", "#fcfaff", "#8069a6"],
    atmosfera: "stars",
  },
  {
    id: "verde-salvia",
    nombre: "Verde salvia",
    descripcion: "Botánica sutil, calma y frescura",
    preview: ["#e8eee8", "#fbfdf9", "#6e8b74"],
    atmosfera: "leaves",
  },
  {
    id: "arena-calida",
    nombre: "Arena cálida",
    descripcion: "Luz dorada, arena fina y lujo",
    preview: ["#f3ead7", "#fffaf0", "#b08245"],
    atmosfera: "sand",
  },
  {
    id: "grafito",
    nombre: "Grafito",
    descripcion: "Metal, vidrio oscuro y precisión",
    preview: ["#17181b", "#22242a", "#a9b1bd"],
    atmosfera: "metal",
  },
];

export function obtenerTema(themeId) {
  return THEMES.find((tema) => tema.id === themeId) || THEMES[0];
}

export function aplicarTema(themeId = "oscuro-mm") {
  const temaValido = obtenerTema(themeId).id;

  document.documentElement.dataset.theme = temaValido;
  document.documentElement.classList.toggle(
    "dark",
    ["oscuro-mm", "grafito"].includes(temaValido)
  );

  localStorage.setItem(THEME_STORAGE_KEY, temaValido);

  window.dispatchEvent(
    new CustomEvent("tema-aplicacion-actualizado", {
      detail: {
        themeId: temaValido,
        theme: obtenerTema(temaValido),
      },
    })
  );

  return temaValido;
}

export function obtenerTemaGuardado() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "oscuro-mm";
}
