"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import FieldError from "./FieldError";
import { REQUEST_OPTIONS } from "../../lib/validation/projectSchema";
import styles from "./FormStyles.module.css";

export default function RequestRow({ sIdx, rIdx, remove }) {
  const { register, formState: { errors } } = useFormContext();
  const base = `project.stages.${sIdx}.requests.${rIdx}`;
  const requestErrors = errors.project?.stages?.[sIdx]?.requests?.[rIdx] ?? {};

  return (
    <div className={styles.requestCard}>
      <div className={styles.requestGrid}>
        <div className={styles.field}>
          <label className={styles.label}>Tipo *</label>
          <select className={`${styles.control} ${styles.select}`} {...register(`${base}.type`)}>
            {REQUEST_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Descripción *</label>
          <input className={styles.control} {...register(`${base}.description`)} />
          <FieldError err={requestErrors.description} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Cantidad *</label>
          <input
            type="number"
            step="any"
            required
            className={styles.control}
            {...register(`${base}.quantity`)}
          />
          <FieldError err={requestErrors.quantity} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Unidad *</label>
          <input
            required
            className={styles.control}
            {...register(`${base}.unit`)}
            placeholder="Ej: cajas, litros"
          />
          <FieldError err={requestErrors.unit} />
        </div>
      </div>

      <div className={styles.requestActions}>
        <button type="button" onClick={remove} className={`${styles.button} ${styles.buttonDanger}`}>
          Eliminar pedido
        </button>
      </div>
    </div>
  );
}
