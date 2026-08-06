import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check,
  CheckCircle2, CircleDot, History, ImagePlus, Layers3,
  Loader2, PackageOpen, Ruler, Save, ScanLine, Sparkles,
  Trash2, Trees, X,
  Download,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { registrarActividad } from "@/lib/database";
import { eliminarCubicacion, getCubicaciones, getCubicacionesLocales, guardarCubicacion, subscribeCubicaciones } from "@/lib/cubicRepository";
import "@/styles/cubicador.css";
import "@/styles/cubicador-enhancements.css";
import "@/styles/cubicador-history.css";

const MAX_IMAGES = 3;
const STEPS = ["Tipo de madera", "Fotografías", "Medidas", "Resultado"];
const MODES = [
  { id: "tablas", label: "Tablas y vigas", description: "Madera dimensionada y piezas rectangulares", icon: Layers3, tag: "Largo × ancho × espesor" },
  { id: "postes", label: "Postes", description: "Piezas redondas de diámetro uniforme", icon: CircleDot, tag: "Largo × diámetro" },
  { id: "troncos", label: "Troncos", description: "Madera rolliza con dos diámetros", icon: Trees, tag: "Método Smalian" },
  { id: "paquetes", label: "Pilas o paquetes", description: "Volumen exterior y factor de apilado", icon: PackageOpen, tag: "Volumen apilado" },
];
const EMPTY = { largo: "", ancho: "", espesor: "", cantidad: "1", diametroInicial: "", diametroFinal: "", alto: "", factorApilado: "85" };
const number = (value) => Math.max(0, Number(String(value || "").replace(",", ".")) || 0);
const formatVolume = (value) => Number(value || 0).toLocaleString("es-CL", { minimumFractionDigits: 3, maximumFractionDigits: 4 });

function calculateVolume(mode, values) {
  const length = number(values.largo);
  const quantity = Math.max(1, number(values.cantidad));
  if (mode === "tablas") return length * (number(values.ancho) / 100) * (number(values.espesor) / 100) * quantity;
  if (mode === "postes") return Math.PI * Math.pow(number(values.diametroInicial) / 200, 2) * length * quantity;
  if (mode === "troncos") {
    const area1 = Math.PI * Math.pow(number(values.diametroInicial) / 200, 2);
    const area2 = Math.PI * Math.pow(number(values.diametroFinal) / 200, 2);
    return ((area1 + area2) / 2) * length * quantity;
  }
  return length * (number(values.ancho) / 100) * (number(values.alto) / 100) * (number(values.factorApilado) / 100);
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    image.src = url;
  });
}

