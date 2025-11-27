"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import FieldError from "@/components/projects/FieldError";
import styles from "@/components/projects/FormStyles.module.css";
import { collaborationRequestSchema } from "@/lib/validation/collaborationRequestSchema";

function normalizeStages(payload) {
  if (!payload) return [];

  const candidate =
    payload?.stages ??
    payload?.data?.stages ??
    payload?.data ??
    (Array.isArray(payload) ? payload : null);
  const rawStages = Array.isArray(candidate) ? candidate : [];

  return rawStages
    .map((stage, index) => {
      const stageId = stage?.stageId ?? stage?.id ?? stage?.stage_id ?? `stage-${index}`;
      const requests = Array.isArray(stage?.requests)
        ? stage.requests.map((request, reqIndex) => ({
            ...request,
            id: request?.id ?? request?.requestId ?? request?.request_id ?? `${stageId}-req-${reqIndex}`,
          }))
        : [];

      return {
        id: stageId,
        name: stage?.name ?? `Etapa ${index + 1}`,
        description: stage?.description ?? "",
        startDate: stage?.startDate ?? stage?.start_date ?? null,
        endDate: stage?.endDate ?? stage?.end_date ?? null,
        requests,
      };
    })
    .filter((stage) => stage.id);
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  } catch {
    return "Sin fecha";
  }
}

