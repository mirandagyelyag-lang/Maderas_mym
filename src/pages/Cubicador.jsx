import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check,
  CheckCircle2, CircleDot, History, ImagePlus, Layers3,
  Loader2, PackageOpen, Ruler, Save, ScanLine, Sparkles,
  Trash2, Trees, X,
  Download, Plus, Minus,
  FileSpreadsheet, FileText, Printer,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { registrarActividad } from "@/lib/database";
import { eliminarCubicacion, getCubicaciones, getCubicacionesLocales, guardarCubicacion, subscribeCubicaciones } from "@/lib/cubicRepository";
import { calculateJasTotal, calculateJasVolume, normalizeJasDiameter } from "@/lib/jasCalculator";
import "@/styles/cubicador.css";
import "@/styles/cubicador-enhancements.css";
import "@/styles/cubicador-history.css";
import "@/styles/cubicador-mobile.css";

const ROLLIZO_SECTORS = ["Arriba izquierda", "Arriba derecha", "Abajo izquierda", "Abajo derecha"];
const STEPS = ["Tipo de madera", "Fotografías", "Medidas", "Resultado"];
const MODES = [
  { id: "tablas", label: "Tablas y vigas", description: "Madera dimensionada y piezas rectangulares", icon: Layers3, tag: "Largo × ancho × espesor" },
  { id: "postes", label: "Postes", description: "Piezas redondas de diámetro uniforme", icon: CircleDot, tag: "Largo × diámetro" },
  { id: "troncos", label: "Rollizos", description: "Pila con largo común y diámetros pintados", icon: Trees, tag: "Regla JAS" },
  { id: "paquetes", label: "Pilas o paquetes", description: "Volumen exterior y factor de apilado", icon: PackageOpen, tag: "Volumen apilado" },
];
const newJasRow = (diametro = "", cantidad = "1") => ({ id: crypto.randomUUID(), diametro: String(diametro ?? ""), cantidad: String(cantidad ?? "1") });
const EMPTY = { largo: "", ancho: "", espesor: "", cantidad: "1", diametroInicial: "", diametroFinal: "", alto: "", factorApilado: "85", diametros: [] };
const number = (value) => Math.max(0, Number(String(value || "").replace(",", ".")) || 0);
const formatVolume = (value) => Number(value || 0).toLocaleString("es-CL", { minimumFractionDigits: 3, maximumFractionDigits: 4 });

function calculateVolume(mode, values) {
  const length = number(values.largo);
  const quantity = Math.max(1, number(values.cantidad));
  if (mode === "tablas") return length * (number(values.ancho) / 100) * (number(values.espesor) / 100) * quantity;
  if (mode === "postes") return Math.PI * Math.pow(number(values.diametroInicial) / 200, 2) * length * quantity;
  if (mode === "troncos") return calculateJasTotal(values.diametros, length);
  return length * (number(values.ancho) / 100) * (number(values.alto) / 100) * (number(values.factorApilado) / 100);
}

const jasPieces = (values) => (values.diametros || []).reduce((total, row) => total + Math.floor(number(row.cantidad)), 0);

const isHighEfficiencyImage = (file) =>
  /image\/(?:hei[cf]|heic-sequence|heif-sequence)/i.test(file?.type || "") ||
  /\.hei[cf]$/i.test(file?.name || "");

async function androidImageBlob(file) {
  if (!isHighEfficiencyImage(file)) return file;

  try {
    const heicModule = await import("heic2any");
    const convertHeic = heicModule.default || heicModule;
    const converted = await convertHeic({ blob: file, toType: "image/jpeg", quality: 0.9 });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch (conversionError) {
    console.error("No se pudo convertir la fotografía HEIC/HEIF:", conversionError);
    throw new Error("Android guardó la foto en formato HEIC y no pudo convertirla. Abre Cámara > Ajustes > Formatos avanzados y desactiva “Fotos de alta eficiencia”; luego repite la foto.");
  }
}

async function fileToCompressedDataUrl(file) {
  const compatibleFile = await androidImageBlob(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(compatibleFile);
    image.onload = () => {
      try {
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("El teléfono no pudo preparar el editor de imagen.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      } catch (processingError) {
        reject(processingError);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Android entregó una fotografía que no se pudo abrir. Repite la toma; la cámara ahora está configurada para entregar JPEG."));
    };
    image.src = url;
  });
}

function cropViewportDataUrl(dataUrl, crop) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const viewportWidth = Math.max(1, crop.viewportWidth);
      const viewportHeight = Math.max(1, crop.viewportHeight);
      const baseScale = Math.max(viewportWidth / image.naturalWidth, viewportHeight / image.naturalHeight);
      const displayScale = baseScale * Math.max(1, crop.zoom);
      const displayWidth = image.naturalWidth * displayScale;
      const displayHeight = image.naturalHeight * displayScale;
      const imageLeft = (viewportWidth - displayWidth) / 2 + crop.offsetX;
      const imageTop = (viewportHeight - displayHeight) / 2 + crop.offsetY;
      const sourceX = Math.max(0, -imageLeft / displayScale);
      const sourceY = Math.max(0, -imageTop / displayScale);
      const sourceWidth = Math.min(image.naturalWidth - sourceX, viewportWidth / displayScale);
      const sourceHeight = Math.min(image.naturalHeight - sourceY, viewportHeight / displayScale);
      const outputScale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
      canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
      canvas.getContext("2d").drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => reject(new Error("No se pudo recortar la fotografía."));
    image.src = dataUrl;
  });
}