export default function Cubicador() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("tablas");
  const [values, setValues] = useState(EMPTY);
  const [images, setImages] = useState([]);
  const [history, setHistory] = useState(getCubicacionesLocales);
  const [tab, setTab] = useState("nueva");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const volume = useMemo(() => calculateVolume(mode, values), [mode, values]);
  const selectedMode = MODES.find((item) => item.id === mode);
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
  const changeMode = (nextMode) => { setMode(nextMode); setValues(EMPTY); setAnalysis(null); setConfirmed(false); setError(""); };
  const addImages = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_IMAGES - images.length);
    if (!files.length) return;
    setError("");
    try {
      const converted = await Promise.all(files.map(fileToCompressedDataUrl));
      setImages((current) => [...current, ...converted].slice(0, MAX_IMAGES));
      setAnalysis(null); setConfirmed(false);
    } catch (imageError) { setError(imageError.message); }
    event.target.value = "";
  };

  const analyze = async () => {
    if (!images.length) { setError("Agrega al menos una foto con una huincha visible."); return; }
    setAnalyzing(true); setError(""); setAnalysis(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("cubicar-madera", { body: { tipo: mode, imagenes: images } });
      if (invokeError) throw invokeError;
      if (!data?.medidas) throw new Error(data?.error || "La IA no devolvió medidas válidas.");
      const measured = data.medidas;
      setValues((current) => ({ ...current, largo: measured.largo_m ?? current.largo, ancho: measured.ancho_cm ?? current.ancho, espesor: measured.espesor_cm ?? current.espesor, alto: measured.alto_cm ?? current.alto, cantidad: measured.cantidad ?? current.cantidad, diametroInicial: measured.diametro_inicial_cm ?? current.diametroInicial, diametroFinal: measured.diametro_final_cm ?? current.diametroFinal }));
      setAnalysis(data); setStep(3);
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
  const startNew = () => { setStep(1); setValues(EMPTY); setImages([]); setAnalysis(null); setConfirmed(false); setError(""); setTab("nueva"); };
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
        <div className="cube-tabs"><button className={tab === "nueva" ? "active" : ""} onClick={() => setTab("nueva")}><ScanLine /> Nueva cubicación</button><button className={tab === "historial" ? "active" : ""} onClick={() => setTab("historial")}><History /> Historial <b>{history.length}</b></button></div>
      </header>

      {tab === "historial" ? <HistoryView items={history} onNew={startNew} onDelete={async (id) => { setHistory((current) => current.filter((item) => item.id !== id)); await eliminarCubicacion(id); }} /> : (
        <main className="cube-workspace">
          <Progress step={step} setStep={setStep} />
          <section className="cube-stage">
            <div className="cube-stage-heading"><span>Paso {step} de 4</span><h2>{STEPS[step - 1]}</h2><p>{step === 1 ? "Elige la forma que más se parece a la madera." : step === 2 ? "La IA funciona mejor con varios ángulos y una escala visible." : step === 3 ? "Comprueba cada valor; tú siempre tienes la última palabra." : "Revisa el volumen final antes de incorporarlo al historial."}</p></div>

            {step === 1 && <div className="cube-mode-grid">{MODES.map((item) => { const Icon = item.icon; return <button key={item.id} className={mode === item.id ? `cube-mode cube-mode-${item.id} active` : `cube-mode cube-mode-${item.id}`} onClick={() => changeMode(item.id)}><span className="cube-mode-art"><Icon /><i /></span><span className="cube-mode-copy"><small>{item.tag}</small><strong>{item.label}</strong><p>{item.description}</p></span><span className="cube-select-mark"><Check /></span></button>; })}</div>}

            {step === 2 && <div className="cube-photo-layout"><div className="cube-photo-main"><div className="cube-photo-grid">{images.map((src, index) => <div className="cube-photo" key={`${src.slice(-18)}-${index}`}><img src={src} alt={`Ángulo ${index + 1}`} /><button onClick={() => setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))} aria-label="Quitar foto"><X /></button><span>Ángulo {index + 1}</span></div>)}{images.length < MAX_IMAGES && <button className="cube-upload" onClick={() => inputRef.current?.click()}><span><ImagePlus /></span><strong>{images.length ? "Agregar otro ángulo" : "Tomar o subir fotografías"}</strong><p>{images.length ? `${images.length} de ${MAX_IMAGES} fotografías` : "Puedes usar directamente la cámara del teléfono"}</p></button>}<input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" multiple onChange={addImages} /></div><button className="cube-ai" disabled={analyzing || !images.length} onClick={analyze}>{analyzing ? <><Loader2 className="cube-spin" /> Analizando la madera…</> : <><Sparkles /> Analizar fotografías con IA</>}</button>{error && <Status type="warning" title="No se pudo completar el análisis" text={error} />}</div><aside className="cube-photo-guide"><span><Ruler /></span><small>Para una medición más confiable</small><h3>Incluye una huincha visible</h3><p>Debe estar apoyada sobre la misma cara de la madera, sin quedar atrás ni delante del objeto.</p><ol><li><b>01</b> Fotografía el frente</li><li><b>02</b> Agrega un costado</li><li><b>03</b> Muestra un extremo</li></ol></aside></div>}

            {step === 3 && <div className="cube-measure-layout"><div>{analysis ? <Status type={number(analysis.confianza) < 70 ? "warning" : "success"} title={`Medición completada · ${analysis.confianza}% de confianza`} text={analysis.observaciones || "Revisa cada valor antes de continuar."} /> : <div className="cube-manual-note"><Ruler /><div><strong>Medición manual</strong><p>Puedes completar los valores aunque no hayas usado fotografías.</p></div></div>}<MeasurementFields mode={mode} values={values} update={update} />{validation.length > 0 && <Status type="warning" title="Faltan datos válidos" text={validation.join(" · ")} />}</div><aside className="cube-current-type"><span className={`cube-mini-art cube-mode-${mode}`}><selectedMode.icon /></span><small>Estás cubicando</small><h3>{selectedMode?.label}</h3><p>{selectedMode?.tag}</p><button onClick={() => setStep(1)}>Cambiar tipo</button></aside></div>}

            {step === 4 && <div className="cube-result-layout"><div className="cube-result-hero"><span className="cube-result-label">Volumen total estimado</span><div><strong>{formatVolume(volume)}</strong><b>m³</b></div><p>{calculationText(mode, values)} · {mode === "troncos" ? "Método Smalian" : "Cálculo geométrico"}</p><div className="cube-result-glow" /></div><div className="cube-result-detail"><span><small>Tipo de madera</small><strong>{selectedMode?.label}</strong></span><span><small>Cantidad</small><strong>{mode === "paquetes" ? "1 paquete" : `${values.cantidad || 1} piezas`}</strong></span><span><small>Origen</small><strong>{analysis ? "IA + revisión" : "Medición manual"}</strong></span><label className="cube-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><i><CheckCircle2 /></i><p><strong>Revisé y confirmo estas medidas</strong><small>El resultado se guardará como una cubicación validada.</small></p></label><button className="cube-save" disabled={!confirmed || volume <= 0 || validation.length > 0} onClick={save}><Save /> Guardar cubicación</button><div className="cube-result-links"><button onClick={() => sendTo("/inventario")}>Enviar a inventario</button><button onClick={() => sendTo("/cotizaciones")}>Crear cotización</button><button onClick={() => sendTo("/compras")}>Registrar compra</button><button onClick={repeatLast}>Repetir lote</button></div></div></div>}
          </section>

          <footer className="cube-actions"><button className="cube-back" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft /> Volver</button><span>{step < 4 ? "Tus datos se conservan mientras avanzas" : "Último paso"}</span>{step < 4 ? <button className="cube-next" onClick={() => setStep((current) => Math.min(4, current + 1))}>{step === 2 && !images.length ? "Continuar sin fotos" : "Continuar"}<ArrowRight /></button> : <button className="cube-next subtle" onClick={() => setStep(3)}><ArrowLeft /> Editar medidas</button>}</footer>
        </main>
      )}
    </div>
  );
}

