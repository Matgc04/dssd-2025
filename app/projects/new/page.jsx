"use client";

import React from "react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { projectSchema } from "@/lib/validation/projectSchema";
import { EXAMPLE_PROJECT } from "@/lib/examples";
import ProjectFields from "@/components/projects/ProjectFields";
import Stages from "@/components/projects/Stages";
import styles from "@/components/projects/FormStyles.module.css";

export default function NewProjectPage() {
  const [loading, setLoading] = useState(false);

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

   const onSubmit = async (data) => {
    console.log("Payload listo para enviar a Bonita / API:", data);
    setLoading(true);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json().catch(() => null);
      console.log("Create response status:", res.status, "body:", json);

      if (!res.ok) {
        alert(`Request failed with status ${res.status}`);
      }
      else {
        alert("Proyecto guardado correctamente");
      }

    } catch (err) {
      console.error("Error creando proyecto", err);
      alert("Error al guardar proyecto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <div className={styles.formShell}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Nuevo proyecto</h1>
          <p className={styles.pageSubtitle}>
            Completa la información general y definí las etapas junto a sus pedidos para empezar a planificar.
          </p>
        </header>

        <form className={styles.formBody} onSubmit={handleSubmit(onSubmit)} noValidate>
          <ProjectFields />
          <Stages />

          <div className={styles.formActions}>
            <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`}>
              Guardar proyecto
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonGhost}`}
              onClick={() => setValue("project", EXAMPLE_PROJECT)}
            >
              Rellenar ejemplo
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