export default function Cubicador() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("tablas");
  const [values, setValues] = useState(EMPTY);
  const [images, setImages] = useState([]);
  const [rollizoCapture, setRollizoCapture] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [history, setHistory] = useState(getCubicacionesLocales);
  const [tab, setTab] = useState("nueva");
  const [analyzing, setAnalyzing] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const volume = useMemo(() => calculateVolume(mode, values), [mode, values]);
  const selectedMode = MODES.find((item) => item.id === mode);
  const requiredPhotos = mode === "troncos" ? (rollizoCapture === "individual" ? 1 : 4) : 1;
  const validation = useMemo(() => validateMeasurements(mode, values), [mode, values]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const rows = await getCubicaciones(); if (active) setHistory(rows); }
      catch (loadError) { console.error("No se pudieron sincronizar las cubicaciones:", loadError); }
    };
    load();
    const unsubscribe = subscribeCubicaciones(load);
    return () => { active = false; unsubscribe(); };
  }, []);

  const update = (field, value) => { setValues((current) => ({ ...current, [field]: value })); setConfirmed(false); };
  const changeMode = (nextMode) => { setMode(nextMode); setValues(EMPTY); setImages([]); setRollizoCapture(""); setPendingPhoto(null); setPendingPhotos([]); setAnalysis(null); setConfirmed(false); setError(""); };
  const addImages = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, requiredPhotos - images.length);
    if (!files.length) return;
    setError(""); setPreparingPhoto(true);
    try {
      const converted = await Promise.all(files.map(fileToCompressedDataUrl));
      setPendingPhoto(converted[0]);
      setPendingPhotos(converted.slice(1));
      setAnalysis(null); setConfirmed(false);
    } catch (imageError) { setError(imageError.message); }
    finally { setPreparingPhoto(false); }
    event.target.value = "";
  };

  const acceptReviewedPhoto = (photo) => {
    const nextImages = [...images, photo].slice(0, requiredPhotos);
    const [nextPhoto, ...remaining] = pendingPhotos;
    setImages(nextImages);
    setPendingPhoto(nextPhoto || null);
    setPendingPhotos(remaining);
    if (!nextPhoto && nextImages.length === requiredPhotos) {
      window.setTimeout(() => { void analyze(nextImages); }, 0);
    }
  };

  const repeatReviewedPhoto = () => {
    setPendingPhoto(null);
    setPendingPhotos([]);
    setError("La foto anterior se descartó. Toca “Abrir cámara” para repetirla.");
  };

  const analyze = async (selectedImages = images) => {
    const photos = Array.isArray(selectedImages) ? selectedImages : images;
    if (!photos.length) { setError("Agrega al menos una foto con una huincha visible."); return; }
    if (mode === "troncos" && !rollizoCapture) { setError("Indica si cubicarás un rollizo o una pila completa."); return; }
    if (mode === "troncos" && photos.length !== requiredPhotos) { setError(`Faltan ${requiredPhotos - photos.length} fotos para completar la medición.`); return; }
    setAnalyzing(true); setError(""); setAnalysis(null);
    try {
      const invokeRequest = supabase.functions.invoke("cubicar-madera", { body: { tipo: mode, imagenes: photos, modo_imagenes: mode === "troncos" && rollizoCapture === "pila" ? "cuadrantes_2x2" : "fotografias", largo_m: mode === "troncos" ? number(values.largo) || null : null } });
      let timeoutId;
      const timeoutRequest = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("El análisis superó 55 segundos. Las fotos siguen guardadas: intenta otra vez o continúa manualmente.")), 55_000);
      });
      const { data, error: invokeError } = await Promise.race([invokeRequest, timeoutRequest]);
      window.clearTimeout(timeoutId);
      if (invokeError) {
        let functionMessage = "";
        try {
          if (invokeError.context) {
            const functionBody = await invokeError.context.clone().json();
            const requestCode = functionBody?.request_id ? ` Código: ${String(functionBody.request_id).slice(0, 8)}.` : "";
            functionMessage = `${functionBody?.error || ""}${requestCode}`.trim();
          }
        } catch { /* La respuesta puede no contener JSON. */ }
        throw new Error(functionMessage || invokeError.message || "La función de análisis respondió con error.");
      }
      if (!data?.medidas) throw new Error(data?.error || "La IA no devolvió medidas válidas.");
      const measured = data.medidas;
      setValues((current) => ({ ...current, largo: measured.largo_m ?? current.largo, ancho: measured.ancho_cm ?? current.ancho, espesor: measured.espesor_cm ?? current.espesor, alto: measured.alto_cm ?? current.alto, cantidad: measured.cantidad ?? current.cantidad, diametroInicial: measured.diametro_inicial_cm ?? current.diametroInicial, diametroFinal: measured.diametro_final_cm ?? current.diametroFinal, diametros: mode === "troncos" && Array.isArray(measured.rollizos) ? measured.rollizos.filter((row) => number(row.diametro_cm) > 0 && number(row.cantidad) > 0).map((row) => newJasRow(row.diametro_cm, row.cantidad)) : current.diametros }));
      const counts = measured.total_extremos_visibles != null ? `Extremos visibles: ${measured.total_extremos_visibles}. Marcas leídas: ${measured.total_marcas_leidas ?? 0}. Requieren revisión: ${measured.no_legibles ?? 0}.` : "";
      setAnalysis({ ...data, observaciones: `${counts} ${data.observaciones || ""}`.trim() }); setStep(3);
    } catch (invokeError) {
      setError(invokeError?.message?.includes("Failed to send") ? "La función de IA todavía no está publicada en Supabase. Puedes continuar con medidas manuales." : invokeError.message || "No fue posible analizar las fotos.");
    } finally { setAnalyzing(false); }
  };

  const save = async () => {
    if (!confirmed || volume <= 0 || validation.length) return;
    const item = { id: crypto.randomUUID(), tipo: mode, tipoNombre: selectedMode?.label, medidas: values, volumen: volume, origen: analysis ? "ia_revisada" : "manual", confianza: analysis?.confianza ?? null, fecha: new Date().toISOString(), usuario: user?.name || "Usuario" };
    const next = [item, ...history].slice(0, 500);
    setHistory(next);
    try {
      const result = await guardarCubicacion(item);
      if (result.pendiente) setError("Guardada en este equipo; se sincronizará cuando vuelva la conexión.");
    } catch (saveError) { setError(saveError.message || "No se pudo guardar la cubicación."); return; }
    registrarActividad({ accion: "crear", modulo: "cubicador", entidadId: item.id, entidadNombre: item.tipoNombre, descripcion: `Cubicación guardada: ${formatVolume(volume)} m³`, datosDespues: item });
    setTab("historial");
  };
  const startNew = () => { setStep(1); setValues(EMPTY); setImages([]); setRollizoCapture(""); setPendingPhoto(null); setPendingPhotos([]); setAnalysis(null); setConfirmed(false); setError(""); setTab("nueva"); };
  const repeatLast = () => { setImages([]); setAnalysis(null); setConfirmed(false); setError(""); setStep(3); setTab("nueva"); };
  const sendTo = (destination) => {
    sessionStorage.setItem("mm_cubicacion_handoff", JSON.stringify({ tipo: mode, tipoNombre: selectedMode?.label, medidas: values, volumen: volume, fecha: new Date().toISOString() }));
    navigate(destination);
  };

  return (
    <div className="cube-page">
      <div className="cube-ambient cube-ambient-one" /><div className="cube-ambient cube-ambient-two" />
      <header className="cube-header">
        <div className="cube-title"><span><Sparkles /> Maderas M&M · Herramienta inteligente</span><h1>Cubicador de madera</h1><p>Una medición clara, guiada y revisable antes de guardar.</p></div>
        <div className="cube-tabs"><button className={tab === "nueva" ? "active" : ""} onClick={() => setTab("nueva")}><ScanLine /> Nueva cubicación</button><button className={tab === "tabla-jas" ? "active" : ""} onClick={() => setTab("tabla-jas")}><FileSpreadsheet /> Tabla JAS</button><button className={tab === "historial" ? "active" : ""} onClick={() => setTab("historial")}><History /> Historial <b>{history.length}</b></button></div>
      </header>

      {tab === "historial" ? <HistoryView items={history} onNew={startNew} onDelete={async (id) => { setHistory((current) => current.filter((item) => item.id !== id)); await eliminarCubicacion(id); }} /> : tab === "tabla-jas" ? <JasTableGenerator /> : (
        <main className="cube-workspace">
          <Progress step={step} setStep={setStep} />
          <section className="cube-stage">
            <div className="cube-stage-heading"><span>Paso {step} de 4</span><h2>{STEPS[step - 1]}</h2><p>{step === 1 ? "Elige la forma que más se parece a la madera." : step === 2 ? mode === "troncos" ? "Fotografía de frente todos los extremos y sus números pintados." : "La IA funciona mejor con varios ángulos y una escala visible." : step === 3 ? "Comprueba cada valor; tú siempre tienes la última palabra." : "Revisa el volumen final antes de incorporarlo al historial."}</p></div>

            {step === 1 && <div className="cube-mode-grid">{MODES.map((item) => { const Icon = item.icon; return <button key={item.id} className={mode === item.id ? `cube-mode cube-mode-${item.id} active` : `cube-mode cube-mode-${item.id}`} onClick={() => changeMode(item.id)}><span className="cube-mode-art"><Icon /><i /></span><span className="cube-mode-copy"><small>{item.tag}</small><strong>{item.label}</strong><p>{item.description}</p></span><span className="cube-select-mark"><Check /></span></button>; })}</div>}

            {step === 2 && <div className="cube-photo-layout">
              <div className="cube-photo-main">
                {mode === "troncos" && !images.length && <div className="cube-capture-choice">
                  <button type="button" className={rollizoCapture === "individual" ? "active" : ""} onClick={() => { setRollizoCapture("individual"); setImages([]); setError(""); }}>
                    <CircleDot /><span><strong>Un rollizo o pocos</strong><small>Una fotografía cercana</small></span>
                  </button>
                  <button type="button" className={rollizoCapture === "pila" ? "active" : ""} onClick={() => { setRollizoCapture("pila"); setImages([]); setError(""); }}>
                    <Trees /><span><strong>Pila completa</strong><small>Cuatro fotografías guiadas</small></span>
                  </button>
                </div>}
                {mode !== "troncos" || rollizoCapture ? <>
                  {mode === "troncos" && rollizoCapture === "pila" && images.length < requiredPhotos && <CaptureGuide mode={mode} captureMode={rollizoCapture} photoIndex={images.length} />}
                  <div className="cube-photo-grid">
                    {images.map((src, index) => <div className="cube-photo" key={`${src.slice(-18)}-${index}`}>
                      <img src={src} alt={mode === "troncos" && rollizoCapture === "pila" ? ROLLIZO_SECTORS[index] : `Foto ${index + 1}`} />
                      <button onClick={() => setImages((current) => mode === "troncos" && rollizoCapture === "pila" ? current.slice(0, index) : current.filter((_, currentIndex) => currentIndex !== index))} aria-label="Quitar foto"><X /></button>
                      <span>{mode === "troncos" && rollizoCapture === "pila" ? `${index + 1}. ${ROLLIZO_SECTORS[index]}` : `Foto ${index + 1}`}</span>
                    </div>)}
                    {images.length < requiredPhotos && <div className="cube-upload">
                      <span><Camera /></span>
                      <strong>{mode === "troncos" && rollizoCapture === "pila" ? `Foto ${images.length + 1} de 4 · ${ROLLIZO_SECTORS[images.length]}` : "Toma la fotografía"}</strong>
                      <p>{mode === "troncos" ? "Que los números rojos ocupen la mayor parte de la imagen." : "Incluye la huincha en el mismo plano de la madera."}</p>
                      <div className="cube-capture-actions">
                        <label className="cube-capture-button primary">
                          <Camera /><span><b>Abrir cámara</b><small>Cámara trasera de Android</small></span>
                          <input type="file" accept="image/jpeg" capture="environment" onChange={addImages} aria-label="Abrir cámara trasera" />
                        </label>
                        <label className="cube-capture-button secondary">
                          <ImagePlus /><span><b>Elegir de galería</b><small>{requiredPhotos - images.length > 1 ? "Puedes seleccionar varias" : "Selecciona una imagen"}</small></span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple={requiredPhotos - images.length > 1} onChange={addImages} aria-label="Elegir fotografías de la galería" />
                        </label>
                      </div>
                    </div>}
                  </div>
                  {preparingPhoto && <Status type="success" title="Preparando fotografía" text="Abriendo el editor para que puedas ajustar el encuadre." />}
                  {(analyzing || images.length === requiredPhotos) && <button type="button" className="cube-ai" disabled={analyzing || preparingPhoto} onClick={() => analyze()}>
                    {analyzing ? <><Loader2 className="cube-spin" /> Analizando… máximo 55 s</> : <><Sparkles /> {mode === "troncos" ? rollizoCapture === "pila" ? "Leer números de las 4 fotos" : "Leer número de la foto" : "Analizar fotografía"}</>}
                  </button>}
                </> : null}
                {error && <Status type="warning" title="No se pudo completar el análisis" text={error} />}
              </div>
              <aside className="cube-photo-guide"><span><Ruler /></span><small>Proceso guiado</small><h3>{mode === "troncos" ? rollizoCapture === "individual" ? "Una foto cercana y de frente" : "Fotografía la pila por sectores" : "Incluye una huincha visible"}</h3><p>{mode === "troncos" ? rollizoCapture === "individual" ? "Asegúrate de que el número rojo se vea grande, nítido y con buena luz." : "Acércate para que los números rojos se vean grandes. Evita repetir troncos entre fotos." : "Debe estar apoyada sobre la misma cara de la madera, sin quedar atrás ni delante del objeto."}</p><ol>{mode === "troncos" && rollizoCapture === "pila" ? ROLLIZO_SECTORS.map((sector, index) => <li key={sector}><b>0{index + 1}</b> {sector}</li>) : mode === "troncos" ? <><li><b>01</b> Número rojo completo</li><li><b>02</b> Teléfono de frente</li><li><b>03</b> Buena iluminación</li></> : <><li><b>01</b> Fotografía el frente</li><li><b>02</b> Agrega un costado</li><li><b>03</b> Muestra un extremo</li></>}</ol></aside>
            </div>}

            {step === 3 && <div className="cube-measure-layout"><div>{analysis ? <Status type="warning" title={`Lectura de IA sin validar · ${analysis.confianza}% de confianza`} text={analysis.observaciones || "Compara cada número con la fotografía antes de continuar."} /> : <div className="cube-manual-note"><Ruler /><div><strong>Medición manual</strong><p>Puedes completar los valores aunque no hayas usado fotografías.</p></div></div>}<MeasurementFields mode={mode} values={values} update={update} />{validation.length > 0 && <Status type="warning" title="Faltan datos válidos" text={validation.join(" · ")} />}</div><aside className="cube-current-type"><span className={`cube-mini-art cube-mode-${mode}`}><selectedMode.icon /></span><small>Estás cubicando</small><h3>{selectedMode?.label}</h3><p>{selectedMode?.tag}</p><button onClick={() => setStep(1)}>Cambiar tipo</button></aside></div>}

            {step === 4 && <div className="cube-result-layout"><div className="cube-result-hero"><span className="cube-result-label">Volumen total calculado</span><div><strong>{formatVolume(volume)}</strong><b>m³</b></div><p>{calculationText(mode, values)} · {mode === "troncos" ? "Regla JAS verificada" : "Cálculo geométrico"}</p><div className="cube-result-glow" /></div><div className="cube-result-detail"><span><small>Tipo de madera</small><strong>{selectedMode?.label}</strong></span><span><small>Cantidad</small><strong>{mode === "paquetes" ? "1 paquete" : `${mode === "troncos" ? jasPieces(values) : values.cantidad || 1} piezas`}</strong></span><span><small>Origen</small><strong>{analysis ? "Lectura IA revisada" : "Medición manual"}</strong></span><label className="cube-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><i><CheckCircle2 /></i><p><strong>{analysis ? "Comparé cada número con la foto" : "Revisé y confirmo estas medidas"}</strong><small>Solo después de esta confirmación se guardará el resultado.</small></p></label><button className="cube-save" disabled={!confirmed || volume <= 0 || validation.length > 0} onClick={save}><Save /> Guardar cubicación</button><div className="cube-result-links"><button onClick={() => sendTo("/inventario")}>Enviar a inventario</button><button onClick={() => sendTo("/cotizaciones")}>Crear cotización</button><button onClick={() => sendTo("/compras")}>Registrar compra</button><button onClick={repeatLast}>Repetir lote</button></div></div></div>}
          </section>

          <footer className="cube-actions"><button className="cube-back" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft /> Volver</button><span>{step < 4 ? "Tus datos se conservan mientras avanzas" : "Último paso"}</span>{step < 4 ? <button className="cube-next" onClick={() => setStep((current) => Math.min(4, current + 1))}>{step === 2 && !images.length ? "Ingresar medidas" : "Continuar"}<ArrowRight /></button> : <button className="cube-next subtle" onClick={() => setStep(3)}><ArrowLeft /> Editar medidas</button>}</footer>
        </main>
      )}
      {pendingPhoto && <PhotoReviewModal
        src={pendingPhoto}
        title={mode === "troncos" && rollizoCapture === "pila" ? ROLLIZO_SECTORS[images.length] : `Fotografía ${images.length + 1}`}
        onUse={acceptReviewedPhoto}
        onRepeat={repeatReviewedPhoto}
        onCancel={() => { setPendingPhoto(null); setPendingPhotos([]); }}
      />}
    </div>
  );
}

