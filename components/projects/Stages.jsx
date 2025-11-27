"use client";

import React from "react";
import { useFieldArray } from "react-hook-form";
import { MAX_STAGES } from "../../lib/constants";
import StageCard from "./StageCard";
import styles from "./FormStyles.module.css";

const createEmptyStage = () => ({
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  requests: [
    {
      type: "materials",
      description: "",
      quantity: undefined,
      unit: "",
    },
  ],
});

export default function Stages() {
  const { fields: stageFields, append, remove } = useFieldArray({ name: "project.stages" });

  const canAddStage = stageFields.length < MAX_STAGES;

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>
        <span>Etapas</span>
        <span className={styles.countBadge}>
          {stageFields.length}
          <span className={styles.countMax}>/ {MAX_STAGES}</span>
        </span>
      </legend>

      <div className={styles.stageList}>
        {stageFields.length === 0 ? (
          <p className={styles.emptyState}>Todavía no definiste etapas para este proyecto.</p>
        ) : (
          stageFields.map((stageField, index) => (
            <StageCard
              key={stageField.id}
              index={index}
              removeStage={() => remove(index)}
              canRemove={stageFields.length > 1}
            />
          ))
        )}
      </div>

      <button
        type="button"
        className={`${styles.button} ${styles.buttonSecondary} ${styles.addButton}`}
        disabled={!canAddStage}
        onClick={() => append(createEmptyStage())}
      >
        + Agregar etapa
      </button>
    </fieldset>
  );
}
