"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import FieldError from "./FieldError";
import RequestRow from "./RequestRow";
import { MAX_REQUESTS_PER_STAGE } from "../../lib/constants";
import styles from "./FormStyles.module.css";

const createEmptyRequest = () => ({
  type: "materials",
  description: "",
  quantity: undefined,
  unit: "",
  amount: undefined,
  currency: "",
});

export default function StageCard({ index, removeStage, canRemove }) {
  const { register, formState: { errors } } = useFormContext();
  const { fields: requestFields, append: appendRequest, remove: removeRequest } = useFieldArray({
    name: `project.stages.${index}.requests`,
  });

  const stageErrors = errors.project?.stages?.[index] ?? {};

  const base = `project.stages.${index}`;
  const requestSummary = requestFields.length === 1 ? "1 pedido" : `${requestFields.length} pedidos`;

  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <div>
          <div className={styles.stageTitle}>
            <span className={styles.tag}>Etapa {index + 1}</span>
            <span>Detalle de la etapa</span>
          </div>
          <div className={styles.stageMeta}>{requestSummary}</div>
        </div>

        <button
          type="button"
          onClick={removeStage}
          disabled={!canRemove}
          className={`${styles.button} ${styles.buttonDanger}`}
        >
          Eliminar etapa
        </button>
      </div>

      <div className={styles.stageGrid}>
        <div className={styles.field}>
          <label className={styles.label}>Nombre *</label>
          <input className={styles.control} {...register(`${base}.name`)} />
          <FieldError err={stageErrors.name} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Inicio *</label>
          <input type="date" className={styles.control} {...register(`${base}.startDate`)} />
          <FieldError err={stageErrors.startDate} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Fin *</label>
          <input type="date" className={styles.control} {...register(`${base}.endDate`)} />
          <FieldError err={stageErrors.endDate} />
        </div>

        <div className={`${styles.field} ${styles.stageDescription}`}>
          <label className={styles.label}>Descripción</label>
          <textarea className={`${styles.control} ${styles.textarea}`} {...register(`${base}.description`)} rows={2} />
        </div>
      </div>

      <div>
        <div className={styles.requestHeader}>
          <span className={styles.tag}>Pedidos</span>
          <span className={styles.requestCounter}>
            {requestFields.length} / {MAX_REQUESTS_PER_STAGE}
          </span>
        </div>

        <div className={styles.requestList}>
          {requestFields.length === 0 ? (
            <p className={styles.emptyState}>No agregaste pedidos a esta etapa aún.</p>
          ) : (
            requestFields.map((requestField, requestIndex) => (
              <RequestRow
                key={requestField.id}
                sIdx={index}
                rIdx={requestIndex}
                remove={() => removeRequest(requestIndex)}
              />
            ))
          )}
        </div>

        <div className={styles.actionsRight}>
          <button
            type="button"
            disabled={requestFields.length >= MAX_REQUESTS_PER_STAGE}
            onClick={() => appendRequest(createEmptyRequest())}
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            + Agregar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
