import React from "react";
import { Input } from "@/components/ui/input";

export default function NumericInput({
  value,
  onValueChange,
  min,
  max,
  allowDecimals = false,
  ...props
}) {
  const handleChange = (event) => {
    const nuevoValor = event.target.value;

    if (nuevoValor === "") {
      onValueChange("");
      return;
    }

    const numero = allowDecimals
      ? Number.parseFloat(nuevoValor)
      : Number.parseInt(nuevoValor, 10);

    if (!Number.isFinite(numero)) return;

    if (max !== undefined && numero > max) {
      onValueChange(String(max));
      return;
    }

    onValueChange(nuevoValor);
  };

  return (
    <Input
      {...props}
      type="number"
      min={min}
      max={max}
      step={allowDecimals ? "any" : "1"}
      value={value ?? ""}
      onChange={handleChange}
    />
  );
}
