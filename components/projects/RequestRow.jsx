"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import FieldError from "./FieldError";
import { REQUEST_OPTIONS } from "../../lib/validation/projectSchema";

export default function RequestRow({ sIdx, rIdx, remove }) {
  const { register, formState: { errors }, watch, setError, clearErrors } = useFormContext();
  const base = `project.stages.${sIdx}.requests.${rIdx}`;

  const type = watch(`${base}.type`);
  const amount = watch(`${base}.amount`);
  const currency = watch(`${base}.currency`);
  const quantity = watch(`${base}.quantity`);
  const unit = watch(`${base}.unit`);

  return (
    <div style={{ border: "1px dashed #ddd", padding: 8, marginTop: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px 160px 160px 160px auto", gap: 8 }}>
        <div>
          <label>Tipo *</label>
          <select {...register(`${base}.type`)}>
            {REQUEST_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Descripción *</label>
          <input {...register(`${base}.description`)} />
          <FieldError err={errors.project?.stages?.[sIdx]?.requests?.[rIdx]?.description} />
        </div>

        <div>
          <label>Cantidad</label>
          <input type="number" step="any" {...register(`${base}.quantity`)} />
          <FieldError err={errors.project?.stages?.[sIdx]?.requests?.[rIdx]?.quantity} />
        </div>

        <div>
          <label>Unidad</label>
          <input {...register(`${base}.unit`)} />
          <FieldError err={errors.project?.stages?.[sIdx]?.requests?.[rIdx]?.unit} />
        </div>

        <div>
          <label>Importe</label>
          <input type="number" step="any" {...register(`${base}.amount`)} />
          <FieldError err={errors.project?.stages?.[sIdx]?.requests?.[rIdx]?.amount} />
        </div>

        <div>
          <label>Moneda</label>
          <input {...register(`${base}.currency`)} maxLength={3} />
          <FieldError err={errors.project?.stages?.[sIdx]?.requests?.[rIdx]?.currency} />
        </div>

        <div style={{ alignSelf: "end" }}>
          <button type="button" onClick={remove}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}