function validateMeasurements(mode, values) {
  const errors = [];
  if (number(values.largo) <= 0) errors.push("Ingresa un largo mayor que cero");
  if ((mode === "tablas" || mode === "paquetes") && number(values.ancho) <= 0) errors.push("Ingresa el ancho");
  if (mode === "tablas" && number(values.espesor) <= 0) errors.push("Ingresa el espesor");
  if (mode === "paquetes" && number(values.alto) <= 0) errors.push("Ingresa el alto del paquete");
  if (mode === "paquetes" && (number(values.factorApilado) <= 0 || number(values.factorApilado) > 100)) errors.push("El factor de madera debe estar entre 1% y 100%");
  if ((mode === "postes" || mode === "troncos") && number(values.diametroInicial) <= 0) errors.push("Ingresa el diámetro");
  if (mode === "troncos" && number(values.diametroFinal) <= 0) errors.push("Ingresa el diámetro final");
  if (mode !== "paquetes" && (!Number.isInteger(number(values.cantidad)) || number(values.cantidad) < 1)) errors.push("La cantidad debe ser un número entero");
  return errors;
}

function calculationText(mode, values) {
  if (mode === "tablas") return `${values.largo || 0} m × ${values.ancho || 0} cm × ${values.espesor || 0} cm × ${values.cantidad || 1} piezas`;
  if (mode === "postes") return `${values.largo || 0} m × Ø ${values.diametroInicial || 0} cm × ${values.cantidad || 1} piezas`;
  if (mode === "troncos") return `${values.largo || 0} m × Ø ${values.diametroInicial || 0}/${values.diametroFinal || 0} cm × ${values.cantidad || 1} piezas`;
  return `${values.largo || 0} m × ${values.ancho || 0} cm × ${values.alto || 0} cm × ${values.factorApilado || 0}%`;
}

