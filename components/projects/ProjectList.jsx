"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

const STATUS_LABELS = {
  DRAFT: "Borrador",
  STARTED: "Iniciado",
  COMPLETED: "Completo",
  RUNNING: "En ejecución",
  FINISHED: "Finalizado",
  ERROR: "Error",
};

const STATUS_ICONS = {
  DRAFT: "📝",
  STARTED: "🚀",
  COMPLETED: "✅",
  RUNNING: "⚙️",
  FINISHED: "🏁",
  ERROR: "⚠️",
};
const RUNNING_STATUS = "RUNNING";
const COMPLETED_STATUS = "COMPLETED";
const FINISHED_STATUS = "FINISHED";
const STATUS_CLASS_MAP = {
  DRAFT: "project-card__status--draft",
  STARTED: "project-card__status--started",
  RUNNING: "project-card__status--running",
  COMPLETED: "project-card__status--completed",
  FINISHED: "project-card__status--finished",
  ERROR: "project-card__status--error",
};

function formatDate(date) {
  if (!date) return "Sin fecha";
  try {
    const value = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(value);
  } catch {
    return "Sin fecha";
  }
}

function getRequestsCount(project) {
  return (project?.stages ?? []).reduce(
    (total, stage) => total + (stage?.requests?.length ?? 0),
    0
  );
}

function formatStatus(status) {
  if (!status) return "Sin estado";
  return STATUS_LABELS[status] ?? status;
}

function getStatusClass(status) {
  const key = typeof status === "string" ? status.toUpperCase() : "";
  return STATUS_CLASS_MAP[key] ?? "project-card__status--default";
}

function allCollaborationsFinished(project) {
  const requests = (project?.stages ?? []).flatMap((stage) => stage?.requests ?? []);
  if (requests.length === 0) return false;
  const allCollabs = requests
    .flatMap((req) => req?.collaborations ?? [])
    .filter((col) => {
      const status = (col?.status ?? "").toUpperCase();
      return status === "ACCEPTED" || status === FINISHED_STATUS;
    });

  if (allCollabs.length === 0) return false;
  return allCollabs.every((col) => (col?.status ?? "").toUpperCase() === FINISHED_STATUS);
}

function hasPendingRequests(project) {
  const requests = (project?.stages ?? []).flatMap((stage) => stage?.requests ?? []);
  if (requests.length === 0) return false;
  return requests.some((req) => {
    const pendingCollab = (req?.collaborations ?? []).find((col) => {
      const status = (col?.status ?? "").toUpperCase();
      return status === "PENDING";
    });
    return !!pendingCollab;
  });
}

