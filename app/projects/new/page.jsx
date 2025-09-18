"use client";

import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { projectSchema } from "../../../lib/validation/projectSchema";
import { EXAMPLE_PROJECT } from "../../../lib/examples";
import ProjectFields from "../../../components/projects/ProjectFields";
import Stages from "../../../components/projects/Stages";

export default function NewProjectPage() {
  const methods = useForm({
    resolver: yupResolver(projectSchema),
    defaultValues: {
      project: {
        name: "",
        description: "",
        originCountry: "AR",
        startDate: "",
        endDate: "",
        createdByOrgId: "",
        stages: [
          {
            name: "",
            description: "",
            startDate: "",
            endDate: "",
            requests: [
              // default aligns with our enum values
              { type: "materials", description: "", quantity: undefined, unit: "" },
            ],
          },
        ],
      },
    },
    mode: "onBlur",
  });

  const { handleSubmit, setValue } = methods;

  const onSubmit = (data) => {
    console.log("Payload listo para enviar a Bonita / API:", data);
    alert("JSON listo en consola");
  };

  return (
    <FormProvider {...methods}>
      <div style={{ maxWidth: 960, margin: "24px auto", padding: 16 }}>
        <h1>Nuevo Proyecto</h1>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <ProjectFields />
          <Stages />
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button type="submit">Guardar</button>
            <button type="button" onClick={() => setValue("project", EXAMPLE_PROJECT)}>
              Rellenar ejemplo
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