function Progress({ step, setStep }) { return <nav className="cube-progress" aria-label="Progreso">{STEPS.map((label, index) => { const numberStep = index + 1; return <React.Fragment key={label}><button className={numberStep === step ? "active" : numberStep < step ? "done" : ""} onClick={() => numberStep <= step && setStep(numberStep)}><span>{numberStep < step ? <Check /> : numberStep}</span><small>{label}</small></button>{index < STEPS.length - 1 && <i className={numberStep < step ? "done" : ""} />}</React.Fragment>; })}</nav>; }
function Status({ type, title, text }) { return <div className={`cube-status ${type}`}>{type === "success" ? <CheckCircle2 /> : <AlertTriangle />}<div><strong>{title}</strong><p>{text}</p></div></div>; }
function Field({ label, value, unit, onChange }) { return <label className="cube-field"><span>{label}</span><div><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="0" /><b>{unit}</b></div></label>; }
function MeasurementFields({ mode, values, update }) { return <div className="cube-fields"><Field label="Largo" value={values.largo} unit="m" onChange={(value) => update("largo", value)} />{(mode === "tablas" || mode === "paquetes") && <Field label="Ancho" value={values.ancho} unit="cm" onChange={(value) => update("ancho", value)} />}{mode === "tablas" && <Field label="Espesor" value={values.espesor} unit="cm" onChange={(value) => update("espesor", value)} />}{mode === "paquetes" && <Field label="Alto del paquete" value={values.alto} unit="cm" onChange={(value) => update("alto", value)} />}{mode === "paquetes" && <Field label="Factor de madera" value={values.factorApilado} unit="%" onChange={(value) => update("factorApilado", value)} />}{(mode === "postes" || mode === "troncos") && <Field label={mode === "troncos" ? "Diámetro inicial" : "Diámetro"} value={values.diametroInicial} unit="cm" onChange={(value) => update("diametroInicial", value)} />}{mode === "troncos" && <Field label="Diámetro final" value={values.diametroFinal} unit="cm" onChange={(value) => update("diametroFinal", value)} />}{mode !== "paquetes" && <Field label="Cantidad" value={values.cantidad} unit="pzas" onChange={(value) => update("cantidad", value)} />}</div>; }
function exportHistory(items) {
  const rows = [["Fecha", "Tipo", "Volumen m3", "Origen", "Confianza", "Usuario"], ...items.map((item) => [new Date(item.fecha).toLocaleString("es-CL"), item.tipoNombre, item.volumen, item.origen, item.confianza ?? "", item.usuario])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `cubicaciones-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}
function HistoryView({ items, onNew, onDelete }) { return <section className="cube-history"><div className="cube-history-head"><div><span>Registro sincronizado</span><h2>Cubicaciones guardadas</h2><p>Disponibles para los usuarios autorizados de la empresa.</p></div><div className="cube-history-buttons">{items.length > 0 && <button className="secondary" onClick={() => exportHistory(items)}><Download /> Exportar CSV</button>}<button onClick={onNew}><Camera /> Nueva cubicación</button></div></div>{items.length ? <div className="cube-history-list">{items.map((item) => <article key={item.id}><span><Trees /></span><div><strong>{item.tipoNombre}</strong><small>{new Date(item.fecha).toLocaleString("es-CL")} · {item.usuario}</small></div><b>{formatVolume(item.volumen)} m³</b><button onClick={() => onDelete(item.id)} aria-label="Eliminar"><Trash2 /></button></article>)}</div> : <div className="cube-empty"><History /><h3>Aún no hay cubicaciones</h3><p>La primera medición confirmada aparecerá aquí.</p><button onClick={onNew}>Comenzar ahora</button></div>}</section>; }
