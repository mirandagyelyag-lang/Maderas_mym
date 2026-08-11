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
import "@/styles/cubicador.css";
import "@/styles/cubicador-enhancements.css";
import "@/styles/cubicador-history.css";

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
  if (mode === "troncos") return (values.diametros || []).reduce((total, row) => total + calculateJasVolume(number(row.diametro), length) * Math.floor(number(row.cantidad)), 0);
  return length * (number(values.ancho) / 100) * (number(values.alto) / 100) * (number(values.factorApilado) / 100);
}

// Coincide con la tabla JAS física usada por Maderas M&M.
function normalizeJasDiameter(diameterCm) {
  const diameter = number(diameterCm);
  if (diameter < 14) return Math.floor(diameter);
  return Math.floor(diameter / 2) * 2;
}

function calculateJasVolume(diameterCm, lengthM) {
  if (diameterCm <= 0 || lengthM <= 0) return 0;
  const diameter = normalizeJasDiameter(diameterCm);
  const tableLength = Math.abs(lengthM - 3.3) < 0.01 ? 3.2 : lengthM;
  const rawVolume = lengthM < 6
    ? (diameter ** 2 * tableLength) / 10000
    : ((diameter + ((Math.floor(lengthM) - 4) / 2)) ** 2 * lengthM) / 10000;
  return Math.round((rawVolume + Number.EPSILON) * 1000) / 1000;
}

const jasPieces = (values) => (values.diametros || []).reduce((total, row) => total + Math.floor(number(row.cantidad)), 0);

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

function cropDataUrl(dataUrl, crop) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const x = Math.round(crop.x * image.naturalWidth);
      const y = Math.round(crop.y * image.naturalHeight);
      const width = Math.max(1, Math.round(crop.width * image.naturalWidth));
      const height = Math.max(1, Math.round(crop.height * image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = () => reject(new Error("No se pudo recortar la fotografía."));
    image.src = dataUrl;
  });
}

async function getFunctionErrorMessage(invokeError) {
  const response = invokeError?.context;

  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      const detail = payload?.error || payload?.message;
      if (detail) {
        return `${detail}${response.status ? ` (HTTP ${response.status})` : ""}`;
      }
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim()) {
          return `${text.trim()}${response.status ? ` (HTTP ${response.status})` : ""}`;
        }
      } catch {
        // Supabase ya consumió el cuerpo; conservamos el mensaje original.
      }
    }
  }

  return invokeError?.message || "No se pudo contactar la función de análisis.";
}

function withTimeout(promise, milliseconds) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error("El análisis tardó demasiado y fue cancelado. Intenta nuevamente con fotos más cercanas.")),
      milliseconds
    );
  });

  return Promise.race([promise, timeout]).finally(() =>
    window.clearTimeout(timeoutId)
  );
}

function cleanMeasuredRollizos(rows) {
  const grouped = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const diameter = Number(row?.diametro_cm);
    const quantity = Math.floor(Number(row?.cantidad));

    if (!Number.isFinite(diameter) || diameter <= 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;

    const normalizedDiameter = Number(diameter.toFixed(1));
    grouped.set(
      normalizedDiameter,
      (grouped.get(normalizedDiameter) || 0) + quantity
    );
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([diametro_cm, cantidad]) => ({ diametro_cm, cantidad }));
}

