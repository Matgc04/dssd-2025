"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import FieldError from "./FieldError";
import RequestRow from "./RequestRow";
import { MAX_REQUESTS_PER_STAGE } from "../../lib/constants";

export default function StageCard({ index, removeStage, canRemove }) {
  const { control, register, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `project.stages.${index}.requests`,
  });

  const base = `project.stages.${index}`;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Stage #{index + 1}</strong>
        <button type="button" onClick={removeStage} disabled={!canRemove}>Eliminar</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>Nombre *</label>
          <input {...register(`${base}.name`)} />
          <FieldError err={errors.project?.stages?.[index]?.name} />
        </div>

        <div>
          <label>Inicio *</label>
          <input type="date" {...register(`${base}.startDate`)} />
          <FieldError err={errors.project?.stages?.[index]?.startDate} />
        </div>

        <div>
          <label>Fin *</label>
          <input type="date" {...register(`${base}.endDate`)} />
          <FieldError err={errors.project?.stages?.[index]?.endDate} />
        </div>

        <div style={{ gridColumn: "1 / span 2" }}>
          <label>Descripción</label>
          <textarea {...register(`${base}.description`)} rows={2} />
        </div>
      </div>

      <div>
        <em>Requests ({fields.length})</em>
        {fields.map((rf, j) => (
          <RequestRow key={rf.id} sIdx={index} rIdx={j} remove={() => remove(j)} />
        ))}

        <button
          type="button"
          disabled={fields.length >= MAX_REQUESTS_PER_STAGE}
          onClick={() => append({ type: "materials", description: "", quantity: undefined, unit: "" })}
        >
          + Agregar request
        </button>
      </div>
    </div>
  );
}
