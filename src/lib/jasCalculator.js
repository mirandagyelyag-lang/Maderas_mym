const toPositiveNumber = (value) =>
  Math.max(0, Number(String(value ?? "").replace(",", ".")) || 0);

// Regla usada por la tabla JAS física de Maderas M&M:
// bajo 14 cm baja al entero; desde 14 cm baja al par inferior.
export function normalizeJasDiameter(diameterCm) {
  const diameter = toPositiveNumber(diameterCm);
  if (diameter < 14) return Math.floor(diameter);
  return Math.floor(diameter / 2) * 2;
}

export function calculateJasVolume(diameterCm, lengthM) {
  const inputDiameter = toPositiveNumber(diameterCm);
  const inputLength = toPositiveNumber(lengthM);
  if (inputDiameter <= 0 || inputLength <= 0) return 0;

  const diameter = normalizeJasDiameter(inputDiameter);
  // La tabla comercial de la empresa usa la columna 3,2 para rollizos de 3,3 m.
  const tableLength = Math.abs(inputLength - 3.3) < 0.01 ? 3.2 : inputLength;
  const rawVolume = inputLength < 6
    ? (diameter ** 2 * tableLength) / 10000
    : ((diameter + ((Math.floor(inputLength) - 4) / 2)) ** 2 * inputLength) / 10000;

  // JAS redondea el volumen unitario a tres decimales antes de multiplicar.
  return Math.round((rawVolume + Number.EPSILON) * 1000) / 1000;
}

export function calculateJasTotal(rows, lengthM) {
  const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const quantity = Math.max(0, Math.floor(toPositiveNumber(row?.cantidad)));
    return sum + calculateJasVolume(row?.diametro, lengthM) * quantity;
  }, 0);
  return Math.round((total + Number.EPSILON) * 1_000_000) / 1_000_000;
}