function CaptureGuide({ mode, captureMode, photoIndex }) {
  const isPile = mode === "troncos" && captureMode === "pila";
  return <div className="cube-shot-guide">
    <div className={isPile ? "cube-shot-progress" : "cube-shot-progress single"}>
      {isPile ? ROLLIZO_SECTORS.map((sector, index) => <span key={sector} className={index === photoIndex ? "active" : index < photoIndex ? "done" : ""}>{index < photoIndex ? <Check /> : index + 1}</span>) : <span className="active"><Camera /></span>}
    </div>
    <div><small>{isPile ? `Foto ${photoIndex + 1} de 4` : "Una fotografía"}</small><strong>{isPile ? ROLLIZO_SECTORS[Math.min(photoIndex, 3)] : "Encuadra la madera"}</strong><p>{isPile ? "No repitas rollizos de la foto anterior." : "Podrás mover y ampliar la foto antes de usarla."}</p></div>
  </div>;
}

function PhotoReviewModal({ src, title, onUse, onRepeat, onCancel }) {
  const viewportRef = useRef(null);
  const pointersRef = useRef(new Map());
  const dragRef = useRef(null);
  const pinchRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const rect = viewport.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const clampOffset = (nextOffset, nextZoom = zoomRef.current) => {
    if (!imageSize.width || !viewportSize.width) return { x: 0, y: 0 };
    const baseScale = Math.max(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height);
    const displayWidth = imageSize.width * baseScale * nextZoom;
    const displayHeight = imageSize.height * baseScale * nextZoom;
    const limitX = Math.max(0, (displayWidth - viewportSize.width) / 2);
    const limitY = Math.max(0, (displayHeight - viewportSize.height) / 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, nextOffset.x)),
      y: Math.max(-limitY, Math.min(limitY, nextOffset.y)),
    };
  };

  useEffect(() => {
    const nextOffset = clampOffset(offsetRef.current, zoomRef.current);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, [imageSize.width, imageSize.height, viewportSize.width, viewportSize.height]);

  const updateZoom = (nextValue) => {
    const nextZoom = Math.max(1, Math.min(4, Number(nextValue) || 1));
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    const nextOffset = clampOffset(offsetRef.current, nextZoom);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const beginGesture = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { x: event.clientX, y: event.clientY, offset: offsetRef.current };
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.hypot(second.x - first.x, second.y - first.y), zoom: zoomRef.current };
      dragRef.current = null;
    }
  };

  const moveGesture = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [first, second] = [...pointersRef.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      updateZoom(pinchRef.current.zoom * (distance / Math.max(1, pinchRef.current.distance)));
      return;
    }
    if (!dragRef.current) return;
    const nextOffset = clampOffset({
      x: dragRef.current.offset.x + event.clientX - dragRef.current.x,
      y: dragRef.current.offset.y + event.clientY - dragRef.current.y,
    });
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const endGesture = (event) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    const remaining = [...pointersRef.current.values()][0];
    dragRef.current = remaining ? { x: remaining.x, y: remaining.y, offset: offsetRef.current } : null;
  };

  const useCrop = async () => {
    if (!viewportSize.width || !imageSize.width) return;
    setCropping(true);
    try {
      onUse(await cropViewportDataUrl(src, {
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      }));
    }
    finally { setCropping(false); }
  };

  const baseScale = imageSize.width && viewportSize.width
    ? Math.max(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height)
    : 1;
  const displayedWidth = imageSize.width * baseScale * zoom;
  const displayedHeight = imageSize.height * baseScale * zoom;
  const imageStyle = imageSize.width ? {
    width: `${displayedWidth}px`,
    height: `${displayedHeight}px`,
    left: `${(viewportSize.width - displayedWidth) / 2 + offset.x}px`,
    top: `${(viewportSize.height - displayedHeight) / 2 + offset.y}px`,
  } : undefined;

  return <div className="cube-review-backdrop" role="dialog" aria-modal="true" aria-label="Ajustar fotografía">
    <div className="cube-review-modal">
      <header><div><small>Ajustar foto</small><h3>{title}</h3></div><button type="button" onClick={onCancel} aria-label="Cerrar"><X /></button></header>
      <p className="cube-review-help">Mueve la foto con un dedo. Pellizca o usa la barra para acercar.</p>
      <div
        ref={viewportRef}
        className="cube-crop-viewport"
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        <img
          src={src}
          alt={`Ajustar ${title}`}
          draggable="false"
          style={imageStyle}
          onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        />
        <div className="cube-fixed-crop-frame"><i /><i /><i /><i /></div>
        <span className="cube-crop-hint">Mueve la foto dentro del marco</span>
      </div>
      <div className="cube-crop-zoom">
        <button type="button" onClick={() => updateZoom(zoom - 0.2)} aria-label="Alejar"><Minus /></button>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(event) => updateZoom(event.target.value)} aria-label="Zoom de la fotografía" />
        <button type="button" onClick={() => updateZoom(zoom + 0.2)} aria-label="Acercar"><Plus /></button>
        <b>{Math.round(zoom * 100)}%</b>
      </div>
      <div className="cube-review-actions">
        <button type="button" className="secondary" onClick={onRepeat}><Camera /> Repetir</button>
        <button type="button" className="secondary" onClick={() => onUse(src)}><ScanLine /> Usar completa</button>
        <button type="button" className="primary" disabled={cropping || !imageSize.width} onClick={useCrop}>{cropping ? <Loader2 className="cube-spin" /> : <Check />} {cropping ? "Guardando…" : "Usar este encuadre"}</button>
      </div>
    </div>
  </div>;
}