function cleanAnalysisResponse(data, mode, requestedLength) {
  if (!data?.medidas || typeof data.medidas !== "object") {
    throw new Error(data?.error || "La IA no devolvió medidas válidas.");
  }

  const source = data.medidas;
  const positiveOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const integerOrNull = (value) => {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const rollizos = cleanMeasuredRollizos(source.rollizos);
  const readMarks = rollizos.reduce((sum, row) => sum + row.cantidad, 0);
  const unreadable = Math.max(0, Math.floor(Number(source.no_legibles) || 0));
  const visible = Math.max(
    readMarks + unreadable,
    Math.floor(Number(source.total_extremos_visibles) || 0)
  );

  const medidas = {
    largo_m: mode === "troncos"
      ? positiveOrNull(requestedLength) || positiveOrNull(source.largo_m)
      : positiveOrNull(source.largo_m),
    ancho_cm: positiveOrNull(source.ancho_cm),
    espesor_cm: positiveOrNull(source.espesor_cm),
    alto_cm: positiveOrNull(source.alto_cm),
    diametro_inicial_cm: positiveOrNull(source.diametro_inicial_cm),
    diametro_final_cm: positiveOrNull(source.diametro_final_cm),
    cantidad: integerOrNull(source.cantidad),
    rollizos,
    total_extremos_visibles: mode === "troncos" ? visible : null,
    total_marcas_leidas: mode === "troncos" ? readMarks : null,
    no_legibles: mode === "troncos" ? unreadable : null,
  };

  if (mode === "troncos" && rollizos.length === 0) {
    throw new Error(
      "La IA no pudo leer ningún número rojo con seguridad. Acerca la cámara, evita reflejos y vuelve a fotografiar."
    );
  }

  return {
    ...data,
    medidas,
    confianza: Math.round(normalizeConsensusConfidence(data.confianza)),
    requiere_revision: true,
  };
}


function medianConsensus(values) {
  const clean = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2
    ? clean[middle]
    : (clean[middle - 1] + clean[middle]) / 2;
}

function normalizeConsensusConfidence(value) {
  const numberValue = Number(value) || 0;
  const percent =
    numberValue > 0 && numberValue <= 1
      ? numberValue * 100
      : numberValue;

  return Math.max(0, Math.min(100, percent));
}

function relativeConsensusSpread(values) {
  const clean = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (clean.length < 2) return 0;

  const base = Math.max(1, medianConsensus(clean) || 1);
  return (Math.max(...clean) - Math.min(...clean)) / base;
}

function consensusScore(spread) {
  if (spread <= 0.03) return 98;
  if (spread <= 0.05) return 94;
  if (spread <= 0.08) return 86;
  if (spread <= 0.12) return 74;
  if (spread <= 0.18) return 55;
  return 30;
}

function aggregateConsensusRollizos(runs) {
  const diameters = new Set();

  for (const run of runs) {
    for (const row of Array.isArray(run?.medidas?.rollizos)
      ? run.medidas.rollizos
      : []) {
      const diameter = Number(row?.diametro_cm);
      if (Number.isFinite(diameter) && diameter > 0) {
        diameters.add(diameter);
      }
    }
  }

  return [...diameters]
    .sort((a, b) => a - b)
    .map((diameter) => {
      const quantities = runs.map((run) => {
        const row = (
          Array.isArray(run?.medidas?.rollizos)
            ? run.medidas.rollizos
            : []
        ).find(
          (item) => Number(item?.diametro_cm) === diameter
        );

        return Math.max(
          0,
          Math.floor(Number(row?.cantidad) || 0)
        );
      });

      return {
        diametro_cm: diameter,
        cantidad: Math.max(
          0,
          Math.round(medianConsensus(quantities) || 0)
        ),
      };
    })
    .filter((row) => row.cantidad > 0);
}

function summarizeConsensusRun(run) {
  return {
    total_extremos_visibles: Math.max(
      0,
      Math.round(
        Number(run?.medidas?.total_extremos_visibles) || 0
      )
    ),
    total_marcas_leidas: Math.max(
      0,
      Math.round(
        Number(run?.medidas?.total_marcas_leidas) || 0
      )
    ),
    no_legibles: Math.max(
      0,
      Math.round(Number(run?.medidas?.no_legibles) || 0)
    ),
    confianza: Math.round(
      normalizeConsensusConfidence(run?.confianza)
    ),
  };
}

function buildClientConsensus(
  runs,
  tipo,
  modoImagenes,
  largoM
) {
  if (!Array.isArray(runs) || runs.length < 2) {
    throw new Error(
      "No hubo suficientes análisis completos para comparar la medición."
    );
  }

  const fields = [
    "largo_m",
    "ancho_cm",
    "espesor_cm",
    "alto_cm",
    "diametro_inicial_cm",
    "diametro_final_cm",
    "cantidad",
  ];

  const medidas = {};

  for (const field of fields) {
    const value = medianConsensus(
      runs.map((run) => run?.medidas?.[field])
    );

    medidas[field] =
      value == null ? null : Number(value.toFixed(3));
  }

  if (tipo === "troncos") {
    medidas.largo_m =
      Number(largoM) || medidas.largo_m || null;
    medidas.rollizos = aggregateConsensusRollizos(runs);
    medidas.total_marcas_leidas =
      medidas.rollizos.reduce(
        (sum, row) =>
          sum +
          Math.max(
            0,
            Math.floor(Number(row?.cantidad) || 0)
          ),
        0
      );
    medidas.total_extremos_visibles = Math.max(
      medidas.total_marcas_leidas,
      Math.round(
        medianConsensus(
          runs.map(
            (run) =>
              run?.medidas?.total_extremos_visibles
          )
        ) || 0
      )
    );
    medidas.no_legibles = Math.max(
      0,
      Math.round(
        medianConsensus(
          runs.map((run) => run?.medidas?.no_legibles)
        ) || 0
      )
    );
  } else {
    medidas.rollizos = [];
    medidas.total_extremos_visibles = null;
    medidas.total_marcas_leidas = null;
    medidas.no_legibles = null;
  }

  const modelConfidence = Math.round(
    medianConsensus(
      runs.map((run) =>
        normalizeConsensusConfidence(run?.confianza)
      )
    ) || 0
  );

  let maxSpread = 0;
  let repeatSector = null;
  const sectors = [];

  if (
    tipo === "troncos" &&
    modoImagenes === "cuadrantes_2x2" &&
    runs.every(
      (run) =>
        Array.isArray(run?.sectores) &&
        run.sectores.length === 4
    )
  ) {
    const names = [
      "superior izquierdo",
      "superior derecho",
      "inferior izquierdo",
      "inferior derecho",
    ];

    names.forEach((name, index) => {
      const totals = runs.map((run) => {
        const sector = run.sectores[index] || {};
        const fromRows = (
          Array.isArray(sector.rollizos)
            ? sector.rollizos
            : []
        ).reduce(
          (sum, row) =>
            sum +
            Math.max(
              0,
              Math.floor(Number(row?.cantidad) || 0)
            ),
          0
        );

        return Math.max(
          fromRows +
            Math.max(
              0,
              Math.floor(Number(sector?.no_legibles) || 0)
            ),
          Math.floor(
            Number(sector?.total_extremos_visibles) || 0
          )
        );
      });

      const spread = relativeConsensusSpread(totals);

      sectors.push({
        nombre: name,
        conteos: totals,
        diferencia_relativa: Number(spread.toFixed(4)),
        puntaje: consensusScore(spread),
      });

      if (spread > maxSpread) {
        maxSpread = spread;
        repeatSector = name;
      }
    });
  } else if (tipo === "troncos") {
    maxSpread = relativeConsensusSpread(
      runs.map((run) =>
        Math.max(
          Math.floor(
            Number(
              run?.medidas?.total_extremos_visibles
            ) || 0
          ),
          Math.floor(
            Number(run?.medidas?.total_marcas_leidas) ||
              0
          ) +
            Math.floor(
              Number(run?.medidas?.no_legibles) || 0
            )
        )
      )
    );
  } else {
    const relevant =
      tipo === "tablas"
        ? [
            "largo_m",
            "ancho_cm",
            "espesor_cm",
            "cantidad",
          ]
        : tipo === "postes"
        ? ["largo_m", "diametro_inicial_cm", "cantidad"]
        : ["largo_m", "ancho_cm", "alto_cm"];

    maxSpread = Math.max(
      0,
      ...relevant.map((field) =>
        relativeConsensusSpread(
          runs.map((run) => run?.medidas?.[field])
        )
      )
    );
  }

  const score = consensusScore(maxSpread);
  const level =
    maxSpread <= 0.05
      ? "alta"
      : maxSpread <= 0.12
      ? "media"
      : "baja";

  const reliable = maxSpread <= 0.12;
  const confidence = Math.round(
    score * 0.7 + modelConfidence * 0.3
  );

  return {
    medidas,
    confianza: confidence,
    observaciones: reliable
      ? `Resultado obtenido por consenso de ${runs.length} análisis independientes. Consistencia ${level}. Revisa visualmente antes de guardar.`
      : `Los ${runs.length} análisis no coincidieron lo suficiente. ${
          repeatSector
            ? `Repite la fotografía del sector ${repeatSector}.`
            : "Repite la fotografía con mejor luz y encuadre."
        }`,
    requiere_revision: true,
    resultado_confiable: reliable,
    repetir_sector: reliable ? null : repeatSector,
    consistencia: {
      nivel: level,
      puntaje: score,
      diferencia_relativa_maxima: Number(
        maxSpread.toFixed(4)
      ),
      umbral_aceptacion: 0.12,
      analisis: runs.map(summarizeConsensusRun),
      sectores: sectors,
    },
  };
}

function wait(milliseconds) {
  return new Promise((resolve) =>
    window.setTimeout(resolve, milliseconds)
  );
}

export default function Cubicador() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const lastPhotoSourceRef = useRef("camera");
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("tablas");
  const [values, setValues] = useState(EMPTY);
  const [images, setImages] = useState([]);
  const [rollizoCapture, setRollizoCapture] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [history, setHistory] = useState(getCubicacionesLocales);
  const [tab, setTab] = useState("nueva");
  const [analyzing, setAnalyzing] = useState(false);
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
  const addImages = async (event, source = "gallery") => {
    lastPhotoSourceRef.current = source;
    const files = Array.from(event.target.files || []).slice(0, requiredPhotos - images.length);
    if (!files.length) return;
    setError("");
    try {
      const converted = await Promise.all(files.map(fileToCompressedDataUrl));
      setPendingPhoto(converted[0]);
      setPendingPhotos(converted.slice(1));
      setAnalysis(null); setConfirmed(false);
    } catch (imageError) { setError(imageError.message); }
    event.target.value = "";
  };

  const acceptReviewedPhoto = (photo) => {
    setImages((current) => [...current, photo].slice(0, requiredPhotos));
    const [nextPhoto, ...remaining] = pendingPhotos;
    setPendingPhoto(nextPhoto || null);
    setPendingPhotos(remaining);
  };

  const repeatReviewedPhoto = () => {
    setPendingPhoto(null);
    setPendingPhotos([]);
    window.setTimeout(() => {
      if (lastPhotoSourceRef.current === "camera") {
        setCameraOpen(true);
      } else {
        galleryInputRef.current?.click();
      }
    }, 0);
  };

  const acceptCameraPhoto = (photo) => {
    lastPhotoSourceRef.current = "camera";
    setCameraOpen(false);
    setPendingPhoto(photo);
    setPendingPhotos([]);
    setAnalysis(null);
    setConfirmed(false);
    setError("");
  };

  const analyze = async () => {
    if (!images.length) {
      setError(
        "Agrega al menos una foto con una huincha visible."
      );
      return;
    }

    if (mode === "troncos" && !rollizoCapture) {
      setError(
        "Indica si cubicarás un rollizo o una pila completa."
      );
      return;
    }

    if (
      mode === "troncos" &&
      images.length !== requiredPhotos
    ) {
      setError(
        `Faltan ${
          requiredPhotos - images.length
        } fotos para completar la medición.`
      );
      return;
    }

    setAnalyzing(true);
    setError("");
    setAnalysis(null);

    const modoImagenes =
      mode === "troncos" && rollizoCapture === "pila"
        ? "cuadrantes_2x2"
        : "fotografias";

    const body = {
      tipo: mode,
      imagenes: images,
      modo_imagenes: modoImagenes,
      largo_m:
        mode === "troncos"
          ? number(values.largo) || null
          : null,
    };

    try {
      const { data, error: invokeError } = await withTimeout(
        supabase.functions.invoke("cubicar-madera", { body }),
        50_000
      );

      if (invokeError) {
        throw new Error(await getFunctionErrorMessage(invokeError));
      }

      const analysisResult = cleanAnalysisResponse(
        data,
        mode,
        values.largo
      );
      const measured = analysisResult.medidas;

      setValues((current) => ({
        ...current,
        largo:
          measured.largo_m ?? current.largo,
        ancho:
          measured.ancho_cm ?? current.ancho,
        espesor:
          measured.espesor_cm ?? current.espesor,
        alto:
          measured.alto_cm ?? current.alto,
        cantidad:
          measured.cantidad ?? current.cantidad,
        diametroInicial:
          measured.diametro_inicial_cm ??
          current.diametroInicial,
        diametroFinal:
          measured.diametro_final_cm ??
          current.diametroFinal,
        diametros:
          mode === "troncos" &&
          Array.isArray(measured.rollizos)
            ? measured.rollizos
                .filter(
                  (row) =>
                    number(row.diametro_cm) > 0 &&
                    number(row.cantidad) > 0
                )
                .map((row) =>
                  newJasRow(
                    row.diametro_cm,
                    row.cantidad
                  )
                )
            : current.diametros,
      }));

      const counts =
        measured.total_extremos_visibles != null
          ? `Extremos visibles: ${
              measured.total_extremos_visibles
            }. Marcas leídas: ${
              measured.total_marcas_leidas ?? 0
            }. Requieren revisión: ${
              measured.no_legibles ?? 0
            }.`
          : "";

      setAnalysis({
        ...analysisResult,
        resultado_confiable:
          analysisResult.confianza >= 60 &&
          (mode !== "troncos" || measured.rollizos.length > 0),
        observaciones: `${counts} ${
          analysisResult.observaciones || ""
        }`.trim(),
      });

      setStep(3);
    } catch (analysisError) {
      console.error(
        "Error de análisis del cubicador:",
        analysisError
      );

      setError(analysisError?.message || "No fue posible analizar las fotos.");
    } finally {
      setAnalyzing(false);
    }
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
                  <CaptureGuide mode={mode} captureMode={rollizoCapture} photoIndex={images.length} />
                  <div className="cube-photo-grid">
                    {images.map((src, index) => <div className="cube-photo" key={`${src.slice(-18)}-${index}`}>
                      <img src={src} alt={mode === "troncos" && rollizoCapture === "pila" ? ROLLIZO_SECTORS[index] : `Foto ${index + 1}`} />
                      <button onClick={() => setImages((current) => mode === "troncos" && rollizoCapture === "pila" ? current.slice(0, index) : current.filter((_, currentIndex) => currentIndex !== index))} aria-label="Quitar foto"><X /></button>
                      <span>{mode === "troncos" && rollizoCapture === "pila" ? `${index + 1}. ${ROLLIZO_SECTORS[index]}` : `Foto ${index + 1}`}</span>
                    </div>)}
                    {images.length < requiredPhotos && <>
                      <button type="button" className="cube-upload" onClick={() => setCameraOpen(true)}>
                        <span><Camera /></span>
                        <strong>{mode === "troncos" && rollizoCapture === "pila" ? `Tomar foto ${images.length + 1}: ${ROLLIZO_SECTORS[images.length]}` : "Tomar fotografía"}</strong>
                        <p>Abre directamente la cámara trasera</p>
                      </button>
                      <button type="button" className="cube-upload" onClick={() => galleryInputRef.current?.click()}>
                        <span><ImagePlus /></span>
                        <strong>{mode === "troncos" && rollizoCapture === "pila" ? `Elegir sector ${images.length + 1} desde galería` : "Elegir desde galería"}</strong>
                        <p>{mode === "troncos" && rollizoCapture === "pila" ? `${images.length} de 4 sectores listos` : "Usa una foto que ya tengas guardada"}</p>
                      </button>
                    </>}
                    <input ref={cameraInputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { setCameraOpen(false); addImages(event, "camera"); }} />
                    <input ref={galleryInputRef} className="sr-only" type="file" accept="image/*" multiple={requiredPhotos > 1} onChange={(event) => addImages(event, "gallery")} />
                  </div>
                  <button className="cube-ai" disabled={analyzing || images.length !== requiredPhotos} onClick={analyze}>
                    {analyzing ? <><Loader2 className="cube-spin" /> Analizando fotografías…</> : <><Sparkles /> {mode === "troncos" ? images.length === requiredPhotos ? rollizoCapture === "pila" ? "Analizar los 4 sectores" : "Analizar fotografía" : `Faltan ${requiredPhotos - images.length} fotos` : "Analizar fotografías con IA"}</>}
                  </button>
                </> : null}
                {error && <Status type="warning" title="No se pudo completar el análisis" text={error} />}
              </div>
              <aside className="cube-photo-guide"><span><Ruler /></span><small>Proceso guiado</small><h3>{mode === "troncos" ? rollizoCapture === "individual" ? "Una foto cercana y de frente" : "Fotografía la pila por sectores" : "Incluye una huincha visible"}</h3><p>{mode === "troncos" ? rollizoCapture === "individual" ? "Asegúrate de que el número rojo se vea grande, nítido y con buena luz." : "Acércate para que los números rojos se vean grandes. Evita repetir troncos entre fotos." : "Debe estar apoyada sobre la misma cara de la madera, sin quedar atrás ni delante del objeto."}</p><ol>{mode === "troncos" && rollizoCapture === "pila" ? ROLLIZO_SECTORS.map((sector, index) => <li key={sector}><b>0{index + 1}</b> {sector}</li>) : mode === "troncos" ? <><li><b>01</b> Número rojo completo</li><li><b>02</b> Teléfono de frente</li><li><b>03</b> Buena iluminación</li></> : <><li><b>01</b> Fotografía el frente</li><li><b>02</b> Agrega un costado</li><li><b>03</b> Muestra un extremo</li></>}</ol></aside>
            </div>}

            {step === 3 && <div className="cube-measure-layout"><div>{analysis ? <Status type={analysis.resultado_confiable === false || number(analysis.confianza) < 70 ? "warning" : "success"} title={`Lectura de IA para revisar · ${analysis.confianza}% de confianza`} text={analysis.observaciones || "Revisa cada valor antes de continuar."} /> : <div className="cube-manual-note"><Ruler /><div><strong>Medición manual</strong><p>Puedes completar los valores aunque no hayas usado fotografías.</p></div></div>}<MeasurementFields mode={mode} values={values} update={update} />{validation.length > 0 && <Status type="warning" title="Faltan datos válidos" text={validation.join(" · ")} />}</div><aside className="cube-current-type"><span className={`cube-mini-art cube-mode-${mode}`}><selectedMode.icon /></span><small>Estás cubicando</small><h3>{selectedMode?.label}</h3><p>{selectedMode?.tag}</p><button onClick={() => setStep(1)}>Cambiar tipo</button></aside></div>}

            {step === 4 && <div className="cube-result-layout"><div className="cube-result-hero"><span className="cube-result-label">Volumen total calculado</span><div><strong>{formatVolume(volume)}</strong><b>m³</b></div><p>{calculationText(mode, values)} · {mode === "troncos" ? "Regla JAS" : "Cálculo geométrico"}</p><div className="cube-result-glow" /></div><div className="cube-result-detail"><span><small>Tipo de madera</small><strong>{selectedMode?.label}</strong></span><span><small>Cantidad</small><strong>{mode === "paquetes" ? "1 paquete" : `${mode === "troncos" ? jasPieces(values) : values.cantidad || 1} piezas`}</strong></span><span><small>Origen</small><strong>{analysis ? "IA + revisión" : "Medición manual"}</strong></span><label className="cube-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><i><CheckCircle2 /></i><p><strong>Revisé y confirmo estas medidas</strong><small>El resultado se guardará como una cubicación validada.</small></p></label><button className="cube-save" disabled={!confirmed || volume <= 0 || validation.length > 0} onClick={save}><Save /> Guardar cubicación</button><div className="cube-result-links"><button onClick={() => sendTo("/inventario")}>Enviar a inventario</button><button onClick={() => sendTo("/cotizaciones")}>Crear cotización</button><button onClick={() => sendTo("/compras")}>Registrar compra</button><button onClick={repeatLast}>Repetir lote</button></div></div></div>}
          </section>

          <footer className="cube-actions"><button className="cube-back" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft /> Volver</button><span>{step < 4 ? "Tus datos se conservan mientras avanzas" : "Último paso"}</span>{step < 4 ? <button className="cube-next" onClick={() => setStep((current) => Math.min(4, current + 1))}>{step === 2 && !images.length ? "Continuar sin fotos" : "Continuar"}<ArrowRight /></button> : <button className="cube-next subtle" onClick={() => setStep(3)}><ArrowLeft /> Editar medidas</button>}</footer>
        </main>
      )}
      {pendingPhoto && <PhotoReviewModal
        src={pendingPhoto}
        title={mode === "troncos" && rollizoCapture === "pila" ? ROLLIZO_SECTORS[images.length] : `Fotografía ${images.length + 1}`}
        onUse={acceptReviewedPhoto}
        onRepeat={repeatReviewedPhoto}
        onCancel={() => { setPendingPhoto(null); setPendingPhotos([]); }}
      />}
      {cameraOpen && <CameraCaptureModal
        title={mode === "troncos" && rollizoCapture === "pila" ? ROLLIZO_SECTORS[images.length] : `Fotografía ${images.length + 1}`}
        onCapture={acceptCameraPhoto}
        onFallback={() => cameraInputRef.current?.click()}
        onClose={() => setCameraOpen(false)}
      />}
    </div>
  );
}

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "El permiso de cámara está bloqueado. Abre los permisos del sitio o de la app, habilita Cámara y vuelve a intentar.";
  }
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") {
    return "No se encontró una cámara compatible en este dispositivo.";
  }
  if (error?.name === "NotReadableError") {
    return "La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentar.";
  }
  if (error?.name === "SecurityError") {
    return "El navegador bloqueó la cámara. Abre la app desde su dirección HTTPS segura.";
  }
  return error?.message || "No se pudo iniciar la cámara del dispositivo.";
}

