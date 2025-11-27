"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";

const STATUS_LABELS = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  FINISHED: "Finalizado",
};

function formatStatus(status) {
  if (!status) return "Sin estado";
  return STATUS_LABELS[status] ?? status;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date?.getTime?.())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "Sin fecha";
  }
}

export default function FinishCollaborations({ project, collaborations = [] }) {
  const [finishingId, setFinishingId] = useState(null);
  const [localStatuses, setLocalStatuses] = useState({});

  const finishCollaboration = async (collaborationId) => {
    if (!collaborationId || !project?.id) return;
    setFinishingId(collaborationId);
    const toastId = toast.loading("Finalizando compromiso...");
    try {
      const response = await fetch("/api/projects/finishColaborations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          collaborationId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || "No se pudo finalizar el compromiso.";
        throw new Error(message);
      }
      setLocalStatuses((prev) => ({ ...prev, [collaborationId]: "FINISHED" }));
      toast.success("Compromiso finalizado", { id: toastId });
    } catch (err) {
      toast.error(err.message || "No se pudo finalizar el compromiso.", { id: toastId });
    } finally {
      setFinishingId(null);
    }
  };

  if (!project) {
    return (
      <div className="projects-empty">
        <div className="projects-empty__card">
          <h2>Proyecto no disponible</h2>
          <p>Volvé al listado y elegí un proyecto.</p>
        </div>
      </div>
    );
  }

  const resolvedCollaborations = collaborations.map((collab) => ({
    ...collab,
    status: localStatuses[collab.id] ?? collab.status,
  }));

  const visibleCollaborations = resolvedCollaborations.filter((collab) => {
    const status = (collab.status ?? "").toUpperCase();
    return status === "ACCEPTED" || status === "FINISHED";
  });

  const hasCollaborations = visibleCollaborations.length > 0;

  return (
    <section className="projects-shell">
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Compromisos</p>
          <h1 className="projects-title">Finalizar colaboraciones</h1>
          <p className="projects-subtitle">
            Proyecto: {project.name}
          </p>
        </div>
        <Link href="/projects" className="auth-submit">
          Volver al listado
        </Link>
      </header>

      {hasCollaborations ? (
        <ul className="projects-grid">
          {visibleCollaborations.map((collab) => (
            <li
              key={collab.id}
              className={`project-card${
                (collab.status ?? "").toUpperCase() === "FINISHED" ? " project-card--finished" : ""
              }`}
            >
              <div className="project-card__body">
                <div className="projects-eyebrow">Colaboración</div>
                <h3 className="project-card__title">
                  {collab.request?.description ?? collab.requestId}
                </h3>
                <p className="project-card__description">
                  Etapa: {collab.stage?.name ?? collab.stageId ?? "Sin etapa"} · Org:{" "}
                  {collab.orgId}
                </p>
              </div>
              <dl className="project-card__meta">
                <div>
                  <dt>Estado</dt>
                  <dd>{formatStatus(collab.status)}</dd>
                </div>
                <div>
                  <dt>Entrega estimada</dt>
                  <dd>{formatDate(collab.expectedDeliveryDate)}</dd>
                </div>
                <div>
                  <dt>Cantidad y unidad</dt>
                  <dd>
                    {collab.committedQuantity
                      ? `${collab.committedQuantity} ${collab.committedUnit ?? ""}`.trim()
                      : "No informada"}
                  </dd>
                </div>
                <div>
                  <dt>Compromiso creado</dt>
                  <dd>{formatDate(collab.createdAt)}</dd>
                </div>
              </dl>
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "0.75rem",
                  marginTop: "0.75rem",
                }}
              >
                <div className="projects-eyebrow">Notas de la red</div>
                <p className="project-card__description" style={{ margin: "0.35rem 0 0" }}>
                  {collab.notes || "Sin notas de la red."}
                </p>
              </div>
              {collab.status !== "FINISHED" ? (
                <div className="project-card__actions" style={{ display: "flex", gap: "0.5rem" }}>
                  <Link
                    href="#"
                    className="project-card__link"
                    onClick={(e) => {
                      e.preventDefault();
                      if (finishingId === collab.id) return;
                      finishCollaboration(collab.id);
                    }}
                    aria-disabled={finishingId === collab.id}
                    style={finishingId === collab.id ? { pointerEvents: "none", opacity: 0.6 } : undefined}
                  >
                    {finishingId === collab.id ? "Finalizando..." : "Finalizar"}
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="projects-empty">
          <div className="projects-empty__card">
            <h2>No hay colaboraciones activas</h2>
            <p>Este proyecto no tiene compromisos para finalizar.</p>
          </div>
        </div>
      )}
    </section>
  );
}
