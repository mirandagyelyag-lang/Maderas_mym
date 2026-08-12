const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function evaluateImageMetrics(metrics, { requireRedMarks = false } = {}) {
  const { width = 0, height = 0, brightness = 0, contrast = 0, sharpness = 0, redPixelRatio = 0 } = metrics || {};
  const issues = [];
  let score = 100;

  if (Math.min(width, height) < 420) { issues.push("La foto tiene poca resolución"); score -= 28; }
  if (brightness < 32) { issues.push("Está demasiado oscura"); score -= 42; }
  else if (brightness < 55) { issues.push("Hay poca luz"); score -= 20; }
  if (brightness > 238) { issues.push("Está sobreexpuesta"); score -= 42; }
  else if (brightness > 220) { issues.push("Hay demasiada luz"); score -= 20; }
  if (contrast < 18) { issues.push("Le falta contraste"); score -= 24; }
  else if (contrast < 27) { issues.push("El contraste es bajo"); score -= 12; }
  if (sharpness < 6) { issues.push("Se ve muy movida o desenfocada"); score -= 42; }
  else if (sharpness < 11) { issues.push("Podría estar más nítida"); score -= 20; }
  if (requireRedMarks && redPixelRatio < 0.00025) { issues.push("No se distinguen números rojos"); score -= 20; }

  const severe = Math.min(width, height) < 300 || brightness < 32 || brightness > 238 || sharpness < 6;
  const level = severe ? "bad" : issues.length ? "warning" : "good";
  const title = level === "good" ? "Foto lista para analizar" : level === "bad" ? "Conviene repetir la foto" : "Foto utilizable, pero revísala";

  return { level, score: clamp(Math.round(score), 0, 100), title, issues, metrics, canAnalyze: true };
}

export async function assessImageQuality(dataUrl, options = {}) {
  const image = await new Promise((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("No se pudo revisar la calidad de la fotografía."));
    nextImage.src = dataUrl;
  });

  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El teléfono no pudo comprobar la calidad de la foto.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const luminance = new Float32Array(canvas.width * canvas.height);
  let sum = 0;
  let redPixels = 0;

  for (let pixel = 0, index = 0; pixel < pixels.length; pixel += 4, index += 1) {
    const red = pixels[pixel];
    const green = pixels[pixel + 1];
    const blue = pixels[pixel + 2];
    const light = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    luminance[index] = light;
    sum += light;
    if (red > 105 && red > green * 1.28 && red > blue * 1.22 && red - Math.max(green, blue) > 24) redPixels += 1;
  }

  const brightness = sum / luminance.length;
  let variance = 0;
  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = y * canvas.width + x;
      const difference = luminance[index] - brightness;
      variance += difference * difference;
      if (x > 0) { edgeSum += Math.abs(luminance[index] - luminance[index - 1]); edgeCount += 1; }
      if (y > 0) { edgeSum += Math.abs(luminance[index] - luminance[index - canvas.width]); edgeCount += 1; }
    }
  }

  return evaluateImageMetrics({
    width: image.naturalWidth,
    height: image.naturalHeight,
    brightness: Math.round(brightness * 10) / 10,
    contrast: Math.round(Math.sqrt(variance / luminance.length) * 10) / 10,
    sharpness: Math.round((edgeSum / Math.max(1, edgeCount)) * 10) / 10,
    redPixelRatio: Math.round((redPixels / luminance.length) * 100000) / 100000,
  }, options);
}
