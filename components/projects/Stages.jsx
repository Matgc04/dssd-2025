"use client";

import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { MAX_STAGES } from "../../lib/constants";
import StageCard from "./StageCard";

export default function Stages() {
  const { control } = useFormContext(); //Optional? im using FormProvider
  const { fields, append, remove } = useFieldArray({ control, name: "project.stages" });

  return (
    <fieldset style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      <legend><strong>Stages ({fields.length})</strong></legend>

      {fields.map((sf, i) => (
        <StageCard key={sf.id} index={i} removeStage={() => remove(i)} canRemove={fields.length > 1} />
      ))}

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          disabled={fields.length >= MAX_STAGES}
          onClick={() =>
            append({ name: "", description: "", startDate: "", endDate: "", requests: [] })
          }
        >
          + Agregar stage
        </button>
      </div>
    </fieldset>
  );
}