function validateMeasurements(mode, values) {
  const errors = [];
  if (number(values.largo) <= 0) errors.push("Ingresa un largo mayor que cero");
  if ((mode === "tablas" || mode === "paquetes") && number(values.ancho) <= 0) errors.push("Ingresa el ancho");
  if (mode === "tablas" && number(values.espesor) <= 0) errors.push("Ingresa el espesor");
  if (mode === "paquetes" && number(values.alto) <= 0) errors.push("Ingresa el alto del paquete");
  if (mode === "paquetes" && (number(values.factorApilado) <= 0 || number(values.factorApilado) > 100)) errors.push("El factor de madera debe estar entre 1% y 100%");
  if (mode === "postes" && number(values.diametroInicial) <= 0) errors.push("Ingresa el diámetro");
  if (mode === "troncos" && !(values.diametros || []).some((row) => number(row.diametro) > 0 && Number.isInteger(number(row.cantidad)) && number(row.cantidad) > 0)) errors.push("Agrega al menos un diámetro y su cantidad");
  if (mode === "troncos" && (values.diametros || []).some((row) => number(row.diametro) <= 0 || !Number.isInteger(number(row.cantidad)) || number(row.cantidad) < 1)) errors.push("Revisa las filas de diámetros");
  if (mode !== "paquetes" && (!Number.isInteger(number(values.cantidad)) || number(values.cantidad) < 1)) errors.push("La cantidad debe ser un número entero");
  return errors;
}