export default function CollaborateProjectDetail({ projectId, stagesPayload, fetchError }) {
  const router = useRouter();
  const stages = useMemo(() => normalizeStages(stagesPayload), [stagesPayload]);
  const initialStageId = stages[0]?.id ?? "";
  const initialRequestId = stages[0]?.requests?.[0]?.id ?? "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(collaborationRequestSchema),
    defaultValues: {
      stageId: initialStageId,
      requestId: initialRequestId,
      quantityAvailable: "",
      unit: "",
      expectedDeliveryDate: "",
      notes: "",
    },
    mode: "onBlur",
  });

  const stageId = watch("stageId");
  const requestId = watch("requestId");

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === stageId) ?? null,
    [stageId, stages]
  );

  const selectedRequest = useMemo(
    () => selectedStage?.requests?.find((request) => request.id === requestId) ?? null,
    [selectedStage, requestId]
  );

  const hasStages = stages.length > 0;
  const stageRegister = register("stageId");
  const requestRegister = register("requestId");

  const onSubmit = async (formValues) => {
    const payload = {
      ...formValues,
      projectId,
    };

    try {
      const response = await fetch("/api/projects/colaborate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error ?? "No pudimos registrar tu colaboración.";
        throw new Error(message);
      }

      toast.success("Gracias, registramos tu colaboración.");
      router.push("/projects/colaborate");
    } catch (error) {
      console.error("Error enviando colaboración:", error);
      toast.error(error.message || "No pudimos registrar tu colaboración.");
    }
  };

  if (fetchError) {
    return (
      <div className="projects-empty">
        <div className="projects-empty__card">
          <h2>No pudimos cargar el proyecto</h2>
          <p>{fetchError}</p>
        </div>
      </div>
    );
  }

  if (!hasStages) {
    return (
      <div className="projects-empty">
        <div className="projects-empty__card">
          <h2>Este proyecto no tiene pedidos activos</h2>
          <p>Cuando la organización publique pedidos para colaborar vas a poder verlos acá.</p>
        </div>
      </div>
    );
  }

  const stageCountLabel =
    stages.length === 1 ? "1 etapa con pedidos" : `${stages.length} etapas con pedidos`;

  return (
    <div className={styles.formShell}>
      <form className={styles.formBody} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className={styles.section}>
          <div className={styles.legend}>
            <span>Elegí dónde colaborar</span>
            <span className={styles.countBadge}>
              {stageCountLabel}
              <span className={styles.countMax}>
                {selectedStage?.requests?.length ?? 0} pedidos en la etapa
              </span>
            </span>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Etapa *</label>
              <select
                className={`${styles.control} ${styles.select}`}
                {...stageRegister}
                onChange={(event) => {
                  stageRegister.onChange(event);
                  const newStageId = event.target.value;
                  const nextStage = stages.find((item) => item.id === newStageId);
                  const nextRequestId = nextStage?.requests?.[0]?.id ?? "";
                  setValue("requestId", nextRequestId, { shouldDirty: true, shouldValidate: true });
                }}
                disabled={!hasStages}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <FieldError err={errors.stageId} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Pedido *</label>
              <select
                className={`${styles.control} ${styles.select}`}
                {...requestRegister}
                disabled={!selectedStage || selectedStage.requests.length === 0}
              >
                {selectedStage?.requests?.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.description ?? request.type ?? request.id}
                  </option>
                ))}
              </select>
              <FieldError err={errors.requestId} />
            </div>
          </div>

          {selectedRequest && (
            <div className={styles.requestCard}>
              <div className={styles.requestHeader}>
                <div>
                  Pedido original · <strong>{selectedRequest.type}</strong>
                </div>
                <div className={styles.requestCounter}>
                  {selectedRequest.quantity !== null && selectedRequest.quantity !== undefined
                    ? `${selectedRequest.quantity} ${selectedRequest.unit ?? ""}`.trim()
                    : "Sin cantidad definida"}
                </div>
              </div>
              <p className={styles.pageSubtitle}>{selectedRequest.description}</p>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.legend}>
            <span>Completá con lo que tu ONG puede aportar</span>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Cantidad disponible *</label>
              <input
                type="number"
                step="any"
                className={styles.control}
                required
                {...register("quantityAvailable")}
                placeholder="Ej: 10"
              />
              <FieldError err={errors.quantityAvailable} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Unidad *</label>
              <input
                className={styles.control}
                required
                {...register("unit")}
                placeholder="Ej: cajas, litros"
              />
              <FieldError err={errors.unit} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Fecha estimada de entrega</label>
              <input type="date" className={styles.control} {...register("expectedDeliveryDate")} />
              <FieldError err={errors.expectedDeliveryDate} />
            </div>

            <div className={`${styles.field} ${styles.fullRow}`}>
              <label className={styles.label}>Notas adicionales</label>
              <textarea
                className={`${styles.control} ${styles.textarea}`}
                {...register("notes")}
                placeholder="Dejanos más detalles sobre cómo y cuándo podrías entregar este aporte."
              />
              <FieldError err={errors.notes} />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={isSubmitting || !hasStages}
          >
            {isSubmitting ? "Enviando..." : "Confirmar colaboración"}
          </button>
        </div>
      </form>

      <div className={styles.section}>
        <div className={styles.legend}>
          <span>Detalle de etapas y pedidos</span>
        </div>
        <div className={styles.stageList}>
          {stages.map((stage, stageIndex) => (
            <div key={stage.id} className={styles.stageCard}>
              <div className={styles.stageHeader}>
                <div className={styles.stageTitle}>
                  <span>Etapa {stageIndex + 1}</span>
                  <strong>{stage.name}</strong>
                </div>
                <div className={styles.stageMeta}>
                  <span>Inicio: {formatDate(stage.startDate)}</span>
                  <span>Fin: {formatDate(stage.endDate)}</span>
                </div>
              </div>

              {stage.description && (
                <p className={styles.stageDescription}>{stage.description}</p>
              )}

              <div className={styles.requestHeader}>
                <div>Pedidos publicados</div>
                <div className={styles.requestCounter}>
                  {stage.requests.length} {stage.requests.length === 1 ? "pedido" : "pedidos"}
                </div>
              </div>

              <div className={styles.requestList}>
                {stage.requests.map((request) => (
                  <div key={request.id} className={styles.requestCard}>
                    <div className={styles.requestGrid}>
                      <div>
                        <strong>Tipo</strong>
                        <p>{request.type ?? "Sin datos"}</p>
                      </div>
                      <div>
                        <strong>Necesita</strong>
                        <p>
                          {request.quantity !== null && request.quantity !== undefined
                            ? `${request.quantity} ${request.unit ?? ""}`.trim()
                            : "No especificada"}
                        </p>
                      </div>
                    </div>
                    <div><strong>Descripción</strong>
                    <p>{request.description ?? "Sin descripción"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
