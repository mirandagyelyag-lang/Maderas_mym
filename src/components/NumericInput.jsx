import React from "react";

import { Input } from "@/components/ui/input";

export default function NumericInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  allowDecimals = false,
  className = "",
  disabled = false,
  placeholder = "",
  ...props
}) {
  const limpiarValor = (valor) => {
    if (valor === "") {
      return "";
    }

    let limpio = String(valor)
      .replace(",", ".")
      .replace(
        allowDecimals
          ? /[^0-9.-]/g
          : /[^0-9-]/g,
        ""
      );

    if (!allowDecimals) {
      limpio = limpio.replace(/\./g, "");
    } else {
      const partes = limpio.split(".");

      if (partes.length > 2) {
        limpio = `${partes.shift()}.${partes.join("")}`;
      }
    }

    if (min !== undefined && Number(min) >= 0) {
      limpio = limpio.replace(/-/g, "");
    } else {
      const tieneNegativo = limpio.startsWith("-");

      limpio = limpio.replace(/-/g, "");

      if (tieneNegativo) {
        limpio = `-${limpio}`;
      }
    }

    return limpio;
  };

  const manejarCambio = (event) => {
    const limpio = limpiarValor(event.target.value);

    if (limpio === "") {
      onValueChange?.("");
      return;
    }

    const numero = Number(limpio);

    if (Number.isNaN(numero)) {
      return;
    }

    if (max !== undefined && numero > Number(max)) {
      onValueChange?.(String(max));
      return;
    }

    onValueChange?.(limpio);
  };

  const manejarBlur = () => {
    if (value === "" || value === null || value === undefined) {
      return;
    }

    let numero = Number(value);

    if (Number.isNaN(numero)) {
      onValueChange?.("");
      return;
    }

    if (min !== undefined && numero < Number(min)) {
      numero = Number(min);
    }

    if (max !== undefined && numero > Number(max)) {
      numero = Number(max);
    }

    if (!allowDecimals) {
      numero = Math.round(numero);
    }

    onValueChange?.(String(numero));
  };

  return (
    <Input
      type="number"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      min={min}
      max={max}
      step={step}
      value={value ?? ""}
      onChange={manejarCambio}
      onBlur={manejarBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}