export default function ProjectList({ projects = [], pagination, userName }) {
  const hasProjects = Array.isArray(projects) && projects.length > 0;
  const [executingId, setExecutingId] = useState(null);
  const [statusOverrides, setStatusOverrides] = useState({});
  const router = useRouter();

  const handleExecute = async (project) => {
    if (!project?.id) return;
    setExecutingId(project.id);
    const toastId = toast.loading("Ejecutando proceso en Bonita...");
    try {
      const response = await fetch("/api/projects/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || "No se pudo ejecutar el proceso.";
        throw new Error(message);
      }
      setStatusOverrides((prev) => ({ ...prev, [project.id]: RUNNING_STATUS }));
      router.refresh();
      toast.success("Proceso ejecutado correctamente", { id: toastId });
    } catch (err) {
      toast.error(err.message || "No se pudo ejecutar el proceso.", { id: toastId });
    } finally {
      setExecutingId(null);
    }
  };

  const handleFinishProject = async (projectId) => {
    if (!projectId) return;
    const toastId = toast.loading("Marcando proyecto como finalizado...");
    try {
      const response = await fetch("/api/projects/finishProject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || "No se pudo finalizar el proyecto.";
        throw new Error(message);
      }
      setStatusOverrides((prev) => ({ ...prev, [projectId]: FINISHED_STATUS }));
      router.refresh();
      toast.success("Proyecto finalizado", { id: toastId });
    } catch (err) {
      toast.error(err.message || "No se pudo finalizar el proyecto.", { id: toastId });
    }
  };

  return (
    <section className="projects-shell">
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Mis proyectos</p>
          <h1 className="projects-title">
            {userName ? `Hola, ${userName}` : "Panel de proyectos"}
          </h1>
          <p className="projects-subtitle">
            {hasProjects
              ? `Revisá el estado de tus proyectos activos y consultá cada pedido. Tenés ${
                  pagination?.total ?? projects.length
                } proyecto${(pagination?.total ?? projects.length) === 1 ? "" : "s"} en total.`
              : "Todavía no creaste proyectos. Empezá uno nuevo para organizar pedidos y etapas."}
          </p>
        </div>
        <Link href="/projects/new" className="auth-submit">
          Crear nuevo proyecto
        </Link>
      </header>

      {hasProjects ? (
        <ul className="projects-grid">
          {projects.map((project) => {
            const stageCount = project?.stages?.length ?? 0;
            const requestCount = getRequestsCount(project);
            const effectiveStatus = statusOverrides[project.id] ?? project?.status;
            const collaborationsFinished = allCollaborationsFinished(project);
            const isFinished = effectiveStatus === FINISHED_STATUS;
            return (
              <li
                key={project.id}
                className={`project-card${isFinished ? " project-card--finished" : ""}`}
              >
                <div className={`project-card__status ${getStatusClass(effectiveStatus)}`}>
                  <span style={{ marginRight: "0.35rem" }}>
                    {STATUS_ICONS[effectiveStatus] ?? "•"}
                  </span>
                  {formatStatus(effectiveStatus)}
                </div>
                <div className="project-card__body">
                  <h2 className="project-card__title">{project.name}</h2>
                  <p className="project-card__description">{project.description}</p>
                </div>
                <dl className="project-card__meta">
                  <div>
                    <dt>Etapas</dt>
                    <dd>{stageCount}</dd>
                  </div>
                  <div>
                    <dt>Pedidos</dt>
                    <dd>{requestCount}</dd>
                  </div>
                  <div>
                    <dt>Inicio</dt>
                    <dd>{formatDate(project.startDate)}</dd>
                  </div>
                  <div>
                    <dt>Fin</dt>
                    <dd>{formatDate(project.endDate)}</dd>
                  </div>
                </dl>
                <div
                  className="project-card__actions"
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Link href={`/projects/${project.id}`} className="project-card__link">
                    Ver detalle
                  </Link>
                  {hasPendingRequests(project) && (
                    <div className="project-card__status project-card__status--finished">
                      ⚠️ Compromisos pendientes
                    </div>
                  )}
                  {effectiveStatus === COMPLETED_STATUS && (
                    <Link
                      href="#"
                      className="project-card__link"
                      onClick={(e) => {
                        e.preventDefault();
                        if (executingId) return;
                        handleExecute(project);
                      }}
                      aria-disabled={executingId === project.id}
                      style={
                        executingId === project.id
                          ? { pointerEvents: "none", opacity: 0.6 }
                          : undefined
                      }
                    >
                      {executingId === project.id ? "Ejecutando..." : "Ejecutar"}
                    </Link>
                  )}
                  {effectiveStatus === RUNNING_STATUS && !collaborationsFinished && (
                    <Link
                      href={`/projects/${project.id}/finish-colaborations`}
                      className="project-card__link"
                    >
                      Finalizar compromisos
                    </Link>
                  )}
                  {effectiveStatus === RUNNING_STATUS && collaborationsFinished && (
                    <Link
                      href="#"
                      className="project-card__link"
                      onClick={(e) => {
                        e.preventDefault();
                        handleFinishProject(project.id);
                      }}
                    >
                      Finalizar proyecto
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="projects-empty">
          <div className="projects-empty__card">
            <h2>No hay proyectos que mostrar</h2>
            <p>
              Cuando crees un proyecto desde “Crear nuevo proyecto” lo vas a ver en esta lista
              junto a su estado y resumen.
            </p>
            <Link href="/projects/new" className="auth-submit">
              Crear mi primer proyecto
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
