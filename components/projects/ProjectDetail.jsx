"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/constants";

function formatDate(value) {
  if (!value) return "Sin fecha";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "Sin fecha";
  }
}

function formatNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
}

function formatQuantity(quantity, unit) {
  const numeric = formatNumber(quantity);
  if (!numeric) return "No definida";
  return `${numeric} ${unit ?? ""}`.trim();
}

const STATUS_LABELS = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  FINISHED: "Finalizado",
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? "Sin estado";
}

const PROCESS_STATUS_LABELS = {
  DRAFT: "Borrador",
  STARTED: "Iniciado",
  COMPLETED: "Completo",
  RUNNING: "En ejecución",
  FINISHED: "Finalizado",
  ERROR: "Error",
};

function formatProcessStatus(status){
  return PROCESS_STATUS_LABELS[status] ?? status ?? "Sin estado";
}

export default function ProjectDetail({ project, collaborations = [], fetchError, roleName }) {
  const [pendingId, setPendingId] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [obsActionId, setObsActionId] = useState(null);
  const router = useRouter();
  const comments = Array.isArray(project?.comments) ? project.comments : [];
  const isOriginante = roleName === ROLES.ONG_ORIGINANTE;

  const stages = project?.stages ?? [];
  const hasStages = stages.length > 0;
  const hasCollaborations = Array.isArray(collaborations) && collaborations.length > 0;

  const collaborationByRequestId = useMemo(() => {
    const map = new Map();
    (collaborations || []).forEach((collaboration) => {
      if (collaboration?.requestId) {
        map.set(collaboration.requestId, collaboration);
      }
    });
    return map;
  }, [collaborations]);

  const sendDecision = async (collaboration, accepted) => {
    if (!collaboration?.id || !project?.id) return;
    setPendingId(collaboration.id);
    try {
      const response = await fetch("/api/projects/commitmentDecision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          collaborationId: collaboration.id,
          requestId: collaboration.requestId,
          accepted,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "No pudimos registrar tu respuesta.");
      }

      setDecisions((prev) => ({ ...prev, [collaboration.id]: accepted }));
      toast.success(accepted ? "Aceptaste el compromiso." : "Rechazaste el compromiso.");
      if (accepted) {
        router.push("/projects");
      }
    } catch (error) {
      console.error("Error enviando decisión de compromiso:", error);
      toast.error(error.message || "No pudimos registrar tu respuesta.");
    } finally {
      setPendingId(null);
    }
  };

  const handleObservationAction = async (commentId, action) => {
    if (!project?.id || !commentId) return;
    setObsActionId(`${action}-${commentId}`);
    const toastId = toast.loading(
      action === "apply"
        ? "Marcando 'Aplicar correcciones'..."
        : "Marcando 'Observacion completada'..."
    );
    try {
      const res = await fetch("/api/projects/observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, commentId, action }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "No se pudo completar la tarea en Bonita.");
      }
      toast.success("Accion registrada en Bonita.", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Error al completar la tarea.", { id: toastId });
    } finally {
      setObsActionId(null);
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

  if (!project) {
    return (
      <div className="projects-empty">
        <div className="projects-empty__card">
          <h2>Proyecto no disponible</h2>
          <p>Volvé al listado y elegí un proyecto para ver su detalle.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-shell">
      <div className="project-card">
        <div className="project-card__body">
          <p className="projects-eyebrow">Resumen</p>
          <h2 className="project-card__title">{project.name}</h2>
          <p className="project-card__description">{project.description}</p>
        </div>
        <dl className="project-card__meta">
          <div>
            <dt>Inicio</dt>
            <dd>{formatDate(project.startDate)}</dd>
          </div>
          <div>
            <dt>Fin</dt>
            <dd>{formatDate(project.endDate)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{formatProcessStatus(project.status)}</dd>
          </div>
          <div>
            <dt>País</dt>
            <dd>{project.originCountry ?? "Sin datos"}</dd>
          </div>
        </dl>
      </div>

      {comments.length > 0 ? (
      <div className="project-card">
        <div className="project-card__body">
          <p className="projects-eyebrow">Observaciones</p>
          <h3 className="project-card__title">Comentarios del consejo directivo</h3>
          <p className="project-card__description">
              Observaciones cargadas por el consejo directivo.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            padding: "1rem",
          }}
        >
          {comments.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "0.75rem",
                  display: "grid",
              gap: "0.35rem",
            }}
          >
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {item.createdAt ? formatDate(item.createdAt) : ""}
            </div>
            <div>{item.content}</div>
                {isOriginante ? (
                  <div className="project-card__actions" style={{ justifyContent: "flex-start", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="auth-submit"
                      onClick={() => handleObservationAction(item.id, "apply")}
                      disabled={obsActionId === `apply-${item.id}`}
                    >
                      {obsActionId === `apply-${item.id}` ? "Marcando..." : "Aplicar correcciones"}
                    </button>
                    <button
                      type="button"
                      className="auth-submit"
                      style={{ background: "var(--success)" }}
                      onClick={() => handleObservationAction(item.id, "complete")}
                      disabled={obsActionId === `complete-${item.id}`}
                    >
                      {obsActionId === `complete-${item.id}` ? "Marcando..." : "Completar observacion"}
                    </button>
                  </div>
                ) : null}
          </div>
        ))}
      </div>
    </div>
  ) : null}

      <div className="project-card">
        <div className="project-card__body">
          <p className="projects-eyebrow">Compromisos</p>
          <h3 className="project-card__title">
            {hasCollaborations ? "Compromisos recibidos" : "Aún no hay compromisos"}
          </h3>
          <p className="project-card__description">
            {hasCollaborations
              ? "Revisá y respondé los compromisos que otras organizaciones hicieron sobre tus pedidos."
              : "Cuando una red de ONGs envíe un compromiso vas a poder aceptarlo o rechazarlo desde acá."}
          </p>
        </div>

        {hasCollaborations ? (
          <div className="project-card__meta" style={{ gridTemplateColumns: "1fr" }}>
            {collaborations.map((collaboration) => {
              const request = collaboration.request;
              const stageLabel = collaboration.stage?.name ?? collaboration.stageId;
              const decision = decisions[collaboration.id];
              const isPending = pendingId === collaboration.id;
              const status =
                decision === undefined
                  ? collaboration.status ?? "PENDING"
                  : decision
                  ? "ACCEPTED"
                  : "REJECTED";

              return (
                <div
                  key={collaboration.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    display: "grid",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <div className="projects-eyebrow">Pedido comprometido</div>
                    <strong>{request?.description ?? request?.type ?? collaboration.requestId}</strong>
                    <span style={{ color: "var(--text-muted)" }}>
                      Etapa: {stageLabel ?? "Sin etapa"} · Org colaboradora: {collaboration.orgId}
                    </span>
                    {status !== "PENDING" ? (
                      <span className="project-card__badge" style={{ background: "#e5e7eb" }}>
                        {getStatusLabel(status)}
                      </span>
                    ) : null}
                  </div>

                  <div className="project-card__meta" style={{ marginTop: 0 }}>
                    <div>
                      <dt>SE COMPROMETE A DAR</dt>
                      <dd>{formatQuantity(collaboration.committedQuantity, collaboration.committedUnit)}</dd>
                    </div>
                    <div>
                      <dt>Entrega estimada</dt>
                      <dd>{formatDate(collaboration.expectedDeliveryDate)}</dd>
                    </div>
                    <div>
                      <dt>Colaboracion creada</dt>
                      <dd>{formatDate(collaboration.createdAt)}</dd>
                    </div>
                  </div>

                  {collaboration.notes ? (
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>{collaboration.notes}</p>
                  ) : null}

                  {status === "PENDING" ? (
                    <div className="project-card__actions" style={{ gap: "0.5rem", justifyContent: "flex-start" }}>
                      <button
                        type="button"
                        className="auth-submit"
                        onClick={() => sendDecision(collaboration, true)}
                        disabled={isPending}
                      >
                        {isPending ? "Enviando..." : "Aceptar"}
                      </button>
                      <button
                        type="button"
                        className="auth-submit"
                        style={{ background: "var(--danger)" }}
                        onClick={() => sendDecision(collaboration, false)}
                        disabled={isPending}
                      >
                        {isPending ? "Enviando..." : "Rechazar"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="project-card">
        <div className="project-card__body">
          <p className="projects-eyebrow">Pedidos de ayuda</p>
          <h3 className="project-card__title">
            {hasStages ? "Etapas publicadas" : "Todavía no definiste pedidos"}
          </h3>
          <p className="project-card__description">
            {hasStages
              ? "Revisá cada etapa y encontrá los pedidos que ya tienen compromisos."
              : "Cuando agregues etapas con pedidos vas a poder seguirlas desde acá."}
          </p>
        </div>

        {hasStages ? (
          <div className="project-card__meta" style={{ gridTemplateColumns: "1fr" }}>
            {stages.map((stage, stageIndex) => (
              <div
                key={stage.id}
                style={{
                  padding: "1rem",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  display: "grid",
                  gap: "0.65rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    <div className="projects-eyebrow">Etapa {stageIndex + 1}</div>
                    <strong>{stage.name}</strong>
                  </div>
                  <div style={{ textAlign: "right", color: "var(--text-muted)" }}>
                    <div>Inicio: {formatDate(stage.startDate)}</div>
                    <div>Fin: {formatDate(stage.endDate)}</div>
                  </div>
                </div>

                {stage.description ? (
                  <p style={{ margin: 0, color: "var(--text-muted)" }}>{stage.description}</p>
                ) : null}

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {(stage.requests ?? []).map((request) => {
                    const collaboration = collaborationByRequestId.get(request.id);
                    return (
                      <div
                        key={request.id}
                        style={{
                          padding: "0.85rem",
                          border: "1px dashed var(--border-strong)",
                          borderRadius: "10px",
                          background: collaboration ? "rgba(37, 99, 235, 0.05)" : "var(--surface)",
                          display: "grid",
                          gap: "0.35rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                          <strong>{request.description}</strong>
                          <span style={{ color: "var(--text-muted)" }}>{request.type}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem" }}>
                          <div>
                            <dt>Cantidad solicitada</dt>
                            <dd style={{ margin: 0 }}>
                              {formatQuantity(request.quantity, request.unit)}
                            </dd>
                          </div>
                        </div>
                        {collaboration ? (
                          <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                            Compromiso recibido para este pedido
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
