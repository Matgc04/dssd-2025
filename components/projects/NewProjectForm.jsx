"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { projectSchema } from "@/lib/validation/projectSchema";
import ProjectFields from "@/components/projects/ProjectFields";
import Stages from "@/components/projects/Stages";
import styles from "@/components/projects/FormStyles.module.css";
import { toast } from "react-hot-toast";

const PROCESS_DISPLAY_NAME = "Creacion de proyecto y colaboracion de ONGs";

export default function NewProjectPage({ org_id }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const methods = useForm({
    resolver: yupResolver(projectSchema),
    defaultValues: {
      project: {
        name: "",
        description: "",
        originCountry: "AR",
        startDate: "",
        endDate: "",
        createdByOrgId: org_id,
        stages: [
          {
            name: "",
            description: "",
            startDate: "",
            endDate: "",
            requests: [
              { type: "materials", description: "", quantity: undefined, unit: "" },
            ],
          },
        ],
      },
    },
    mode: "onBlur",
  });

  const { handleSubmit } = methods;

  const onSubmit = async (formData) => {
    console.log("Payload listo para enviar a Bonita / API:", formData);
    setLoading(true);
    try {
      const payload = {
        displayName: PROCESS_DISPLAY_NAME,
        contract: {
          project: formData.project,
        },
      };

      const request = fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const json = await res.json().catch(() => null);
        console.log("Create response status:", res.status, "body:", json);

        if (!res.ok) {
          const message = json?.error || `Request failed with status ${res.status}`;
          throw new Error(message);
        }

        return json;
      });

      await toast.promise(request, {
        loading: "Enviando proyecto...",
        success: (data) => {
          const caseId = data?.casePayload?.caseId || data?.casePayload?.id || data?.casePayload?.case_id;
          return caseId
            ? `Proyecto enviado. Bonita Case ID: ${caseId}`
            : "Proyecto guardado correctamente";
        },
        error: (err) => err.message || "Error al guardar proyecto",
      });

      router.push("/projects");
    } catch (err) {
      console.error("Error creando proyecto", err);
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
            Complete la información general y defina las etapas junto a sus pedidos para empezar a planificar.
          </p>
        </header>

        <form className={styles.formBody} onSubmit={handleSubmit(onSubmit)} noValidate>
          <ProjectFields />
          <Stages />

          <div className={styles.formActions}>
            <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loading}>
              {loading ? "Enviando..." : "Guardar proyecto"}
            </button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