function CameraCaptureModal({ title, onCapture, onFallback, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let permissionTimer;

    const stopStream = (stream = streamRef.current) => {
      stream?.getTracks?.().forEach((track) => track.stop());
      if (stream === streamRef.current) streamRef.current = null;
    };

    const startCamera = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(
          "Esta instalación no puede abrir la cámara directamente. Usa el selector del teléfono o abre la versión HTTPS en Chrome/Safari."
        );
        return;
      }

      permissionTimer = window.setTimeout(() => {
        if (!cancelled && !streamRef.current) {
          setError("El teléfono todavía espera el permiso de cámara. Revisa si apareció una solicitud de permiso detrás de la app.");
        }
      }, 12_000);

      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });
        } catch (rearCameraError) {
          if (!["OverconstrainedError", "NotFoundError"].includes(rearCameraError?.name)) {
            throw rearCameraError;
          }
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }

        if (cancelled) {
          stopStream(stream);
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stopStream(stream);
          return;
        }

        video.srcObject = stream;
        await video.play();
        if (!cancelled) {
          setReady(true);
          setError("");
        }
      } catch (cameraError) {
        if (!cancelled) setError(cameraErrorMessage(cameraError));
      } finally {
        window.clearTimeout(permissionTimer);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      window.clearTimeout(permissionTimer);
      stopStream();
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setError("La cámara todavía no está lista. Espera un segundo y vuelve a tocar Capturar.");
      return;
    }

    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    onCapture(canvas.toDataURL("image/jpeg", 0.86));
  };

  return <div className="cube-review-backdrop" role="dialog" aria-modal="true" aria-label="Cámara del cubicador">
    <div className="cube-review-modal">
      <header><div><small>Cámara trasera</small><h3>{title}</h3></div><button type="button" onClick={onClose} aria-label="Cerrar cámara"><X /></button></header>
      <p className="cube-review-help">Encuadra el sector completo y asegúrate de que los números rojos se vean nítidos.</p>
      <div style={{ background: "#111", borderRadius: "18px", overflow: "hidden", minHeight: "240px", display: "grid", placeItems: "center" }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ display: "block", width: "100%", maxHeight: "62vh", objectFit: "cover" }} />
        {!ready && !error && <p style={{ color: "white", padding: "24px", position: "absolute" }}>Solicitando permiso de cámara…</p>}
      </div>
      {error && <Status type="warning" title="No se pudo abrir la cámara" text={error} />}
      <div className="cube-review-actions">
        <button type="button" className="secondary" onClick={onFallback}><ImagePlus /> Usar cámara del teléfono</button>
        <button type="button" className="secondary" onClick={onClose}><X /> Cancelar</button>
        <button type="button" className="primary" disabled={!ready} onClick={takePhoto}><Camera /> Capturar</button>
      </div>
    </div>
  </div>;
}

