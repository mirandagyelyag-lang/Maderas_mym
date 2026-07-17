import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BrowserCodeReader,
  BrowserMultiFormatReader,
} from "@zxing/browser";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import {
  Camera,
  Loader2,
  RefreshCw,
  AlertTriangle,
  X,
} from "lucide-react";

export default function BarcodeScannerDialog({
  onClose,
  onDetected,
}) {
  const videoRef = useRef(null);
  const controlesRef = useRef(null);
  const lectorRef = useRef(null);

  const cerrandoRef = useRef(false);
  const lecturaProcesadaRef =
    useRef(false);

  const [estado, setEstado] =
    useState("cargando");

  const [error, setError] =
    useState("");

  const apagarTodo = async () => {
    cerrandoRef.current = true;
    lecturaProcesadaRef.current =
      true;

    try {
      await controlesRef.current?.stop?.();
    } catch (errorControles) {
      console.warn(
        "No se pudieron detener los controles:",
        errorControles
      );
    }

    controlesRef.current = null;

    const video =
      videoRef.current;

    const stream =
      video?.srcObject;

    if (
      stream instanceof
      MediaStream
    ) {
      stream
        .getTracks()
        .forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {
            // La pista ya estaba detenida.
          }
        });
    }

    if (video) {
      try {
        video.pause();
      } catch {
        // El video ya estaba pausado.
      }

      try {
        BrowserCodeReader.cleanVideoSource(
          video
        );
      } catch {
        video.srcObject = null;
        video.removeAttribute(
          "src"
        );
      }

      video.load?.();
    }

    try {
      BrowserCodeReader.releaseAllStreams();
    } catch (errorStreams) {
      console.warn(
        "No se pudieron liberar todos los streams:",
        errorStreams
      );
    }

    lectorRef.current = null;
  };

  const cerrar = async () => {
    if (cerrandoRef.current) {
      return;
    }

    await apagarTodo();
    onClose();
  };

  const procesarCodigo = async (
    codigo
  ) => {
    if (
      lecturaProcesadaRef.current ||
      cerrandoRef.current
    ) {
      return;
    }

    const codigoLimpio =
      String(codigo || "").trim();

    if (!codigoLimpio) {
      return;
    }

    lecturaProcesadaRef.current =
      true;

    setEstado("detectado");

    await apagarTodo();

    onDetected(codigoLimpio);
  };

  const iniciarCamara = async () => {
    await apagarTodo();

    cerrandoRef.current = false;
    lecturaProcesadaRef.current =
      false;

    setEstado("cargando");
    setError("");

    try {
      const lector =
        new BrowserMultiFormatReader();

      lectorRef.current = lector;

      const dispositivos =
        await BrowserCodeReader.listVideoInputDevices();

      if (
        cerrandoRef.current
      ) {
        await apagarTodo();
        return;
      }

      if (
        dispositivos.length === 0
      ) {
        throw new Error(
          "No se encontró ninguna cámara."
        );
      }

      const camaraTrasera =
        dispositivos.find(
          (dispositivo) =>
            /back|rear|environment|trasera/i.test(
              dispositivo.label
            )
        );

      const dispositivoId =
        camaraTrasera?.deviceId ||
        dispositivos[
          dispositivos.length - 1
        ].deviceId;

      const controles =
        await lector.decodeFromVideoDevice(
          dispositivoId,
          videoRef.current,
          (resultado, errorLectura) => {
            if (
              resultado &&
              !lecturaProcesadaRef.current &&
              !cerrandoRef.current
            ) {
              procesarCodigo(
                resultado.getText()
              );

              return;
            }

            if (
              errorLectura &&
              errorLectura.name !==
                "NotFoundException"
            ) {
              console.warn(
                "Lectura de código:",
                errorLectura
              );
            }
          }
        );

      if (
        cerrandoRef.current ||
        lecturaProcesadaRef.current
      ) {
        try {
          await controles?.stop?.();
        } catch {
          // Ya estaba detenido.
        }

        await apagarTodo();
        return;
      }

      controlesRef.current =
        controles;

      setEstado("leyendo");
    } catch (errorCamara) {
      console.error(
        "Error abriendo cámara:",
        errorCamara
      );

      await apagarTodo();

      if (
        cerrandoRef.current
      ) {
        return;
      }

      setEstado("error");

      if (
        errorCamara?.name ===
          "NotAllowedError" ||
        errorCamara?.name ===
          "PermissionDeniedError"
      ) {
        setError(
          "Debes permitir el acceso a la cámara."
        );
      } else if (
        errorCamara?.name ===
        "NotReadableError"
      ) {
        setError(
          "La cámara está siendo usada por otra aplicación."
        );
      } else {
        setError(
          errorCamara?.message ||
            "No se pudo abrir la cámara."
        );
      }
    }
  };

  useEffect(() => {
    iniciarCamara();

    const manejarEscape = (
      event
    ) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cerrar();
      }
    };

    window.addEventListener(
      "keydown",
      manejarEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        manejarEscape
      );

      apagarTodo();
    };
  }, []);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          cerrar();
        }
      }}
    >
      <DialogContent
        className="max-w-lg bg-card border-border"
        onEscapeKeyDown={(
          event
        ) => {
          event.preventDefault();
          cerrar();
        }}
        onPointerDownOutside={(
          event
        ) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>
              Escanear código de barras
            </DialogTitle>

            <button
              type="button"
              onClick={cerrar}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar cámara"
              title="Cerrar cámara"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />

          {(estado ===
            "leyendo" ||
            estado ===
              "cargando") && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative w-[78%] h-28 rounded-xl border-2 border-primary shadow-[0_0_0_999px_rgba(0,0,0,0.35)]">
                <div className="absolute left-3 right-3 top-1/2 h-0.5 bg-primary/90 shadow-[0_0_10px_rgba(195,165,121,0.8)]" />
              </div>
            </div>
          )}

          {estado ===
            "cargando" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />

              <p className="text-sm">
                Abriendo cámara...
              </p>
            </div>
          )}

          {estado ===
            "detectado" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
              <Camera className="w-9 h-9 text-primary mb-3" />

              <p className="font-medium">
                Código detectado
              </p>
            </div>
          )}
        </div>

        {estado ===
          "leyendo" && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Camera className="w-5 h-5 text-primary shrink-0 mt-0.5" />

            <div>
              <p className="text-sm font-medium">
                Cámara lista
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Coloca un solo código dentro del recuadro y mantén el teléfono quieto.
              </p>
            </div>
          </div>
        )}

        {estado === "error" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
            <div className="flex items-start gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />

              <div>
                <p className="font-medium">
                  No se pudo usar la cámara
                </p>

                <p className="text-sm mt-1">
                  {error}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={
                iniciarCamara
              }
              className="w-full mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Intentar nuevamente
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Al cerrar o detectar un código, todas las cámaras abiertas por el escáner se liberan.
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={cerrar}
            className="w-full"
          >
            Cerrar cámara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}