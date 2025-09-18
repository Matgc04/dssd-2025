"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import FieldError from "./FieldError";

export default function ProjectFields() {
  const { register, formState: { errors } } = useFormContext();

  return (
    <fieldset style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 24 }}>
      <legend><strong>Datos del proyecto</strong></legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>Nombre *</label>
          <input {...register("project.name")} placeholder="Mejora de centro comunitario" />
          <FieldError err={errors.project?.name} />
        </div>

        <div>
          <label>Organización creadora (ID) *</label>
          <input {...register("project.createdByOrgId")} placeholder="ong_123" />
          <FieldError err={errors.project?.createdByOrgId} />
        </div>

        <div style={{ gridColumn: "1 / span 2" }}>
          <label>Descripción *</label>
          <textarea {...register("project.description")} rows={3} />
          <FieldError err={errors.project?.description} />
        </div>

        <div>
          <label>País *</label>
          <input {...register("project.originCountry")} placeholder="AR" maxLength={2} />
          <FieldError err={errors.project?.originCountry} />
        </div>

        <div>
          <label>Inicio *</label>
          <input type="date" {...register("project.startDate")} />
          <FieldError err={errors.project?.startDate} />
        </div>

        <div>
          <label>Fin *</label>
          <input type="date" {...register("project.endDate")} />
          <FieldError err={errors.project?.endDate} />
        </div>
      </div>
    </fieldset>
  );
}