function CaptureGuide({ mode, captureMode, photoIndex }) {
  const isPile = mode === "troncos" && captureMode === "pila";
  return <div className="cube-sector-preview">
    <div className={isPile ? "cube-sector-map" : "cube-sector-map single"}>
      {isPile ? ROLLIZO_SECTORS.map((sector, index) => <span key={sector} className={index === photoIndex ? "active" : index < photoIndex ? "done" : ""}><b>{index + 1}</b></span>) : <span className="active"><Camera /></span>}
    </div>
    <div><small>Vista previa de la toma</small><strong>{isPile ? `Ahora: ${ROLLIZO_SECTORS[Math.min(photoIndex, 3)]}` : "Encuadra la madera completa"}</strong><p>{isPile ? "Acércate y ocupa toda la pantalla con este sector." : "Después podrás confirmar o recortar la fotografía."}</p></div>
  </div>;
}

function PhotoReviewModal({ src, title, onUse, onRepeat, onCancel }) {
  const imageRef = useRef(null);
  const startRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [cropping, setCropping] = useState(false);

  const pointFromEvent = (event) => {
    const rect = imageRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  };
  const beginSelection = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    startRef.current = point;
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  };
  const moveSelection = (event) => {
    if (!startRef.current) return;
    const point = pointFromEvent(event); const start = startRef.current;
    setSelection({ x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) });
  };
  const endSelection = () => { startRef.current = null; };
  const useCrop = async () => {
    if (!selection || selection.width < 0.08 || selection.height < 0.08) return;
    setCropping(true);
    try { onUse(await cropDataUrl(src, selection)); }
    finally { setCropping(false); }
  };

  return <div className="cube-review-backdrop" role="dialog" aria-modal="true" aria-label="Revisar fotografía">
    <div className="cube-review-modal">
      <header><div><small>Revisa antes de continuar</small><h3>{title}</h3></div><button type="button" onClick={onCancel} aria-label="Cerrar"><X /></button></header>
      <p className="cube-review-help">Para recortar, arrastra el dedo formando un cuadro sobre la parte que quieres conservar.</p>
      <div className="cube-review-image-wrap">
        <img ref={imageRef} src={src} alt={`Vista previa: ${title}`} />
        <div className="cube-crop-surface" onPointerDown={beginSelection} onPointerMove={moveSelection} onPointerUp={endSelection} onPointerCancel={endSelection}>
          {selection && <i style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }} />}
        </div>
      </div>
      <div className="cube-review-actions">
        <button type="button" className="secondary" onClick={onRepeat}><Camera /> Repetir</button>
        <button type="button" className="secondary" disabled={!selection || selection.width < 0.08 || selection.height < 0.08 || cropping} onClick={useCrop}><ScanLine /> {cropping ? "Recortando…" : "Recortar y usar"}</button>
        <button type="button" className="primary" onClick={() => onUse(src)}><Check /> Usar completa</button>
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
