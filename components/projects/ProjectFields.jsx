"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import FieldError from "./FieldError";
import styles from "./FormStyles.module.css";

export default function ProjectFields() {
  const { register, formState: { errors } } = useFormContext();

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>
        <span>Datos del proyecto</span>
      </legend>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label}>Nombre *</label>
          <input
            className={styles.control}
            {...register("project.name")}
            placeholder="Mejora de centro comunitario"
          />
          <FieldError err={errors.project?.name} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Organización creadora (ID) *</label>
          <input
            className={styles.control}
            {...register("project.createdByOrgId")}
            placeholder="ong_123"
          />
          <FieldError err={errors.project?.createdByOrgId} />
        </div>

        <div className={`${styles.field} ${styles.fullRow}`}>
          <label className={styles.label}>Descripción *</label>
          <textarea
            className={`${styles.control} ${styles.textarea}`}
            {...register("project.description")}
            rows={3}
          />
          <FieldError err={errors.project?.description} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>País *</label>
          <input
            className={styles.control}
            {...register("project.originCountry")}
            placeholder="AR"
            maxLength={2}
          />
          <FieldError err={errors.project?.originCountry} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Inicio *</label>
          <input type="date" className={styles.control} {...register("project.startDate")} />
          <FieldError err={errors.project?.startDate} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Fin *</label>
          <input type="date" className={styles.control} {...register("project.endDate")} />
          <FieldError err={errors.project?.endDate} />
        </div>
      </div>
    </fieldset>
  );
}