function calculationText(mode, values) {
  if (mode === "tablas") return `${values.largo || 0} m × ${values.ancho || 0} cm × ${values.espesor || 0} cm × ${values.cantidad || 1} piezas`;
  if (mode === "postes") return `${values.largo || 0} m × Ø ${values.diametroInicial || 0} cm × ${values.cantidad || 1} piezas`;
  if (mode === "troncos") return `${values.largo || 0} m · ${jasPieces(values)} rollizos · ${(values.diametros || []).length} diámetros`;
  return `${values.largo || 0} m × ${values.ancho || 0} cm × ${values.alto || 0} cm × ${values.factorApilado || 0}%`;
}

function Progress({ step, setStep }) { return <nav className="cube-progress" aria-label="Progreso">{STEPS.map((label, index) => { const numberStep = index + 1; return <React.Fragment key={label}><button className={numberStep === step ? "active" : numberStep < step ? "done" : ""} onClick={() => numberStep <= step && setStep(numberStep)}><span>{numberStep < step ? <Check /> : numberStep}</span><small>{label}</small></button>{index < STEPS.length - 1 && <i className={numberStep < step ? "done" : ""} />}</React.Fragment>; })}</nav>; }
function Status({ type, title, text }) { return <div className={`cube-status ${type}`}>{type === "success" ? <CheckCircle2 /> : <AlertTriangle />}<div><strong>{title}</strong><p>{text}</p></div></div>; }
function Field({ label, value, unit, onChange }) { return <label className="cube-field"><span>{label}</span><div><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" /><b>{unit}</b></div></label>; }
function MeasurementFields({ mode, values, update }) {
  if (mode === "troncos") return <JasFields values={values} update={update} />;
  return <div className="cube-fields"><Field label="Largo" value={values.largo} unit="m" onChange={(value) => update("largo", value)} />{(mode === "tablas" || mode === "paquetes") && <Field label="Ancho" value={values.ancho} unit="cm" onChange={(value) => update("ancho", value)} />}{mode === "tablas" && <Field label="Espesor" value={values.espesor} unit="cm" onChange={(value) => update("espesor", value)} />}{mode === "paquetes" && <Field label="Alto del paquete" value={values.alto} unit="cm" onChange={(value) => update("alto", value)} />}{mode === "paquetes" && <Field label="Factor de madera" value={values.factorApilado} unit="%" onChange={(value) => update("factorApilado", value)} />}{mode === "postes" && <Field label="Diámetro" value={values.diametroInicial} unit="cm" onChange={(value) => update("diametroInicial", value)} />}{mode !== "paquetes" && <Field label="Cantidad" value={values.cantidad} unit="pzas" onChange={(value) => update("cantidad", value)} />}</div>;
}

function JasFields({ values, update }) {
  const rows = values.diametros || [];
  const changeRow = (id, field, value) => update("diametros", rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  const removeRow = (id) => update("diametros", rows.filter((row) => row.id !== id));
  return <div className="cube-jas">
    <div className="cube-jas-length"><span>Largo común de toda la pila</span><div>{[3.3, 4, 6, 8, 10, 12].map((length) => <button type="button" key={length} className={number(values.largo) === length ? "active" : ""} onClick={() => update("largo", String(length))}>{String(length).replace(".", ",")} m</button>)}</div></div>
    <div className="cube-jas-head"><div><strong>Diámetros pintados</strong><p>Agrupa los rollizos que tengan el mismo número.</p></div><button type="button" onClick={() => update("diametros", [...rows, newJasRow()])}><Plus /> Agregar diámetro</button></div>
    {rows.length ? <div className="cube-jas-rows">{rows.map((row) => <div className="cube-jas-row" key={row.id}><Field label="Diámetro pintado" value={row.diametro} unit="cm" onChange={(value) => changeRow(row.id, "diametro", value)} /><label className="cube-field"><span>Cantidad de rollizos</span><div className="cube-quantity"><button type="button" aria-label="Restar uno" onClick={() => changeRow(row.id, "cantidad", String(Math.max(1, Math.floor(number(row.cantidad)) - 1)))}><Minus /></button><input inputMode="numeric" value={row.cantidad} onChange={(event) => changeRow(row.id, "cantidad", event.target.value)} /><button type="button" aria-label="Sumar uno" onClick={() => changeRow(row.id, "cantidad", String(Math.floor(number(row.cantidad)) + 1))}><Plus /></button></div></label><div className="cube-jas-volume"><small>Subtotal · JAS Ø {normalizeJasDiameter(row.diametro) || 0}</small><strong>{formatVolume(calculateJasVolume(number(row.diametro), number(values.largo)) * Math.floor(number(row.cantidad)))} m³</strong></div><button type="button" className="cube-row-delete" onClick={() => removeRow(row.id)} aria-label="Eliminar diámetro"><Trash2 /></button></div>)}</div> : <button type="button" className="cube-jas-empty" onClick={() => update("diametros", [newJasRow()])}><Plus /><strong>Agregar el primer diámetro</strong><span>Ejemplo: Ø 34 cm · 8 rollizos</span></button>}
    <div className="cube-jas-total"><span>{jasPieces(values)} rollizos ingresados</span><strong>{formatVolume(calculateVolume("troncos", values))} m³</strong></div>
  </div>;
}

function getJasDiameters(minimum, maximum) {
  const min = Math.max(1, Math.floor(number(minimum)));
  const max = Math.max(min, Math.floor(number(maximum)));
  const result = [];
  for (let diameter = min; diameter <= max; diameter += 1) {
    const normalized = normalizeJasDiameter(diameter);
    if (normalized >= min && normalized <= max && !result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function JasTableGenerator() {
  const [minimum, setMinimum] = useState("6");
  const [maximum, setMaximum] = useState("64");
  const [lengths, setLengths] = useState([3.3, 4, 6, 8, 10, 12]);
  const diameters = useMemo(() => getJasDiameters(minimum, maximum), [minimum, maximum]);
  const toggleLength = (length) => setLengths((current) => current.includes(length) ? current.filter((item) => item !== length) : [...current, length].sort((a, b) => a - b));
  const rows = diameters.map((diameter) => ({ diameter, volumes: lengths.map((length) => calculateJasVolume(diameter, length)) }));
  return <section className="cube-jas-generator">
    <header className="cube-jas-generator-head"><div><span>Herramienta de terreno</span><h2>Generador de tabla JAS</h2><p>Crea una tabla propia usando el diámetro menor y los largos que trabaja Maderas M&M.</p></div><div className="cube-jas-tools"><button onClick={() => downloadJasCsv(rows, lengths)} disabled={!rows.length || !lengths.length}><FileSpreadsheet /> Excel</button><button onClick={() => downloadJasPdf(rows, lengths)} disabled={!rows.length || !lengths.length}><FileText /> PDF</button><button onClick={() => window.print()} disabled={!rows.length || !lengths.length}><Printer /> Imprimir</button></div></header>
    <div className="cube-jas-config"><div className="cube-jas-range"><Field label="Diámetro desde" value={minimum} unit="cm" onChange={setMinimum} /><Field label="Diámetro hasta" value={maximum} unit="cm" onChange={setMaximum} /></div><div className="cube-jas-length-picker"><span>Largos incluidos</span><div>{[3.3, 4, 6, 8, 10, 12].map((length) => <button key={length} className={lengths.includes(length) ? "active" : ""} onClick={() => toggleLength(length)}>{String(length).replace(".", ",")} m</button>)}</div></div><div className="cube-jas-rule"><CheckCircle2 /><p><strong>Redondeo JAS aplicado automáticamente</strong><span>Menos de 14 cm baja al entero; desde 14 cm baja al par inferior. Cada volumen unitario se redondea a 3 decimales.</span></p></div></div>
    {rows.length && lengths.length ? <div className="cube-jas-table-wrap"><table className="cube-jas-table"><thead><tr><th>Diámetro menor (cm)</th>{lengths.map((length) => <th key={length}>{String(length).replace(".", ",")} m</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.diameter}><th>{row.diameter}</th>{row.volumes.map((volume, index) => <td key={`${row.diameter}-${lengths[index]}`}>{volume.toLocaleString("es-CL", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>)}</tr>)}</tbody></table></div> : <div className="cube-jas-table-empty"><AlertTriangle /><strong>Selecciona al menos un largo y un rango válido.</strong></div>}
    <footer className="cube-jas-caption">Volumen unitario en metros cúbicos (m³) · Regla JAS · Revisa las medidas antes de una operación comercial.</footer>
  </section>;
}

function downloadJasCsv(rows, lengths) {
  const data = [["Diámetro menor (cm)", ...lengths.map((length) => `Largo ${String(length).replace(".", ",")} m`)], ...rows.map((row) => [row.diameter, ...row.volumes.map((volume) => volume.toFixed(3).replace(".", ","))])];
  const csv = data.map((row) => row.map((cell) => `"${cell}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `tabla-JAS-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

async function downloadJasPdf(rows, lengths) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12; const pageWidth = 297; const rowHeight = 7; const headerHeight = 9; const columns = lengths.length + 1; const columnWidth = (pageWidth - margin * 2) / columns;
  const drawHeader = () => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text("Maderas M&M · Tabla de cubicación JAS", margin, 12);
    pdf.setFontSize(8); pdf.setTextColor(90); pdf.text("Volumen unitario en m³ según diámetro menor y largo del rollizo", margin, 17); pdf.setTextColor(0);
    let y = 22; pdf.setFillColor(67, 43, 29); pdf.setTextColor(255); pdf.rect(margin, y, columnWidth * columns, headerHeight, "F"); pdf.setFontSize(7);
    ["Diámetro (cm)", ...lengths.map((length) => `${String(length).replace(".", ",")} m`)].forEach((label, index) => pdf.text(label, margin + index * columnWidth + columnWidth / 2, y + 5.8, { align: "center" })); pdf.setTextColor(0); return y + headerHeight;
  };
  let y = drawHeader();
  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > 198) { pdf.addPage(); y = drawHeader(); }
    if (rowIndex % 2 === 0) { pdf.setFillColor(247, 242, 237); pdf.rect(margin, y, columnWidth * columns, rowHeight, "F"); }
    pdf.setDrawColor(210); pdf.setFontSize(7); [row.diameter, ...row.volumes.map((volume) => volume.toFixed(3).replace(".", ","))].forEach((value, index) => { pdf.rect(margin + index * columnWidth, y, columnWidth, rowHeight); pdf.text(String(value), margin + index * columnWidth + columnWidth / 2, y + 4.8, { align: "center" }); }); y += rowHeight;
  });
  pdf.save(`tabla-JAS-${new Date().toISOString().slice(0, 10)}.pdf`);
}
function exportHistory(items) {
  const rows = [["Fecha", "Tipo", "Volumen m3", "Origen", "Confianza", "Usuario"], ...items.map((item) => [new Date(item.fecha).toLocaleString("es-CL"), item.tipoNombre, item.volumen, item.origen, item.confianza ?? "", item.usuario])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `cubicaciones-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}
function HistoryView({ items, onNew, onDelete }) { return <section className="cube-history"><div className="cube-history-head"><div><span>Registro sincronizado</span><h2>Cubicaciones guardadas</h2><p>Disponibles para los usuarios autorizados de la empresa.</p></div><div className="cube-history-buttons">{items.length > 0 && <button className="secondary" onClick={() => exportHistory(items)}><Download /> Exportar CSV</button>}<button onClick={onNew}><Camera /> Nueva cubicación</button></div></div>{items.length ? <div className="cube-history-list">{items.map((item) => <article key={item.id}><span><Trees /></span><div><strong>{item.tipoNombre}</strong><small>{new Date(item.fecha).toLocaleString("es-CL")} · {item.usuario}</small></div><b>{formatVolume(item.volumen)} m³</b><button onClick={() => onDelete(item.id)} aria-label="Eliminar"><Trash2 /></button></article>)}</div> : <div className="cube-empty"><History /><h3>Aún no hay cubicaciones</h3><p>La primera medición confirmada aparecerá aquí.</p><button onClick={onNew}>Comenzar ahora</button></div>}</section>; }
